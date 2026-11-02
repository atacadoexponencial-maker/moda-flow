// Janela de 24 horas do WhatsApp (SUP-S2-02): contada a partir da última
// mensagem recebida do lead registrada no CRM. Sem mensagem recebida: fechada.
// Usado pelo envio (backend) e pela tela.

export const WINDOW_HOURS = 24;

export interface WindowState {
  open: boolean;
  closesAt: string | null; // ISO, quando aberta
}

export function windowState(lastInboundAt: string | null | undefined, now: Date = new Date()): WindowState {
  if (!lastInboundAt) return { open: false, closesAt: null };
  const t = new Date(lastInboundAt).getTime();
  if (Number.isNaN(t)) return { open: false, closesAt: null };
  const closes = t + WINDOW_HOURS * 60 * 60 * 1000;
  return closes > now.getTime() ? { open: true, closesAt: new Date(closes).toISOString() } : { open: false, closesAt: null };
}
