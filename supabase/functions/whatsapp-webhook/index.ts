// Edge Function pública: whatsapp-webhook
//
// Fase 1 (esta issue): apenas o handshake do WhatsApp Cloud API.
//   - GET  → verificação do webhook (hub.mode / hub.verify_token / hub.challenge).
//   - POST → validação da assinatura X-Hub-Signature-256 sobre o corpo BRUTO.
//            Quando a assinatura é válida, respondemos 200 SEM processar o conteúdo.
//
// Fase 2 (próxima issue): o processamento real das mensagens recebidas será
// adicionado dentro do bloco do POST, depois da validação da assinatura.
//
// Docs Meta:
//   https://developers.facebook.com/docs/graph-api/webhooks/getting-started
//   https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

/** HMAC-SHA256 do corpo bruto com a chave fornecida, retornado em hex. */
async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Comparação de tempo constante entre duas strings hex de mesmo comprimento. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ---------------------------------------------------------------------------
  // GET → Handshake de verificação do Meta.
  // ---------------------------------------------------------------------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    if (mode === "subscribe" && expectedToken && verifyToken === expectedToken) {
      // Responder o desafio em TEXTO PURO (não JSON, sem aspas).
      return new Response(challenge ?? "", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // ---------------------------------------------------------------------------
  // POST → Entrega de eventos. Validar X-Hub-Signature-256 sobre o corpo BRUTO.
  // ---------------------------------------------------------------------------
  if (req.method === "POST") {
    // O corpo precisa ser lido EXATAMENTE como recebido (sem reparse/reserialize),
    // caso contrário a assinatura não confere.
    const rawBody = await req.text();

    const signatureHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("META_APP_SECRET");

    if (!signatureHeader || !appSecret) {
      return new Response(JSON.stringify({ error: "Missing signature or app secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Header chega no formato "sha256=<hmac_hex>".
    const receivedSignature = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice("sha256=".length)
      : signatureHeader;

    const expectedSignature = await hmacSha256Hex(appSecret, rawBody);

    if (!timingSafeEqual(receivedSignature, expectedSignature)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assinatura válida.
    // FASE 2: o processamento das mensagens (JSON.parse(rawBody) e roteamento dos
    // eventos do WhatsApp) será adicionado AQUI. Nesta fase apenas confirmamos o
    // recebimento com 200, sem efeitos colaterais (idempotente por natureza).
    console.log("whatsapp-webhook: entrega válida recebida (não processada nesta fase)");

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---------------------------------------------------------------------------
  // Demais métodos não são suportados.
  // ---------------------------------------------------------------------------
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
