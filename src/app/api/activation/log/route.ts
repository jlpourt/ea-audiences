import { NextRequest, NextResponse } from "next/server";
import { listActivations } from "@/lib/gcp/bigquery-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const records = await listActivations(limit);

    return NextResponse.json({
      ok: true,
      records,
      count: records.length,
      source: "live_bigquery",
    });
  } catch (error: any) {
    console.error("[activation-log] Route error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to list activations from BigQuery" },
      { status: 500 }
    );
  }
}
