import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { fetchRoles, type Role } from "./auth-helpers";

export type SessionState = {
  session: Session | null;
  roles: Role[];
  loading: boolean;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, roles: [], loading: true });

  useEffect(() => {
    let mounted = true;
    async function load(session: Session | null) {
      if (!mounted) return;
      if (!session) {
        setState({ session: null, roles: [], loading: false });
        return;
      }
      const roles = await fetchRoles(session.user.id);
      if (!mounted) return;
      setState({ session, roles, loading: false });
    }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export const isAdmin = (roles: Role[]) => roles.includes("admin");
