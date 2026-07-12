import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Settings, Users, Award, ListChecks, Activity, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/vote" });
  },
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/settings", label: "Event", icon: Settings },
  { to: "/admin/challenges", label: "Challenges", icon: Award },
  { to: "/admin/criteria", label: "Criteria", icon: ListChecks },
  { to: "/admin/teams", label: "Teams & Projects", icon: Users },
  { to: "/admin/monitor", label: "Monitor", icon: Activity },
  { to: "/admin/results", label: "Results", icon: Trophy },
];

function AdminLayout() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 max-w-7xl">
      <div className="mb-6 flex gap-1 overflow-x-auto no-scrollbar border-b border-border/60 pb-1">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-2 whitespace-nowrap"
            activeProps={{ className: "text-foreground bg-accent/15" }}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
