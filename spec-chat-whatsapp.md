# Spec: Chat WhatsApp via API oficial da Meta

> série: S2
> estado: aprovada em 2026-11-01

## Visão Geral

O time comercial conversa com os leads pelo WhatsApp, mas hoje isso acontece no celular,
fora do CRM: o histórico não fica no lead, ninguém sabe quem respondeu o quê, e prints
viram anexos manuais. Esta mudança traz a conversa para dentro do moda-flow usando a API
oficial da Meta (WhatsApp Cloud API) com **um número compartilhado** da empresa: cada lead
tem uma conversa, todo o time vê e responde, as mensagens chegam em tempo real, e fora da
janela de 24 horas o envio é feito por template aprovado.

Começa com o número já registrado na WABA da empresa (hoje em teste no CRM externo) e
troca para o número definitivo do time sem migração. A conexão é feita por configuração
manual (WABA, número e token de usuário de sistema de um app Meta próprio do CRM
interno), sem Embedded Signup e sem verificação de app, porque o número é da própria
empresa.

É para o time comercial (proprietária e admins). Resolve: conversa fora do CRM, sem
histórico ligado ao lead e sem visão de quem está sem resposta.

## Páginas / Módulos

### Conexão do número (Configurações › WhatsApp)

**Descrição:** A tela de WhatsApp deixa de usar o fluxo de login da Meta (Embedded Signup)
e passa a receber os dados do número da empresa: identificador da conta (WABA), do número
e o token permanente do usuário de sistema. O token fica só no servidor (Vault). A tela
mostra o estado da conexão e permite testar, trocar o número e desconectar.

**Componentes:**
- Formulário de conexão: WABA, identificador do número, token (campo oculto, nunca reexibido).
- Cartão de estado: número exibido, nome verificado, qualidade do número, data da conexão e se o webhook está assinado.
- Botões: Testar conexão, Trocar número, Desconectar.
- Instruções curtas de onde obter cada dado no painel da Meta.

**Comportamentos:**
- Admin preenche WABA, número e token e conecta: o sistema valida na Meta, assina o app aos eventos da conta e guarda o token no servidor.
- Admin testa a conexão e vê número, nome verificado e qualidade.
- Admin troca o número: informa o novo identificador e token; conversas existentes continuam no histórico.
- Admin desconecta: o token é apagado do servidor e o CRM para de enviar e receber.
- Token inválido ou sem permissão: a tela avisa qual verificação falhou e nada é salvo.

**Critérios de aceite:**

#### CA-S2-01 — Conectar número por configuração manual · prova: automática
- **Dado** WABA, identificador do número e token válidos
- **Quando** o admin conecta
- **Então** a conexão fica ativa, o token não aparece em nenhuma resposta ao navegador (só a marca "token configurado"), e a conta fica assinada aos eventos de mensagens e status

#### CA-S2-02 — Token inválido não é salvo · prova: automática
- **Dado** um token inválido ou sem permissão de mensagens
- **Quando** o admin tenta conectar
- **Então** a tela mostra o erro devolvido pela Meta e a configuração anterior permanece como estava

#### CA-S2-03 — Testar conexão mostra número e qualidade · prova: automática
- **Dado** a conexão ativa
- **Quando** o admin clica em Testar conexão
- **Então** vê o número exibido, o nome verificado e a qualidade do número informados pela Meta

#### CA-S2-04 — Trocar o número preserva o histórico · prova: automática
- **Dado** conversas e mensagens registradas com o número A
- **Quando** o admin troca para o número B
- **Então** as conversas antigas continuam visíveis e as novas mensagens passam a sair e chegar pelo número B

#### CA-S2-05 — Só admin e proprietário configuram · prova: automática
- **Dado** um usuário sem papel válido
- **Quando** tenta conectar, testar ou desconectar
- **Então** o servidor recusa

#### CA-S2-06 — Tela sem Embedded Signup · prova: manual
- **Dado** a tela de WhatsApp aberta
- **Quando** o admin a percorre
- **Então** não existe botão de login da Meta; existe o formulário manual com instruções, o cartão de estado e os três botões

### Recebimento de mensagens

**Descrição:** A Meta entrega ao CRM cada mensagem recebida e cada mudança de status. O
CRM reconhece o lead pelo telefone, guarda a mensagem na conversa do lead e avisa a tela em
tempo real. Mídia recebida é baixada e guardada de forma privada.

**Componentes:**
- Receptor de eventos (webhook) com validação de assinatura e resposta imediata.
- Conversa do lead: registro único por lead, com contagem de não lidas, última mensagem e janela de 24 horas.
- Mensagem: direção, tipo, texto, mídia, status, horário, quem enviou (quando saída).

**Comportamentos:**
- Lead conhecido envia mensagem de texto: ela aparece na conversa dele.
- Lead conhecido envia imagem, PDF, áudio, vídeo, figurinha, localização ou contato: a conversa mostra o conteúdo (ou um marcador para tipos não exibíveis), e a mídia fica disponível para abrir.
- Telefone desconhecido envia mensagem: o sistema cria um lead novo em Leads de Entrada com funil "whatsapp" e a conversa já nasce com a mensagem (a deduplicação por telefone decide se é novo ou retorno).
- A mesma mensagem entregue duas vezes pela Meta é guardada uma vez só.
- Evento de número que não é o configurado (ex.: o mesmo número em teste em outro app): ignorado.
- Mensagem recebida reabre a janela de 24 horas da conversa e incrementa não lidas.
- Lead responde a uma mensagem específica: a conversa mostra a citação.
- Lead apaga ou edita uma mensagem: a conversa mostra o aviso correspondente.

**Critérios de aceite:**

#### CA-S2-07 — Mensagem de lead conhecido entra na conversa dele · prova: automática
- **Dado** um lead com WhatsApp cadastrado
- **Quando** a Meta entrega uma mensagem de texto desse telefone
- **Então** a conversa do lead ganha a mensagem com direção "recebida", texto e horário da Meta, e a contagem de não lidas sobe

#### CA-S2-08 — Telefone desconhecido vira lead novo com conversa · prova: automática
- **Dado** um telefone sem lead correspondente
- **Quando** chega a primeira mensagem
- **Então** existe um lead novo em Leads de Entrada com funil "whatsapp", nome igual ao perfil do WhatsApp (ou o número), e a conversa dele contém a mensagem

#### CA-S2-09 — Mídia recebida fica guardada e privada · prova: automática
- **Dado** uma mensagem com imagem, PDF ou áudio
- **Quando** ela é processada
- **Então** o arquivo está no armazenamento privado do CRM, ligado à mensagem, e não abre sem login

#### CA-S2-10 — Entrega repetida não duplica · prova: automática
- **Dado** uma mensagem já registrada
- **Quando** a Meta entrega o mesmo evento de novo
- **Então** a conversa continua com uma única cópia

#### CA-S2-11 — Evento de outro número é ignorado · prova: automática
- **Dado** a configuração apontando para o número A
- **Quando** chega um evento do número B pela mesma conta
- **Então** nada é gravado e o CRM responde sucesso à Meta

#### CA-S2-12 — Assinatura inválida é recusada · prova: automática
- **Dado** um evento cuja assinatura não confere com o segredo do app
- **Quando** ele chega
- **Então** é recusado e nada é gravado

#### CA-S2-13 — Janela de 24 horas acompanha a última mensagem recebida · prova: automática
- **Dado** uma conversa sem mensagem recebida há mais de 24 horas
- **Quando** o lead envia uma nova mensagem
- **Então** a conversa passa a mostrar a janela aberta, com o horário em que ela fecha

### Envio de mensagens

**Descrição:** Quem está logado envia texto, imagem ou PDF ao lead pela conversa. Fora da
janela de 24 horas, só template aprovado. Cada mensagem enviada guarda quem enviou e
recebe os status entregue e lido quando a Meta informa.

**Componentes:**
- Caixa de digitação com envio por Enter, anexar imagem/PDF e seletor de template.
- Balão de mensagem enviada com autor, horário e status (enviando, enviada, entregue, lida, falhou).

**Comportamentos:**
- Usuário envia texto dentro da janela: a mensagem aparece como "enviando" e muda para "enviada" ao ser aceita pela Meta.
- Usuário envia imagem ou PDF: o arquivo sobe para o armazenamento do CRM e é entregue ao lead.
- Usuário tenta enviar texto com a janela fechada: a caixa fica bloqueada e oferece o seletor de template.
- Usuário envia template preenchendo as variáveis: a mensagem sai e o balão mostra o texto final.
- A Meta informa entregue/lido: o balão atualiza sem recarregar.
- A Meta recusa (janela fechada, número inválido, limite): o balão marca "falhou" com o motivo em linguagem simples.
- Enviar uma mensagem atualiza o "último contato" do lead para hoje.

**Critérios de aceite:**

#### CA-S2-14 — Envio de texto dentro da janela · prova: automática
- **Dado** uma conversa com janela aberta
- **Quando** o usuário envia um texto
- **Então** a mensagem é gravada como "enviada" com o identificador da Meta, o autor e o horário, e o lead tem o último contato atualizado para hoje

#### CA-S2-15 — Envio de imagem ou PDF · prova: automática
- **Dado** uma conversa com janela aberta
- **Quando** o usuário anexa uma imagem ou PDF e envia
- **Então** o arquivo fica no armazenamento privado ligado à mensagem e a mensagem é aceita pela Meta

#### CA-S2-16 — Janela fechada bloqueia texto livre · prova: automática
- **Dado** uma conversa sem mensagem recebida nas últimas 24 horas
- **Quando** o usuário tenta enviar texto livre
- **Então** o envio é recusado pelo servidor e a tela mostra o seletor de template no lugar da caixa de texto

#### CA-S2-17 — Envio de template com variáveis · prova: automática
- **Dado** um template aprovado com variáveis
- **Quando** o usuário preenche as variáveis e envia
- **Então** a mensagem é aceita pela Meta e o balão mostra o texto final com as variáveis substituídas

#### CA-S2-18 — Status entregue e lido atualizam o balão · prova: automática
- **Dado** uma mensagem enviada
- **Quando** a Meta informa entregue e depois lido
- **Então** o status da mensagem passa por entregue e lido, nessa ordem, e nunca regride

#### CA-S2-19 — Recusa da Meta vira "falhou" com motivo · prova: automática
- **Dado** um envio que a Meta recusa
- **Quando** a recusa chega (na resposta ou por status)
- **Então** a mensagem fica como "falhou" com o motivo em linguagem simples (ex.: "Janela de 24 horas fechada. Envie um template.")

#### CA-S2-20 — Quem não está logado não envia · prova: automática
- **Dado** uma chamada de envio sem usuário autenticado
- **Quando** ela chega ao servidor
- **Então** é recusada e nada é enviado

### Conversa no painel do lead

**Descrição:** O painel do lead ganha a aba "Conversa" com o histórico completo do
WhatsApp, atualizado em tempo real, ao lado das abas já existentes.

**Componentes:**
- Aba "Conversa" com contador de não lidas.
- Lista de mensagens agrupada por dia, balões por direção, status, autor nas enviadas, mídia inline (imagem) ou link (PDF, áudio com player).
- Indicador de janela: "Aberta até HH:mm" ou "Fechada: envie um template".
- Caixa de envio (texto, anexo, template).

**Comportamentos:**
- Abrir a aba zera as não lidas da conversa e envia confirmação de leitura à Meta.
- Mensagem nova chega enquanto a aba está aberta: aparece no fim sem recarregar.
- Lead sem conversa: a aba mostra a caixa de envio e um aviso de que a primeira mensagem precisa ser um template.
- Clicar numa imagem abre ampliada; áudio toca inline; PDF abre em nova aba.

**Critérios de aceite:**

#### CA-S2-21 — Abrir a conversa zera não lidas · prova: automática
- **Dado** uma conversa com 3 não lidas
- **Quando** o usuário abre a aba Conversa
- **Então** a contagem vai a zero e as mensagens recebidas ficam marcadas como lidas no CRM

#### CA-S2-22 — Tempo real na conversa · prova: automática
- **Dado** a aba Conversa aberta
- **Quando** uma mensagem nova é gravada para aquele lead
- **Então** ela aparece na lista em menos de 3 segundos, sem recarregar a página

#### CA-S2-23 — Lead sem conversa exige template na primeira mensagem · prova: automática
- **Dado** um lead sem nenhuma mensagem
- **Quando** o usuário abre a aba Conversa
- **Então** a caixa de texto livre está desabilitada e o seletor de template está disponível

#### CA-S2-24 — Exibição por tipo de mensagem · prova: manual
- **Dado** uma conversa com texto, imagem, PDF, áudio, figurinha e localização
- **Quando** o usuário a abre
- **Então** cada tipo aparece do jeito descrito nos componentes, agrupado por dia, com status e autor nas enviadas

### Caixa de entrada

**Descrição:** Página "Conversas" no menu, com todas as conversas do número, ordenadas
pela última mensagem, para o time ver quem está sem resposta.

**Componentes:**
- Lista de conversas: nome do lead, trecho da última mensagem, horário, não lidas, responsável (iniciais), estágio do lead.
- Filtros: Minhas / Sem responsável / Todas; Não respondidas; busca por nome ou telefone.
- Ação "Assumir" direto na lista.
- Clique abre o painel do lead já na aba Conversa.

**Comportamentos:**
- Usuário filtra "Não respondidas": vê só conversas cuja última mensagem é do lead.
- Usuário filtra "Minhas": vê conversas de leads em que é o responsável.
- Mensagem nova chega: a conversa sobe para o topo e o contador atualiza em tempo real.
- Usuário assume um lead pela lista: vira o responsável (mesma regra da S1).
- O menu lateral mostra o total de não lidas.

**Critérios de aceite:**

#### CA-S2-25 — Ordenação e não lidas · prova: automática
- **Dado** conversas com mensagens em horários diferentes
- **Quando** o usuário abre a caixa de entrada
- **Então** a lista vem da mais recente para a mais antiga, com a contagem de não lidas de cada uma e o total no menu

#### CA-S2-26 — Filtro "Não respondidas" · prova: automática
- **Dado** conversas em que a última mensagem é do lead e outras em que é do time
- **Quando** o usuário ativa "Não respondidas"
- **Então** só as primeiras aparecem

#### CA-S2-27 — Filtros por responsável · prova: automática
- **Dado** conversas de leads com responsáveis variados
- **Quando** o usuário escolhe "Minhas" ou "Sem responsável"
- **Então** a lista obedece à mesma regra do filtro de responsável do Pipeline

#### CA-S2-28 — Tempo real na caixa de entrada · prova: automática
- **Dado** a caixa de entrada aberta
- **Quando** chega uma mensagem de um lead
- **Então** a conversa dele vai para o topo com a contagem atualizada em menos de 3 segundos

### Templates

**Descrição:** Os templates aprovados na Meta ficam disponíveis no CRM para envio fora da
janela e para as automações futuras. A criação e aprovação continuam no WhatsApp Manager.

**Componentes:**
- Lista de templates sincronizados: nome, idioma, categoria, status de aprovação, prévia do texto.
- Botão "Sincronizar com a Meta".
- Seletor de template no envio, com campos para as variáveis e prévia do texto final.

**Comportamentos:**
- Admin sincroniza: a lista reflete os templates e status atuais da conta.
- Template reprovado ou pausado não aparece no seletor de envio.
- Usuário escolhe um template, preenche variáveis e vê a prévia antes de enviar.

**Critérios de aceite:**

#### CA-S2-29 — Sincronizar templates · prova: automática
- **Dado** templates na conta da Meta
- **Quando** o admin sincroniza
- **Então** a lista do CRM mostra nome, idioma, categoria e status iguais aos da Meta

#### CA-S2-30 — Só aprovados no seletor de envio · prova: automática
- **Dado** templates aprovados, pendentes e reprovados
- **Quando** o usuário abre o seletor no envio
- **Então** vê só os aprovados

#### CA-S2-31 — Prévia com variáveis preenchidas · prova: automática
- **Dado** um template com duas variáveis
- **Quando** o usuário preenche "Ana" e "quarta-feira"
- **Então** a prévia mostra o texto do template com os valores no lugar dos marcadores, e o envio só habilita com todas preenchidas

## Fora de escopo

- Criar, editar ou apagar templates pelo CRM (fica no WhatsApp Manager).
- Vários números ou um número por vendedor (decisão: um número compartilhado).
- Mensagens rápidas (atalhos de texto), etiquetas de conversa, resolver/arquivar conversa.
- Envio de áudio e vídeo pelo CRM (recebimento sim).
- Automações e réguas de cadência (série seguinte).
- Grupos de WhatsApp (não suportados pela API oficial).
- Coexistência com o aplicativo do celular.
- Notificação sonora ou push de mensagem nova.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S2-01 | O CRM interno usa um app Meta próprio, no mesmo portfólio verificado, com segredos separados dos do Meta Ads (`WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); o token é de usuário de sistema, permanente. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-02 | A janela de 24 horas é contada a partir da última mensagem recebida do lead registrada no CRM; sem mensagem recebida, está fechada. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-03 | Mensagens recebidas e enviadas não viram atividades na linha do tempo (ficam só na conversa); enviar mensagem atualiza `data_ultimo_contato` do lead. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-04 | Mídia recebida é guardada no armazenamento privado do CRM com o mesmo padrão dos anexos (bucket próprio, só autenticados); limite de 16 MB por arquivo (limite da Meta). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-05 | Abrir a conversa envia confirmação de leitura à Meta (o lead vê o "visto"). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-06 | O tempo real usa o Realtime do Supabase sobre as tabelas de conversa e mensagem, visível a todos os usuários autenticados (mesma decisão de RLS compartilhado). | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-07 | Enquanto o número de teste estiver também no CRM externo, as mensagens enviadas de lá não aparecem aqui e vice-versa; só o que passa por este CRM é registrado. | confirmada | Marcelle, 2026-11-01. |
| SUP-S2-08 | Provas que dependem da Meta (envio real, status, templates) rodam contra o número de teste com um telefone do time como destinatário, em testes marcados para execução manual pelo desenvolvedor; o resto (webhook, janela, dedup, caixa de entrada) é provado com payloads gravados contra o banco de produção, como na S1. | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S2-01 | Telefone desconhecido que manda mensagem: criar lead automaticamente em Leads de Entrada com funil "whatsapp" (proposto), ou guardar a conversa numa fila "sem lead" para alguém vincular manualmente? | respondida | Criar lead automaticamente em Leads de Entrada com funil "whatsapp". Marcelle, 2026-11-01. |
| PER-S2-02 | Qual telefone do time recebe as mensagens dos testes de envio real (destinatário dos testes manuais)? | respondida | Decidir na issue de envio; o número do destinatário é informado na hora do teste manual. Marcelle, 2026-11-01. |
| PER-S2-03 | O menu "Conversas" entra como item principal da barra lateral (junto de Pipeline, Leads, Hoje) ou dentro de Hoje? | respondida | Item principal na barra lateral, com total de não lidas. Marcelle, 2026-11-01. |
