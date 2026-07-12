import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "participant";

export async function fetchSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function fetchRoles(userId: string): Promise<Role[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.role as Role);
}

export async function fetchActiveEvent() {
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
