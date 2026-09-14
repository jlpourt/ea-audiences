#!/usr/bin/env python3
"""
Create the abk_graph_db Spanner database and apply the property-graph schema.

Uses Application Default Credentials directly against the Spanner Admin REST
API so it does not depend on the gcloud CLI being installed.

Usage:
    python3 scripts/spanner_create_db.py [--recreate]
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROJECT = "jamie-bq-test"
INSTANCE = "blackrock-spanner"
DATABASE = "abk_graph_db"
DDL_PATH = "schema/abk_graph_db.ddl"
ADC = "/Users/jlpourt/.config/gcloud/application_default_credentials.json"

BASE = f"https://spanner.googleapis.com/v1/projects/{PROJECT}/instances/{INSTANCE}"


def access_token() -> str:
    d = json.load(open(ADC))
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
            urllib.request.Request("https://oauth2.googleapis.com/token", data=body),
            timeout=30,
        ).read()
    )
    return r["access_token"]


def call(token, method, url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        return json.loads(urllib.request.urlopen(req, timeout=120).read() or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise SystemExit(f"HTTP {e.code} on {method} {url}\n{body}")


def split_ddl(text: str):
    """Split the DDL file into statements, stripping SQL comments.

    Naive semicolon splitting would break the property-graph statement, which
    contains no semicolons internally but does span many lines; stripping
    comments first keeps the parse honest.
    """
    no_comments = "\n".join(
        line for line in text.splitlines() if not line.strip().startswith("--")
    )
    return [s.strip() for s in no_comments.split(";") if s.strip()]


def wait_for_operation(token, op_name, label):
    url = f"https://spanner.googleapis.com/v1/{op_name}"
    for attempt in range(180):
        op = call(token, "GET", url)
        if op.get("done"):
            if "error" in op:
                raise SystemExit(f"{label} FAILED: {json.dumps(op['error'], indent=2)}")
            print(f"  {label}: done")
            return op
        if attempt % 5 == 0:
            print(f"  {label}: waiting... ({attempt * 2}s)")
        time.sleep(2)
    raise SystemExit(f"{label}: timed out")


def main():
    recreate = "--recreate" in sys.argv
    token = access_token()
    db_url = f"{BASE}/databases/{DATABASE}"

    existing = None
    try:
        req = urllib.request.Request(db_url)
        req.add_header("Authorization", f"Bearer {token}")
        existing = json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    if existing and recreate:
        print(f"Dropping existing {DATABASE}...")
        call(token, "DELETE", db_url)
        time.sleep(5)
        existing = None

    statements = split_ddl(open(DDL_PATH).read())
    print(f"Parsed {len(statements)} DDL statements from {DDL_PATH}")

    if existing:
        print(f"Database {DATABASE} already exists — applying DDL as an update.")
        op = call(
            token,
            "PATCH",
            f"{db_url}/ddl",
            {"statements": statements},
        )
        wait_for_operation(token, op["name"], "updateDatabaseDdl")
    else:
        print(f"Creating database {DATABASE}...")
        op = call(
            token,
            "POST",
            f"{BASE}/databases",
            {
                "createStatement": f"CREATE DATABASE `{DATABASE}`",
                "extraStatements": statements,
                "databaseDialect": "GOOGLE_STANDARD_SQL",
            },
        )
        wait_for_operation(token, op["name"], "createDatabase")

    ddl = call(token, "GET", f"{db_url}/ddl")
    tables = [
        re.search(r"CREATE TABLE (\w+)", s).group(1)
        for s in ddl.get("statements", [])
        if s.strip().upper().startswith("CREATE TABLE")
    ]
    graphs = [
        s.split()[-1] if False else re.search(r"PROPERTY GRAPH (\w+)", s).group(1)
        for s in ddl.get("statements", [])
        if "PROPERTY GRAPH" in s
    ]
    print(f"\nTables ({len(tables)}): {', '.join(tables)}")
    print(f"Property graphs: {', '.join(graphs) or '(none)'}")
    print("\nSchema applied successfully.")


if __name__ == "__main__":
    main()
