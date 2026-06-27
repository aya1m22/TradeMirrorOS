import { NavLink } from "react-router-dom";
import { navItemsForRole, type NavItem } from "@/config/nav";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cn } from "@/lib/cn";

const GROUPS: NavItem["group"][] = ["Operations", "Settings"];

/**
 * Fixed left rail. Pine surface with a brass active indicator — the brand's
 * one strong color note, kept to the chrome so content stays calm.
 */
export function Sidebar() {
  const { role } = useAuth();
  const items = navItemsForRole(role);
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-brand-800 bg-brand-900 text-brand-100 md:flex">
      <Brand />
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.filter((group) => items.some((i) => i.group === group)).map((group) => (
          <div key={group} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-brand-300/80">
              {group}
            </p>
            <ul className="space-y-0.5">
              {items.filter((i) => i.group === group).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors duration-150",
                        isActive
                          ? "bg-brand-800 text-white"
                          : "text-brand-100/80 hover:bg-brand-800/60 hover:text-white",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r bg-brass-500 transition-all duration-150",
                            isActive ? "w-1 opacity-100" : "w-0 opacity-0",
                          )}
                          aria-hidden
                        />
                        <item.icon className="h-[1.05rem] w-[1.05rem] shrink-0" aria-hidden />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-brand-800 px-5 py-3">
        <p className="font-mono text-[0.68rem] text-brand-300/70">Phase 1 · Internal</p>
      </div>
    </aside>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-brand-800 px-5 py-4">
      {/* Mirror mark: two facing strokes — source ↔ mirrored contract */}
      <span
        className="flex h-8 w-8 items-center justify-center rounded bg-brand-700 font-display text-sm font-bold text-brass-300"
        aria-hidden
      >
        TM
      </span>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold text-white">TradeMirror</p>
        <p className="font-mono text-[0.66rem] uppercase tracking-wider text-brand-300/80">
          Chipa Farm OS
        </p>
      </div>
    </div>
  );
}
