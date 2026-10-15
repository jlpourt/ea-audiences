"use client";

/** TEMPORARY dev harness for <Player360 /> in isolation. Not linked from the app. */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Player360 } from "@/components/v2/player360";

function Harness() {
  const sp = useSearchParams();
  const id = sp.get("id");
  const stage = (sp.get("stage") as any) ?? "ego";
  return (
    <div className="v2-root h-screen w-screen" data-theme="dark">
      <Player360 playerId={id} initialStage={stage} onAct={(ctx) => console.log("[v2-dev] act", ctx)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}
