#!/usr/bin/env python3
"""
Deploy 2K Courtside to Cloud Run WITHOUT the gcloud CLI.

Pipeline (all REST + Application Default Credentials):
  1. Tar the repo (honouring .gcloudignore) and upload it to the Cloud Run
     sources bucket.
  2. Ensure the Artifact Registry Docker repo exists.
  3. Submit a Cloud Build (docker build + push) and poll it to completion.
  4. Create or update the Cloud Run v2 service with the new image + env.
  5. Grant allUsers roles/run.invoker (demo is public) and print the URL.

Usage:
    python3 scripts/deploy_cloud_run.py            # service: twok-courtside
    python3 scripts/deploy_cloud_run.py --service twok-courtside-preview
    python3 scripts/deploy_cloud_run.py --skip-build --image <full image ref>

Auth: `gcloud auth application-default login` must have been run once so that
~/.config/gcloud/application_default_credentials.json exists. No secrets live
in this file.
"""
import argparse
import fnmatch
import io
import json
import os
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = os.environ.get("GCP_PROJECT_ID", "jamie-bq-test")
REGION = os.environ.get("GCP_REGION", "us-central1")
AR_REPO = "twok-courtside"
SOURCE_BUCKET = f"run-sources-{PROJECT}-{REGION}"
ADC = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")

RUNTIME_ENV = {
    "GCP_PROJECT_ID": PROJECT,
    "GCP_REGION": REGION,
    "SPANNER_INSTANCE_ID": os.environ.get("SPANNER_INSTANCE_ID", "blackrock-spanner"),
    "SPANNER_DATABASE_ID": os.environ.get("SPANNER_DATABASE_ID", "twok_graph_db"),
    "BQ_DATASET_ID": os.environ.get("BQ_DATASET_ID", "twok_marketing_intelligence"),
    "GCS_BUCKET_NAME": os.environ.get("GCS_BUCKET_NAME", "twok-courtside-media-jamie-bq-test"),
    "PUBSUB_TOPIC": os.environ.get("PUBSUB_TOPIC", "twok-courtside-activations"),
    "NEXT_TELEMETRY_DISABLED": "1",
}


# --------------------------------------------------------------------------
# Auth + HTTP helpers
# --------------------------------------------------------------------------
def access_token() -> str:
    if not os.path.exists(ADC):
        sys.exit(f"ADC not found at {ADC}. Run: gcloud auth application-default login")
    d = json.load(open(ADC))
    if d.get("type") == "service_account":
        sys.exit("Service-account ADC not supported by this script; use a user ADC.")
    body = urllib.parse.urlencode(
        {
            "client_id": d["client_id"],
            "client_secret": d["client_secret"],
            "refresh_token": d["refresh_token"],
            "grant_type": "refresh_token",
        }
    ).encode()
    r = json.loads(
        urllib.request.urlopen(
            urllib.request.Request("https://oauth2.googleapis.com/token", data=body), timeout=30
        ).read()
    )
    return r["access_token"]


class Http:
    def __init__(self, token: str):
        self.token = token

    def call(self, method: str, url: str, payload=None, raw: bytes | None = None, content_type="application/json", ok404=False):
        data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", content_type)
        try:
            resp = urllib.request.urlopen(req, timeout=300)
            body = resp.read()
            return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            if ok404 and e.code == 404:
                return None
            detail = e.read().decode()[:1500]
            raise SystemExit(f"HTTP {e.code} {method} {url}\n{detail}")


# --------------------------------------------------------------------------
# 1. Source tarball
# --------------------------------------------------------------------------
def load_ignore_patterns(root: str) -> list[str]:
    patterns = [".git", "node_modules", ".next", ".venv", "scripts/.smoke", "*.log"]
    for name in (".gcloudignore", ".dockerignore"):
        p = os.path.join(root, name)
        if os.path.exists(p):
            for line in open(p):
                line = line.strip()
                if line and not line.startswith("#"):
                    patterns.append(line.rstrip("/"))
    return patterns


def should_skip(rel: str, patterns: list[str]) -> bool:
    parts = rel.split(os.sep)
    for pat in patterns:
        if fnmatch.fnmatch(rel, pat) or any(fnmatch.fnmatch(part, pat) for part in parts):
            return True
        if rel.startswith(pat + os.sep) or rel == pat:
            return True
    return False


def build_tarball(root: str) -> bytes:
    patterns = load_ignore_patterns(root)
    buf = io.BytesIO()
    count = 0
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for dirpath, dirnames, filenames in os.walk(root):
            rel_dir = os.path.relpath(dirpath, root)
            rel_dir = "" if rel_dir == "." else rel_dir
            dirnames[:] = [d for d in dirnames if not should_skip(os.path.join(rel_dir, d), patterns)]
            for f in filenames:
                rel = os.path.join(rel_dir, f) if rel_dir else f
                if should_skip(rel, patterns):
                    continue
                tar.add(os.path.join(dirpath, f), arcname=rel, recursive=False)
                count += 1
    print(f"  packed {count} files, {buf.tell() / 1e6:.1f} MB")
    return buf.getvalue()


def upload_source(http: Http, data: bytes, object_name: str) -> str:
    # Ensure bucket exists (Cloud Run normally creates it on first gcloud deploy).
    if http.call("GET", f"https://storage.googleapis.com/storage/v1/b/{SOURCE_BUCKET}", ok404=True) is None:
        print(f"  creating bucket {SOURCE_BUCKET}")
        http.call(
            "POST",
            f"https://storage.googleapis.com/storage/v1/b?project={PROJECT}",
            {"name": SOURCE_BUCKET, "location": REGION.upper(), "iamConfiguration": {"uniformBucketLevelAccess": {"enabled": True}}},
        )
    url = (
        f"https://storage.googleapis.com/upload/storage/v1/b/{SOURCE_BUCKET}/o"
        f"?uploadType=media&name={urllib.parse.quote(object_name, safe='')}"
    )
    http.call("POST", url, raw=data, content_type="application/gzip")
    return f"gs://{SOURCE_BUCKET}/{object_name}"


# --------------------------------------------------------------------------
# 2. Artifact Registry
# --------------------------------------------------------------------------
def ensure_ar_repo(http: Http):
    base = f"https://artifactregistry.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/repositories"
    if http.call("GET", f"{base}/{AR_REPO}", ok404=True):
        return
    print(f"  creating Artifact Registry repo {AR_REPO}")
    op = http.call(
        "POST",
        f"{base}?repositoryId={AR_REPO}",
        {"format": "DOCKER", "description": "2K Courtside container images"},
    )
    wait_operation(http, "https://artifactregistry.googleapis.com/v1/", op["name"], "artifactregistry.create")


# --------------------------------------------------------------------------
# 3. Cloud Build
# --------------------------------------------------------------------------
def submit_build(http: Http, object_name: str, image: str) -> str:
    build = {
        "source": {"storageSource": {"bucket": SOURCE_BUCKET, "object": object_name}},
        "steps": [
            {
                "name": "gcr.io/cloud-builders/docker",
                "args": ["build", "-t", image, "-t", image.rsplit(":", 1)[0] + ":latest", "."],
            },
            {"name": "gcr.io/cloud-builders/docker", "args": ["push", "--all-tags", image.rsplit(":", 1)[0]]},
        ],
        "images": [image],
        "options": {"machineType": "E2_HIGHCPU_8", "logging": "CLOUD_LOGGING_ONLY"},
        "timeout": "1500s",
    }
    op = http.call("POST", f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/builds", build)
    build_id = op["metadata"]["build"]["id"]
    log_url = op["metadata"]["build"].get("logUrl", "")
    print(f"  build {build_id}\n  logs: {log_url}")
    return build_id


def wait_build(http: Http, build_id: str):
    url = f"https://cloudbuild.googleapis.com/v1/projects/{PROJECT}/builds/{build_id}"
    start = time.time()
    while True:
        b = http.call("GET", url)
        status = b.get("status")
        elapsed = int(time.time() - start)
        if status in ("SUCCESS",):
            print(f"  build SUCCESS in {elapsed}s")
            return
        if status in ("FAILURE", "INTERNAL_ERROR", "TIMEOUT", "CANCELLED", "EXPIRED"):
            raise SystemExit(f"Build {status}. See {b.get('logUrl')}")
        if elapsed % 30 == 0:
            print(f"  build {status}... {elapsed}s")
        time.sleep(5)


# --------------------------------------------------------------------------
# 4. Cloud Run v2
# --------------------------------------------------------------------------
def wait_operation(http: Http, api_base: str, op_name: str, label: str):
    for _ in range(360):
        op = http.call("GET", f"{api_base}{op_name}")
        if op.get("done"):
            if "error" in op:
                raise SystemExit(f"{label} failed: {json.dumps(op['error'], indent=2)}")
            return op.get("response", {})
        time.sleep(3)
    raise SystemExit(f"{label} timed out")


def deploy_service(http: Http, service: str, image: str) -> str:
    base = f"https://run.googleapis.com/v2/projects/{PROJECT}/locations/{REGION}/services"
    name = f"{base}/{service}"
    body = {
        "template": {
            "containers": [
                {
                    "image": image,
                    "ports": [{"containerPort": 8080}],
                    "env": [{"name": k, "value": v} for k, v in RUNTIME_ENV.items()],
                    "resources": {"limits": {"cpu": "2", "memory": "2Gi"}, "cpuIdle": False},
                    "startupProbe": {"httpGet": {"path": "/api/health/spanner", "port": 8080}, "initialDelaySeconds": 5, "periodSeconds": 5, "failureThreshold": 24},
                }
            ],
            "scaling": {"minInstanceCount": 1, "maxInstanceCount": 10},
            "timeout": "300s",
            "maxInstanceRequestConcurrency": 80,
        },
        "ingress": "INGRESS_TRAFFIC_ALL",
        "labels": {"demo": "twok-courtside"},
    }
    existing = http.call("GET", name, ok404=True)
    if existing:
        print(f"  updating service {service}")
        op = http.call("PATCH", name, body)
    else:
        print(f"  creating service {service}")
        op = http.call("POST", f"{base}?serviceId={service}", body)
    resp = wait_operation(http, "https://run.googleapis.com/v2/", op["name"], "run.deploy")
    # Public invoker binding (demo). Idempotent.
    http.call(
        "POST",
        f"{name}:setIamPolicy",
        {"policy": {"bindings": [{"role": "roles/run.invoker", "members": ["allUsers"]}]}},
    )
    return resp.get("uri") or http.call("GET", name).get("uri", "")


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service", default=os.environ.get("CLOUD_RUN_SERVICE", "twok-courtside"))
    ap.add_argument("--skip-build", action="store_true", help="Deploy an existing image (requires --image)")
    ap.add_argument("--image", default=None)
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    stamp = time.strftime("%Y%m%d-%H%M%S")
    image = args.image or f"{REGION}-docker.pkg.dev/{PROJECT}/{AR_REPO}/app:{stamp}"

    print("============================================================")
    print("2K Courtside -> Cloud Run")
    print(f"  project {PROJECT} | region {REGION} | service {args.service}")
    print(f"  image   {image}")
    print("============================================================")

    http = Http(access_token())

    if not args.skip_build:
        print("[1/4] Packaging source")
        tarball = build_tarball(root)
        object_name = f"{args.service}/source-{stamp}.tgz"
        gcs_uri = upload_source(http, tarball, object_name)
        print(f"  uploaded {gcs_uri}")

        print("[2/4] Artifact Registry")
        ensure_ar_repo(http)

        print("[3/4] Cloud Build")
        build_id = submit_build(http, object_name, image)
        wait_build(http, build_id)
    else:
        print("[1-3/4] skipped build")

    print("[4/4] Cloud Run")
    uri = deploy_service(http, args.service, image)
    print("============================================================")
    print(f"LIVE: {uri}")
    print(f"health: {uri}/api/health/spanner  |  {uri}/api/health/models  |  {uri}/api/health/services")
    print("============================================================")


if __name__ == "__main__":
    main()
