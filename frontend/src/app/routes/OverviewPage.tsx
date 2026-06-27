import { FileText, Building2, Contact, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui";
import { ROUTES } from "@/config/routes";

/**
 * Landing surface for the internal workspace. In Phase 1 it orients the user
 * toward the core flow; live figures and the trade list arrive with the
 * trades module.
 */
export function OverviewPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wider text-brass-600">
          Chipa Farm · Internal Operations
        </p>
        <h1 className="text-3xl font-semibold">Workspace overview</h1>
        <p className="max-w-2xl text-ink-500">
          Turn a supplier contract into a mirrored sales contract — preserving every
          cargo specification, replacing only the seller identity, banking, contact, and
          price.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <ShortcutCard
          to={ROUTES.trades}
          icon={FileText}
          title="Trades"
          body="Create a trade, upload the Frigo contract, and generate the mirror."
        />
        <ShortcutCard
          to={ROUTES.clients}
          icon={Building2}
          title="Clients"
          body="Buyer records that populate the sales contract."
        />
        <ShortcutCard
          to={ROUTES.contacts}
          icon={Contact}
          title="Contacts"
          body="Your team's details, shown to clients in place of the supplier's."
        />
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Start a new trade</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              The contract generation flow comes online in a later step.
            </p>
          </div>
          <Link
            to={ROUTES.tradeNew}
            className="inline-flex h-10 items-center gap-2 rounded bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
          >
            New trade <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-surface p-5 shadow-card transition-colors duration-150 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="flex items-center gap-1 text-base font-semibold text-ink-900">
        {title}
        <ArrowRight className="h-4 w-4 -translate-x-1 text-ink-300 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
      </h3>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </Link>
  );
}
