import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui";

/**
 * Stand-in for routes whose features arrive in later build steps. Keeps the
 * shell navigable and honest about what is not yet implemented.
 */
export function PagePlaceholder({ title, step }: { title: string; step: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">
          This area is scaffolded. Its feature module is built in a later step.
        </p>
      </header>
      <EmptyState
        icon={Construction}
        title={`${title} — not yet implemented`}
        description={`Planned for ${step}. The folder and routing exist; the screen is intentionally empty for now.`}
      />
    </div>
  );
}
