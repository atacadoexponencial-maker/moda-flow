# Spec: Dashboard em 3 Abas (Geral, Marketing, Vendas)

## Visão Geral

Reestruturar o dashboard do CRM em três abas — **Geral**, **Marketing** e **Vendas** — para que cada área do negócio tenha uma visão dedicada: a gestão acompanha volume e custo de cada etapa do funil (Geral), o time de tráfego avalia retorno por funil, campanha, conjunto e criativo (Marketing), e o time comercial acompanha reuniões da semana, no-shows e propostas (Vendas). Hoje tudo está numa única página, misturando métricas de aquisição e de vendas, sem visão de custo por etapa nem detalhamento por conjunto/criativo.

## Análise do Estado Atual

### O que já existe e será reutilizado

- **Dashboard atual** (`src/pages/DashboardPage.tsx`): página única com 5 KPIs (Arrecadado, Total de Leads, MQLs, SQLs, Compras), gráfico de funil (`FunnelChart`), tabela de investimento/aquisições/retornos por funil e gráfico de origem de leads (`LeadSourceChart`). Filtros de período (7d/30d/mês/90d) e de funil.
- **`leads`**: flags `mql`, `sql_flag`, `ra_flag` (reunião agendada), `rr_flag` (reunião realizada), `data_ra`, `status` (inclui `proposta_negociacao`, `contrato`, `contrato_assinado`, `proposta_recusada`), `oportunidade`, `arrecadado`, `loss_reason`, `funil`, UTMs, `meta_campaign_id`, `meta_ad_id`.
- **`lead_touches`**: cada entrada de lead com `is_aquisicao` (novo vs. retorno), `funil`, `utm_campaign`, `utm_content`, `meta_campaign_id`, `meta_ad_id` — base para "novos vs. que voltaram".
- **`meta_ads_cache`**: investimento diário do Meta Ads **apenas no nível de campanha** (spend, clicks, impressions), sincronizado pela função `meta-fetch-insights` (level=campaign).
- **`funnel_campaigns`**: vínculo manual campanha → funil.
- **`activities`**: histórico por lead com `type`/`content` genéricos (hoje usado para `status_change`).
- **`src/lib/dashboard-utils.ts`**: `computeFunnelMetrics` já calcula investimento, CPL, novos pagos/orgânicos e retornos por funil, com atribuição por token no nome da campanha e vínculo manual.

### Gaps — dados que não existem hoje

1. **Data da reunião realizada**: existe `rr_flag` mas nenhuma data de quando a reunião aconteceu (`data_ra` é da agendada). Sem isso não há "reuniões realizadas NA SEMANA". → Precisa de novo campo de data de realização (preenchido quando a flag RR é marcada).
2. **No-show**: não existe flag nem motivo de no-show em lugar nenhum. → Precisa de campo de no-show + motivo no lead (a flag pode ser importada do Calendly; o motivo é registrado pelo comercial).
3. **Conjuntos (adsets) e criativos (ads)**: o cache do Meta só tem campanha. → Precisa ampliar a sincronização de insights para o nível de anúncio (adset_id/adset_name, ad_id/ad_name) e armazenar esse detalhamento.
4. **ROAS por funil**: derivável — `arrecadado` dos leads por `funil` ÷ investimento do funil — mas não é calculado hoje.
5. **Custo por MQL / RA / RR**: derivável — investimento ÷ contagem de cada flag — mas não é calculado hoje.
6. **Agendamentos do Calendly**: as reuniões são agendadas pelo Calendly, mas nada chega ao CRM — RA é marcada manualmente. → Integração via webhook do Calendly (token já disponível em variável de ambiente; em produção vira secret do backend, nunca exposto no frontend).

## Páginas / Módulos

### Aba Geral

**Descrição:** Visão executiva do período: volume de leads (novos e que voltaram), MQLs, reuniões agendadas e realizadas, e o custo unitário de cada etapa (CPL, custo por MQL, custo por RA, custo por RR), sempre comparando com o período anterior.

**Componentes:**
- Seletor de abas (Geral / Marketing / Vendas): alterna a visão exibida, mantendo os filtros.
- Filtro de período: 7 dias, 30 dias, este mês, 90 dias.
- Filtro de funil: todos ou um funil específico.
- Cartão "Leads novos": quantidade de aquisições no período e variação vs. período anterior.
- Cartão "Leads que voltaram": quantidade de retornos no período e variação.
- Cartão "MQLs": quantidade e variação.
- Cartão "Reuniões agendadas (RA)": quantidade e variação.
- Cartão "Reuniões realizadas (RR)": quantidade e variação.
- Linha de custos: CPL, custo por MQL, custo por RA e custo por RR do período (investimento ÷ contagem de cada métrica), cada um com variação vs. período anterior.
- Gráfico de funil de conversão: leads → MQL → RA → RR → contrato no período.

**Comportamentos:**
- Trocar de aba: exibe o conteúdo da aba escolhida sem recarregar a página e preserva período/funil selecionados.
- Selecionar período: recalcula todos os cartões, custos e o gráfico.
- Selecionar funil: restringe todos os números ao funil escolhido.
- Ver métrica sem dados: cartão exibe zero e custo exibe "—" quando não há investimento ou contagem.

### Aba Marketing

**Descrição:** Visão do tráfego pago e orgânico: resultado por funil (investimento, leads, CPL, arrecadado, ROAS) e ranking de melhores campanhas, conjuntos e criativos com custo por lead de cada um.

**Componentes:**
- Tabela "Resultados por funil": por funil — investimento, leads novos pagos, leads orgânicos, retornos, CPL, arrecadado atribuído e ROAS (arrecadado ÷ investimento), com linha de total.
- Tabela "Melhores campanhas": por campanha — investimento, leads gerados, CPL, ordenada do melhor para o pior.
- Tabela "Melhores conjuntos": por conjunto de anúncios — investimento, leads gerados, CPL.
- Tabela "Melhores criativos": por anúncio/criativo — investimento, leads gerados, CPL.
- Gráfico de origem de leads: distribuição por fonte (utm_source).
- Indicador de última sincronização com o Meta Ads.

**Comportamentos:**
- Selecionar período: recalcula todas as tabelas e o gráfico.
- Selecionar funil: filtra as tabelas de campanhas/conjuntos/criativos para o funil escolhido.
- Ordenar tabela de ranking: alterna a ordenação por investimento, leads ou CPL.
- Ver campanha sem leads atribuídos: linha aparece com leads = 0 e CPL = "—".
- Ver funil sem investimento: ROAS e CPL exibem "—".

### Aba Vendas

**Descrição:** Visão operacional do comercial: reuniões realizadas na semana com os respectivos clientes, motivos de no-show e o quadro de propostas (fechadas e quentes) com valores.

**Componentes:**
- Seletor de semana: semana atual por padrão, com navegação para semanas anteriores.
- Lista "Reuniões realizadas na semana": nome do cliente, funil de origem, data da reunião e link para o painel do lead.
- Cartão-resumo da semana: total de reuniões agendadas, realizadas e taxa de comparecimento.
- Lista "No-shows": leads que não compareceram no período, com o motivo registrado.
- Gráfico "Motivos de no-show": distribuição dos motivos no período.
- Quadro "Propostas fechadas": leads com contrato assinado no período, com valor arrecadado e total.
- Quadro "Propostas quentes": leads em proposta/negociação ou contrato (em andamento), com valor de oportunidade e total.

**Comportamentos:**
- Navegar entre semanas: recarrega reuniões, no-shows e propostas da semana escolhida.
- Clicar em um cliente: abre o painel do lead correspondente.
- Ver semana sem reuniões: lista exibe mensagem de vazio.
- Ver no-show sem motivo registrado: linha aparece com motivo "não informado".

### Integração Calendly (agendamentos automáticos)

**Descrição:** Conecta o Calendly ao CRM: cada reunião agendada, cancelada ou marcada como no-show no Calendly reflete automaticamente no lead correspondente, alimentando a aba Geral (RA) e a aba Vendas sem digitação manual.

**Componentes:**
- Receptor de eventos do Calendly: ponto de entrada no backend que recebe os avisos de agendamento e cancelamento.
- Casamento com o lead: o convidado é associado ao lead pelo e-mail (e telefone, quando disponível), usando a mesma regra de identidade já existente no CRM.
- Registro da reunião: data/hora do evento agendado, vinculada ao lead.
- Histórico no lead: cada agendamento, reagendamento e cancelamento vira uma entrada no histórico do lead.

**Comportamentos:**
- Receber agendamento: marca a reunião agendada no lead com a data/hora do evento.
- Receber agendamento de pessoa desconhecida: registra o evento para conciliação posterior, sem criar lead automaticamente.
- Receber cancelamento: desfaz a marcação de reunião agendada e registra o cancelamento no histórico.
- Receber reagendamento: atualiza a data da reunião e registra a mudança no histórico.
- Importar no-show do Calendly: quando o organizador marca falta no Calendly, o lead recebe a marcação de no-show (motivo permanece a ser registrado no CRM).
- Falha de casamento por identidade divergente: evento fica pendente de conciliação, visível para ajuste manual.

### Registro de Reunião e No-show (painel do lead)

**Descrição:** Captura dos dados que alimentam a aba Vendas: quando a reunião foi realizada e, em caso de falta, o motivo do no-show. Complementa a integração com o Calendly (que traz o agendamento e a falta automaticamente).

**Componentes:**
- Campo de data da reunião realizada: preenchido automaticamente com a data atual ao marcar "reunião realizada", editável.
- Marcador de no-show: indica que o lead faltou à reunião agendada (pode vir preenchido pela integração).
- Campo de motivo do no-show: lista de motivos padronizados + opção de texto livre.

**Comportamentos:**
- Marcar reunião realizada: registra a data de realização.
- Corrigir data da reunião: usuário ajusta a data manualmente.
- Marcar no-show: exige a escolha de um motivo antes de salvar.
- Registrar motivo de no-show vindo da integração: usuário complementa o motivo de um no-show importado do Calendly.
- Desmarcar no-show: limpa o motivo registrado.

### Sincronização de conjuntos e criativos (Meta Ads)

**Descrição:** Ampliação da coleta de dados do Meta Ads para trazer investimento também por conjunto de anúncios e por anúncio/criativo, alimentando os rankings da aba Marketing.

**Componentes:**
- Dados diários por anúncio: campanha, conjunto, anúncio, investimento, cliques, impressões.

**Comportamentos:**
- Sincronizar dados: atualiza o detalhamento por conjunto/criativo junto com a sincronização de campanhas já existente.
- Atribuir lead a criativo: leads são associados ao anúncio/conjunto pelos identificadores de rastreamento já capturados na entrada do lead.
