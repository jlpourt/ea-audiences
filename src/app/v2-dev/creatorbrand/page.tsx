"use client";

/** Dev harness for the CreatorBrand cards (not linked from the app). */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandAttachCard, CreatorEngagementCard, CreatorHubsViz, SocialHopsViz } from "@/components/v2/creatorbrand";

function Inner() {
  const q = useSearchParams();
  const from = q.get("from") || undefined;
  const to = q.get("to") || undefined;
  const pid = q.get("player_id");
  return (
    <main className="v2-root min-h-screen p-8">
      <div className="mx-auto grid max-w-[1280px] gap-6 lg:grid-cols-2">
        <CreatorEngagementCard />
        <BrandAttachCard playerId={pid} />
        <SocialHopsViz from={from} to={to} />
        <CreatorHubsViz />
      </div>
    </main>
  );
}

export default function CreatorBrandDevPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
