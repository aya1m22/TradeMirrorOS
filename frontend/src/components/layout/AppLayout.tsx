import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Shell for the internal application: fixed sidebar + top bar, with routed
 * pages rendered into the scrollable content column.
 */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-5 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
