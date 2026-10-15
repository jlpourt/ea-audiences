/**
 * Section D · Personalization Flow content library generator.
 *
 *   npx tsx scripts/generate_content_library_v2.ts            # generate missing assets
 *   npx tsx scripts/generate_content_library_v2.ts --force    # regenerate everything
 *   npx tsx scripts/generate_content_library_v2.ts --only nba-01
 *
 * Generates REAL images once with the Vertex image model used by
 * /api/creative/image (`generateImage` in src/lib/gcp/genai-client.ts) and
 * writes them to GCS:
 *
 *   gs://<GCS_BUCKET_NAME>/v2/content-library/{nba|wnba|college}/{16x9|9x16|1x1|4x3}/<asset-id>.<ext>
 *   gs://<GCS_BUCKET_NAME>/v2/content-library/manifest.json
 *
 * Each asset is generated as a 16:9 master, then recomposed for 9:16, 1:1 and
 * 4:3 using the master as a reference image so every channel crop is the same
 * creative.
 *
 * Guardrails: generic fictional athletes only (no likeness of real people,
 * Caitlin Clark appears in copy only, never in images); no league/team/brand
 * logos or readable text in images. Failures stop the script loudly; there are
 * no placeholder images.
 */
import { Storage } from "@google-cloud/storage";
import { generateImage, type ImageAspectRatio } from "../src/lib/gcp/genai-client";
import { GCP_CONFIG } from "../src/lib/config";

type Pref = "nba" | "wnba" | "college";
const FORMATS: ImageAspectRatio[] = ["16:9", "9:16", "1:1", "4:3"];
const formatSlug = (f: string) => f.replace(":", "x");

interface AssetBrief {
  id: string;
  preference: Pref;
  title: string;
  concept: string;
  /** Offer / message angle copywriters can pair with this creative. */
  offer_hint: string;
  tags: string[];
  scene: string;
}

const STYLE =
  "Photorealistic cinematic sports video game key art, dramatic lighting, shallow depth of field, rich color grade, premium console-game marketing quality.";
const GUARDRAILS =
  "All people are generic, fictional athletes and fans; do NOT depict or resemble any real person or celebrity. No league logos, no team logos, no brand logos, no watermarks, no readable text, numbers or lettering anywhere in the image.";

export const LIBRARY: AssetBrief[] = [
  // ---------------- NBA ----------------
  {
    id: "nba-01",
    preference: "nba",
    title: "Rooftop Pro-Am at dusk",
    concept: "The City rooftop court, a 5-stack crew mid-game against a skyline sunset",
    offer_hint: "Squad up: Pro-Am crew rewards and The City season content",
    tags: ["the-city", "pro-am", "crew"],
    scene:
      "A rooftop basketball court high above a dense city skyline at golden-hour dusk. A five-player squad in matching plain dark jerseys runs a fast break; one player rises for a powerful dunk while teammates react. Glowing court lines, distant skyscraper lights.",
  },
  {
    id: "nba-02",
    preference: "nba",
    title: "MyNBA war room",
    concept: "A franchise front office at night: trade board, draft board, glowing screens",
    offer_hint: "Run the franchise: MyNBA Eras and new front-office tools",
    tags: ["mynba", "franchise", "gm"],
    scene:
      "A modern basketball front office war room at night. A general manager in a suit studies a wall of glowing monitors showing abstract player cards and charts (no readable text). A tablet and coffee on a glass desk, city lights through floor-to-ceiling windows.",
  },
  {
    id: "nba-03",
    preference: "nba",
    title: "Tunnel walkout",
    concept: "A rookie's first arena walkout through the tunnel into the lights",
    offer_hint: "Your MyCAREER story: rookie season to legend",
    tags: ["mycareer", "story", "arena"],
    scene:
      "View from behind a young professional basketball player in a plain warm-up jacket walking out of a dark arena tunnel toward a blazing bright packed arena. Camera flashes in the stands, haze in the air, strong rim light silhouette.",
  },
  {
    id: "nba-04",
    preference: "nba",
    title: "Park night run",
    concept: "Neighborhood park court under floodlights with a crowd on the fence",
    offer_hint: "Rep up in the Park: double Rep weekend and streetwear drops",
    tags: ["park", "rep", "streetball"],
    scene:
      "An outdoor neighborhood basketball park at night under bright floodlights. A streetball player crosses over a defender while a crowd presses against the chain-link fence cheering. Wet asphalt reflections, graffiti-free brick walls.",
  },
  // ---------------- WNBA ----------------
  {
    id: "wnba-01",
    preference: "wnba",
    title: "Logo-range pull-up",
    concept: "A women's pro guard pulling up from deep in a packed arena",
    offer_hint: "The W franchise mode featuring Caitlin Clark: build your dynasty",
    tags: ["the-w", "franchise", "shooting"],
    scene:
      "A women's professional basketball game in a packed modern arena. A generic fictional female point guard in a plain colored uniform rises for a deep three-point pull-up far behind the arc, ball at release point, defender closing out. Crowd on its feet, arena lights.",
  },
  {
    id: "wnba-02",
    preference: "wnba",
    title: "Franchise draft night",
    concept: "A women's team front office on draft night, GM at the board",
    offer_hint: "Run a W front office: draft, trade and manage the cap",
    tags: ["the-w", "front-office", "draft"],
    scene:
      "A women's basketball franchise front office on draft night. A confident female general manager stands at a glowing digital draft board with abstract player silhouettes (no readable text), staff around a table with laptops, energetic focused mood.",
  },
  {
    id: "wnba-03",
    preference: "wnba",
    title: "Signature sneaker drop",
    concept: "Hero shot of signature basketball sneakers on hardwood, no logos",
    offer_hint: "Gear up: signature sneaker drop for your W MyPLAYER",
    tags: ["the-w", "gear", "sneakers"],
    scene:
      "A dramatic product hero shot of a pair of sleek, unbranded high-performance basketball sneakers resting on a polished hardwood court, a basketball beside them, spotlight from above and soft colored arena haze in the background. No logos or text on the shoes.",
  },
  {
    id: "wnba-04",
    preference: "wnba",
    title: "Championship confetti",
    concept: "A women's team celebrating a title under falling confetti",
    offer_hint: "Chase the ring: guided rookie-season storyline in The W",
    tags: ["the-w", "championship", "celebration"],
    scene:
      "A women's professional basketball team celebrating a championship at center court under a shower of falling confetti, players hugging and shouting, a generic trophy raised, packed arena crowd in the background. Plain uniforms with no lettering.",
  },
  // ---------------- College ----------------
  {
    id: "college-01",
    preference: "college",
    title: "Student section roar",
    concept: "Campus arena, painted student section going wild on a big shot",
    offer_hint: "College hoops: campus atmospheres and rivalry nights",
    tags: ["college", "campus", "student-section"],
    scene:
      "A college basketball arena on rivalry night. In the foreground, a roaring student section with painted faces and arms raised; on court a generic college player celebrates a made shot. Bright gym lights, colorful but logo-free banners.",
  },
  {
    id: "college-02",
    preference: "college",
    title: "Bracket buzzer-beater",
    concept: "A tournament buzzer-beater as the clock hits zero",
    offer_hint: "Bracket chaos: chase a March Madness style run",
    tags: ["college", "tournament", "buzzer-beater"],
    scene:
      "A college tournament game at the final buzzer. A generic college guard releases a desperate long shot as the arena holds its breath; the backboard edge glows red, teammates on the bench leaping up. Motion blur, tense dramatic lighting.",
  },
  {
    id: "college-03",
    preference: "college",
    title: "Recruiting visit",
    concept: "A recruit's official visit: locker room with a jersey waiting",
    offer_hint: "Recruit and build a program from the ground up",
    tags: ["college", "recruiting", "program"],
    scene:
      "A sleek college basketball locker room on a recruiting visit. A young recruit in a hoodie looks at a plain team jersey hanging in a lit locker with no lettering, a coach with a clipboard beside them, warm spotlights and wood paneling.",
  },
  {
    id: "college-04",
    preference: "college",
    title: "Draft night stage",
    concept: "From campus to the pros: a college star walking the draft stage",
    offer_hint: "Carry your college player into the NBA Draft and MyCAREER",
    tags: ["college", "draft", "mycareer"],
    scene:
      "A young basketball player in a sharp suit walks across a brightly lit draft-night stage toward a podium, family cheering in the front rows, cameras and stage lights. No logos or text on the stage or backdrop.",
  },
];

const PREFIX = "v2/content-library";

interface ManifestFormat {
  url: string;
  gs_uri: string;
  object: string;
  mime_type: string;
  bytes: number;
  model: string;
}

interface ManifestAsset extends Omit<AssetBrief, "scene"> {
  prompt: string;
  formats: Record<string, ManifestFormat>;
}

interface Manifest {
  version: 1;
  generated_at: string;
  bucket: string;
  prefix: string;
  formats: string[];
  assets: ManifestAsset[];
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

  const storage = new Storage({ projectId: GCP_CONFIG.projectId });
  const bucketName = GCP_CONFIG.gcsBucketName;
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) throw new Error(`GCS bucket gs://${bucketName} does not exist`);

  // Load the existing manifest so reruns only fill gaps.
  const manifestFile = bucket.file(`${PREFIX}/manifest.json`);
  let manifest: Manifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    bucket: bucketName,
    prefix: PREFIX,
    formats: FORMATS,
    assets: [],
  };
  const [mExists] = await manifestFile.exists();
  if (mExists && !force) {
    const [buf] = await manifestFile.download();
    manifest = JSON.parse(buf.toString("utf8"));
  }
  const byId = new Map(manifest.assets.map((a) => [a.id, a]));

  const todo = LIBRARY.filter((b) => !only || b.id === only);
  const writeManifest = async () => {
    manifest.generated_at = new Date().toISOString();
    manifest.assets = LIBRARY.map((b) => byId.get(b.id)).filter(Boolean) as ManifestAsset[];
    await manifestFile.save(JSON.stringify(manifest, null, 2), {
      contentType: "application/json",
      resumable: false,
      metadata: { cacheControl: "no-cache" },
    });
  };

  const genOne = async (brief: AssetBrief) => {
    const prompt = `${STYLE}\n${brief.scene}\n${GUARDRAILS}`;
    const existing = byId.get(brief.id);
    const entry: ManifestAsset = existing && !force
      ? existing
      : {
          id: brief.id,
          preference: brief.preference,
          title: brief.title,
          concept: brief.concept,
          offer_hint: brief.offer_hint,
          tags: brief.tags,
          prompt,
          formats: {},
        };
    let masterB64: string | null = null;
    let masterMime = "image/png";

    for (const fmt of FORMATS) {
      if (entry.formats[fmt] && !force) {
        if (fmt === "16:9") {
          const [buf] = await bucket.file(entry.formats[fmt].object).download();
          masterB64 = buf.toString("base64");
          masterMime = entry.formats[fmt].mime_type;
        }
        continue;
      }
      const t0 = Date.now();
      const res =
        fmt === "16:9" || !masterB64
          ? await generateImage({ prompt, aspectRatio: fmt })
          : await generateImage({
              prompt: `Recompose the reference image as a ${fmt} frame. Keep the exact same scene, subjects, wardrobe, lighting and color grade; reframe and extend the background naturally for the new aspect ratio.\n${GUARDRAILS}`,
              aspectRatio: fmt,
              referenceImageBase64: masterB64,
              referenceMimeType: masterMime,
            });
      const ext = EXT[res.mimeType];
      if (!ext) throw new Error(`${brief.id} ${fmt}: unsupported mime ${res.mimeType}`);
      const object = `${PREFIX}/${brief.preference}/${formatSlug(fmt)}/${brief.id}.${ext}`;
      await bucket.file(object).save(res.bytes, {
        contentType: res.mimeType,
        resumable: false,
        metadata: {
          cacheControl: "public, max-age=86400",
          metadata: { asset_id: brief.id, preference: brief.preference, format: fmt, model: res.modelUsed },
        },
      });
      entry.formats[fmt] = {
        url: `https://storage.googleapis.com/${bucketName}/${object}`,
        gs_uri: `gs://${bucketName}/${object}`,
        object,
        mime_type: res.mimeType,
        bytes: res.bytes.byteLength,
        model: res.modelUsed,
      };
      if (fmt === "16:9") {
        masterB64 = res.bytes.toString("base64");
        masterMime = res.mimeType;
      }
      console.log(`  ✓ ${brief.id} ${fmt} ${res.modelUsed} ${(res.bytes.byteLength / 1024).toFixed(0)}KB ${Date.now() - t0}ms`);
    }
    byId.set(brief.id, entry);
    await writeManifest();
  };

  // 3 assets in flight (each runs its 4 formats sequentially off the master).
  const queue = [...todo];
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const b = queue.shift()!;
      console.log(`→ ${b.id} (${b.preference}) ${b.title}`);
      await genOne(b);
    }
  });
  await Promise.all(workers);
  await writeManifest();
  const total = manifest.assets.reduce((n, a) => n + Object.keys(a.formats).length, 0);
  console.log(`\nManifest gs://${bucketName}/${PREFIX}/manifest.json · ${manifest.assets.length} assets · ${total} images`);
}

main().catch((e) => {
  console.error("\n✗ content library generation FAILED:", e?.message || e);
  process.exit(1);
});
