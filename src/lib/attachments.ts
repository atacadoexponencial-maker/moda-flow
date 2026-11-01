// Regras de anexo das atividades (SUP-S1-04). O banco impõe os mesmos limites
// (migration 20261101150000_activity_attachments.sql); aqui só antecipamos o
// aviso para a pessoa antes do envio.

export const ATTACHMENTS_BUCKET = 'activity-attachments';
export const MAX_ATTACHMENTS_PER_ACTIVITY = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface RejectedFile {
  name: string;
  reason: string;
}

export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME as readonly string[]).includes(mime);
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith('image/');
}

/** Tamanho legível para o aviso e para a linha do tempo. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Separa os arquivos escolhidos em aceitos e recusados (com o motivo), respeitando
 * tipo, tamanho e o total por atividade considerando os já selecionados.
 */
export function validateAttachments<T extends FileLike>(
  alreadySelected: number,
  files: T[],
): { accepted: T[]; rejected: RejectedFile[] } {
  const accepted: T[] = [];
  const rejected: RejectedFile[] = [];
  let slots = MAX_ATTACHMENTS_PER_ACTIVITY - alreadySelected;
  for (const f of files) {
    if (!isAllowedMime(f.type)) {
      rejected.push({ name: f.name, reason: 'Tipo não aceito. Envie imagem (JPG, PNG, WEBP, GIF) ou PDF.' });
      continue;
    }
    if (f.size <= 0 || f.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({ name: f.name, reason: `Arquivo acima de ${formatBytes(MAX_ATTACHMENT_BYTES)}.` });
      continue;
    }
    if (slots <= 0) {
      rejected.push({ name: f.name, reason: `Máximo de ${MAX_ATTACHMENTS_PER_ACTIVITY} anexos por atividade.` });
      continue;
    }
    accepted.push(f);
    slots--;
  }
  return { accepted, rejected };
}

/** Uma atividade pode ser salva com texto, com arquivos, ou com os dois. */
export function canSubmitActivity(text: string, filesCount: number): boolean {
  return text.trim().length > 0 || filesCount > 0;
}

/** Caminho do objeto no bucket: lead/atividade/arquivo, sem caracteres problemáticos. */
export function buildAttachmentPath(leadId: string, activityId: string, fileName: string, nonce: string): string {
  const safe = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  return `${leadId}/${activityId}/${nonce}-${safe}`;
}
