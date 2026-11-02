// Edge Function pública: whatsapp-webhook (S2-02)
//  - GET: handshake de verificação da Meta (hub.verify_token).
//  - POST: valida X-Hub-Signature-256 com o segredo do app do CRM interno
//    (WHATSAPP_APP_SECRET), responde 200 imediatamente e processa em segundo
//    plano: mensagens recebidas (lead conhecido ou novo, mídia) e status.
// Eventos de outro número (ex.: o mesmo número assinado por outro app em
// testes) são ignorados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.0";
import { parseWebhook, verifySignature, type InboundMessage, type StatusUpdate } from "../_shared/whatsapp-inbound.ts";
import { storeInboundMedia, MEDIA_BUCKET } from "../_shared/whatsapp-media.ts";
import { metaErrorPt } from "../_shared/whatsapp-errors.ts";
import { readWhatsAppToken } from "../_shared/edge.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function handleMessage(db: ReturnType<typeof admin>, token: string | null, m: InboundMessage) {
  const { data, error } = await db.rpc("whatsapp_ingest_message", {
    p_phone_number_id: m.phone_number_id,
    p_from: m.from,
    p_profile_name: m.profile_name,
    p_wamid: m.wamid,
    p_type: m.type,
    p_content: m.content,
    p_media: m.media,
    p_reply_to_wamid: m.reply_to_wamid,
    p_ts: m.timestamp,
    p_preview: m.preview,
  });
  if (error) {
    console.error("whatsapp-webhook ingest:", error.message, m.wamid);
    return;
  }
  const r = data as { message_id: string | null; lead_id: string; created: boolean };
  if (!r?.created || !m.media || !r.message_id) return;

  if (!token) {
    await db.from("whatsapp_messages").update({ media_status: "falhou" }).eq("id", r.message_id);
    return;
  }
  const res = await storeInboundMedia({
    fetch,
    token,
    mediaId: m.media.id,
    leadId: r.lead_id,
    wamid: m.wamid,
    filename: m.media.filename,
    upload: async (path, bytes, contentType) => {
      const up = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (up.error) throw new Error(up.error.message);
    },
  });
  const patch =
    res.status === "ok"
      ? { media_status: "ok", media_path: res.path, media_mime: res.mime, media_size: res.size }
      : res.status === "grande_demais"
        ? { media_status: "grande_demais", media_size: res.size }
        : { media_status: "falhou" };
  if (res.status === "falhou") console.warn("whatsapp-webhook mídia:", res.error, m.wamid);
  await db.from("whatsapp_messages").update(patch).eq("id", r.message_id);
}

async function handleStatus(db: ReturnType<typeof admin>, s: StatusUpdate) {
  const err = s.status === "falhou" ? metaErrorPt(s.error_code, s.error_title) : null;
  const { error } = await db.rpc("whatsapp_apply_status", { p_wamid: s.wamid, p_status: s.status, p_error: err });
  if (error) console.error("whatsapp-webhook status:", error.message, s.wamid);
}

async function processPayload(payload: unknown) {
  const db = admin();
  const { data: config } = await db
    .from("whatsapp_config")
    .select("phone_number_id, ativo, vault_secret_id")
    .limit(1)
    .maybeSingle();
  if (!config?.ativo || !config.phone_number_id) return;

  const parsed = parseWebhook(payload, config.phone_number_id);
  if (parsed.messages.length === 0 && parsed.statuses.length === 0) return;

  const token = parsed.messages.some((m) => m.media) ? await readWhatsAppToken(db, config.vault_secret_id) : null;
  for (const m of parsed.messages) await handleMessage(db, token, m);
  for (const s of parsed.statuses) await handleStatus(db, s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const expected = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
    if (url.searchParams.get("hub.mode") === "subscribe" && expected && url.searchParams.get("hub.verify_token") === expected) {
      return text(url.searchParams.get("hub.challenge") ?? "");
    }
    return text("Forbidden", 403);
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Corpo bruto: a assinatura é calculada sobre os bytes exatos recebidos.
  const raw = await req.text();
  const ok = await verifySignature(raw, req.headers.get("x-hub-signature-256"), Deno.env.get("WHATSAPP_APP_SECRET"));
  if (!ok) return json({ error: "Invalid signature" }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const work = processPayload(payload).catch((e) => console.error("whatsapp-webhook:", e));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
  else await work;

  return json({ received: true });
});
