import { NextResponse } from "next/server";
import { listSavedAudiences } from "@/lib/gcp/bigquery-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const audiences = await listSavedAudiences(50);
    return NextResponse.json({
      ok: true,
      dataset: "twok_marketing_intelligence.saved_audiences",
      audiences,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), audiences: [] },
      { status: 500 }
    );
  }
}
