// Tradução dos erros da Meta para linguagem simples (S2-02 status / S2-04 envio).
// Base: crm-exponencial src/lib/whatsapp/motivo-da-falha.ts, mais 130429.

const MESSAGES: Record<number, string> = {
  131047: "Janela de 24 horas fechada. Envie um template.",
  131026: "Este número não pode receber mensagens (sem WhatsApp ou bloqueou a empresa).",
  131049: "A Meta limitou mensagens de marketing para este contato. Tente mais tarde.",
  131051: "Tipo de mensagem não suportado.",
  131053: "Não foi possível enviar o arquivo. Confira o formato e o tamanho.",
  130429: "Limite de envio da Meta atingido. Aguarde alguns minutos e tente de novo.",
  131056: "Muitas mensagens seguidas para este contato. Aguarde e tente de novo.",
  132000: "O número de variáveis não confere com o template.",
  132001: "Template não existe ou não está aprovado neste idioma.",
  132005: "Texto do template ficou longo demais com as variáveis.",
  132007: "O conteúdo viola as políticas do WhatsApp.",
  132012: "Valor de variável inválido (sem quebras de linha, tabulação ou muitos espaços seguidos).",
  132015: "Template pausado pela Meta por baixa qualidade.",
  132016: "Template desativado pela Meta.",
  190: "Token do WhatsApp inválido ou expirado. Reconecte o número em Configurações.",
  100: "Parâmetro inválido enviado à Meta.",
};

export function metaErrorPt(code: number | null | undefined, fallback?: string | null): string {
  if (code != null && MESSAGES[code]) return MESSAGES[code];
  if (fallback && fallback.trim()) return fallback.trim();
  return "A Meta recusou a mensagem.";
}

export function isWindowClosedError(code: number | null | undefined): boolean {
  return code === 131047;
}
