# Decisão: RLS de `leads` e `activities` compartilhado entre todos os usuários

**Data:** 2026-11-01
**Quem decidiu:** Marcelle (proprietária do projeto)

## Decisão

As policies de `leads`, `activities` e `lead_touches` continuam `USING (true)` para
qualquer usuário autenticado: todo mundo do time vê, cria, edita e apaga qualquer lead.

## Motivo

O CRM é de uso interno de um time pequeno e de confiança. Restringir por dono do lead
exige o campo de responsável, que ainda não existe (entra no item "operação comercial
mínima" do roteiro). Fechar antes disso só criaria atrito sem ganho real.

## Quando revisitar

Quando o lead ganhar responsável (`assigned_to`), avaliar:
- apagar lead só para admin;
- editar restrito ao responsável ou admin, se o time crescer.

O que **não** está coberto por esta decisão e já é restrito: `user_roles` (só admin
insere, altera e apaga), configurações de integrações (Meta, WhatsApp, webhook) e as
Edge Functions privilegiadas (`manage-users`, `clear-crm`), que exigem admin no servidor.
