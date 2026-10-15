import { PersonalizationFlow } from "@/components/v2/concept/PersonalizationFlow";

export const dynamic = "force-dynamic";

/** Dev-only harness for Section D (port 3105). */
export default function ConceptDevPage() {
  return (
    <main className="v2-root h-screen w-screen p-5">
      <PersonalizationFlow />
    </main>
  );
}
