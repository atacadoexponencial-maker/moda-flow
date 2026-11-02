// Mídia recebida (S2-02): baixa da Meta e guarda no bucket privado.
// Módulo puro: `fetch` e `upload` injetados.
import { GRAPH, type FetchLike } from "./whatsapp-graph.ts";

export const MEDIA_BUCKET = "whatsapp-media";
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // SUP-S2-04

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

export function extensionFor(mime: string | null | undefined, filename?: string | null): string {
  const base = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (EXT[base]) return EXT[base];
  const fromName = filename?.split(".").pop();
  return fromName && /^[a-z0-9]{1,5}$/i.test(fromName) ? fromName.toLowerCase() : "bin";
}

export function mediaPath(leadId: string, wamid: string, mime: string | null, filename?: string | null): string {
  const safeId = wamid.replace(/[^A-Za-z0-9_-]/g, "").slice(-40) || crypto.randomUUID();
  return `${leadId}/${safeId}.${extensionFor(mime, filename)}`;
}

export type MediaResult =
  | { status: "ok"; path: string; mime: string; size: number }
  | { status: "grande_demais"; size: number }
  | { status: "falhou"; error: string };

/**
 * Busca a URL da mídia na Graph (`GET /{media_id}`), baixa com o mesmo token e
 * envia ao armazenamento. A URL da Meta vale poucos minutos.
 */
export async function storeInboundMedia(params: {
  fetch: FetchLike;
  token: string;
  mediaId: string;
  leadId: string;
  wamid: string;
  filename?: string | null;
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
}): Promise<MediaResult> {
  const { fetch: f, token, mediaId } = params;
  try {
    const metaRes = await f(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number; error?: { message?: string } };
    if (!metaRes.ok || !meta.url) return { status: "falhou", error: meta.error?.message ?? `Erro ${metaRes.status} ao consultar a mídia` };
    if (typeof meta.file_size === "number" && meta.file_size > MAX_MEDIA_BYTES) return { status: "grande_demais", size: meta.file_size };
    if (!meta.url.startsWith("https://")) return { status: "falhou", error: "URL de mídia inválida" };

    const fileRes = await f(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!fileRes.ok) return { status: "falhou", error: `Erro ${fileRes.status} ao baixar a mídia` };
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    if (bytes.byteLength > MAX_MEDIA_BYTES) return { status: "grande_demais", size: bytes.byteLength };

    const mime = (meta.mime_type ?? fileRes.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
    const path = mediaPath(params.leadId, params.wamid, mime, params.filename);
    await params.upload(path, bytes, mime);
    return { status: "ok", path, mime, size: bytes.byteLength };
  } catch (e) {
    return { status: "falhou", error: e instanceof Error ? e.message : String(e) };
  }
}
