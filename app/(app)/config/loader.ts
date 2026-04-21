/**
 * Loader compartido por las secciones de /config. Usa `React.cache` para
 * que múltiples renders en la misma request (layout + page) reusen la
 * misma query en vez de duplicarla.
 */
import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppUser, ConfigNegocio } from "@/lib/supabase/types";

export const cargarConfigYUsuario = cache(async () => {
  const supabase = await createClient();
  const auth = await supabase.auth.getUser();
  if (!auth.data.user) redirect("/login");

  const [configRes, meRes] = await Promise.all([
    supabase.from("config_negocio").select("*").limit(1).maybeSingle(),
    supabase
      .from("app_users")
      .select("*")
      .eq("auth_user_id", auth.data.user.id)
      .maybeSingle(),
  ]);

  return {
    config: (configRes.data as ConfigNegocio | null) ?? null,
    me: (meRes.data as AppUser | null) ?? null,
  };
});
