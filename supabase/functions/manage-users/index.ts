import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCrmRole } from "../_shared/authorize.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Autorização: listar, convidar e apagar usuários exige papel proprietário
    // ou admin em user_roles, verificado no servidor (regra em _shared/authorize.ts).
    const callerRole = await getCrmRole(adminClient, userData.user.id);
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    if (action === "list") {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 100 });
      if (error) throw error;

      // Papel de cada usuário vai junto, para a tela não precisar de outra consulta.
      const { data: roles, error: rolesError } = await adminClient
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;
      const roleByUser = new Map<string, string>(
        (roles ?? []).map((r: { user_id: string; role: string }) => [r.user_id, r.role]),
      );

      const users = (data?.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        role: roleByUser.get(u.id) ?? null,
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invite") {
      const { email } = params;
      if (!email) throw new Error("Email é obrigatório");

      const { error } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = params;
      if (!user_id) throw new Error("user_id é obrigatório");

      // O proprietário nunca é removido (o banco também recusa via trigger).
      const targetRole = await getCrmRole(adminClient, user_id);
      if (targetRole === "proprietario") {
        return new Response(JSON.stringify({ error: "O proprietário não pode ser removido" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
