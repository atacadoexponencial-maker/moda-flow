# 13: Integração Calendly — Webhook de agendamentos

**Tipo:** Implementação
**Página:** Integração Calendly

## Descrição

Criar a Edge Function que recebe webhooks do Calendly (`invitee.created`, `invitee.canceled`): casa o convidado com o lead por e-mail/telefone usando a regra de identidade existente, marca reunião agendada (RA) com a data/hora do evento, trata cancelamento/reagendamento e registra tudo como activities. Eventos sem lead correspondente ficam registrados para conciliação, sem criar lead. Inclui o registro do webhook no Calendly via API (token como secret do Supabase) e a assinatura/validação dos eventos recebidos.
