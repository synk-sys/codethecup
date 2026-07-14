import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession, isAdmin } from "@/lib/use-session";
import { Trophy, LogOut, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { roles } = useSession();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const admin = isAdmin(roles);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur bg-background/70">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link to="/" className="flex items-center gap-2 font-black shrink-0">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Trophy className="h-4 w-4" />
              </div>
              <span className="gradient-text hidden sm:inline">Code the Cup</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm min-w-0 overflow-x-auto no-scrollbar">
              <NavLink to="/vote" label="Vote" />
              <NavLink to="/results" label="Results" />
              {admin && (
                <>
                  <span className="mx-2 h-4 w-px bg-border" />
                  <NavLink to="/admin" label="Admin" icon={<LayoutDashboard className="h-3.5 w-3.5" />} />
                  <NavLink to="/admin/settings" label="Settings" icon={<Settings className="h-3.5 w-3.5" />} />
                </>
              )}
            </nav>
          </div>
          <Button size="sm" variant="ghost" onClick={signOut} className="shrink-0">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, label, icon }: { to: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded-lg font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition inline-flex items-center gap-1.5 whitespace-nowrap"
      activeProps={{ className: "text-foreground bg-accent/15" }}
    >
      {icon} {label}
    </Link>
  );
}
