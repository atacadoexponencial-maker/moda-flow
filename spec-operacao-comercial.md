# Spec: Operação comercial mínima

> série: S1
> estado: aprovada em 2026-11-01

## Visão Geral

Hoje o time comercial opera no ClickUp e o moda-flow só recebe os leads: os 818 contatos
em produção estão todos em "Leads de Entrada", sem nenhuma atividade registrada. Esta
mudança entrega o mínimo que o time precisa para trabalhar o lead aqui dentro e deixar o
ClickUp: saber de quem é cada lead, registrar o que aconteceu com prints e arquivos,
perder um lead com motivo comparável, perceber quando um lead antigo volta a se cadastrar
e abrir rapidamente a fatia do pipeline que interessa.

É para o time comercial (proprietária e admins). Resolve: o CRM existir mas ninguém
conseguir operar nele.

## Páginas / Módulos

### Papéis de usuário

**Descrição:** O time tem dois papéis: **proprietário** (uma única pessoa, a conta atual)
e **admin** (todos os demais). Não há nível "vendedor". Todos veem e editam todos os
leads; a diferença é só sobre a gestão de usuários.

**Componentes:**
- Tela de Usuários: lista com e-mail, papel e data; convite por e-mail; troca de papel;
  remoção.
- Selo de papel na lista: "Proprietário" ou "Admin".

**Comportamentos:**
- Proprietário convida um novo usuário por e-mail.
- Proprietário ou admin convida um novo usuário por e-mail.
- Proprietário ou admin remove um usuário.
- Ninguém remove o proprietário nem troca o papel dele.
- Novo usuário convidado entra como admin automaticamente.
- Usuário sem papel não consegue entrar nas telas do CRM.

**Critérios de aceite:**

#### CA-S1-01 — Só existem os papéis proprietário e admin · prova: automática
- **Dado** o cadastro de papéis do sistema
- **Quando** alguém tenta registrar um papel diferente de "proprietario" ou "admin" (inclusive "vendedor" ou "proprietário" com acento)
- **Então** o registro é recusado

#### CA-S1-02 — A conta atual vira a proprietária · prova: automática
- **Dado** a base em produção com um único usuário com papel admin
- **Quando** a mudança entra no ar
- **Então** esse usuário passa a ter o papel "proprietario" e é o único com esse papel

#### CA-S1-03 — Proprietário não pode ser removido nem rebaixado · prova: automática
- **Dado** um admin logado na tela de Usuários
- **Quando** tenta remover o proprietário ou trocar o papel dele
- **Então** a ação não aparece disponível e, se forçada, o servidor recusa

#### CA-S1-04 — Convidado entra como admin · prova: automática
- **Dado** um proprietário ou admin na tela de Usuários
- **Quando** convida um e-mail novo
- **Então** o convite é enviado e, ao aceitar, o usuário já aparece na lista como "Admin" sem ninguém precisar definir o papel

#### CA-S1-05 — Gestão de usuários aceita proprietário e admin · prova: automática
- **Dado** um usuário logado com papel proprietário ou admin
- **Quando** lista, convida ou remove usuários, ou limpa o CRM
- **Então** a operação é aceita; um usuário sem papel recebe recusa

#### CA-S1-06 — Tela de Usuários mostra só os dois papéis · prova: manual
- **Dado** a tela de Usuários aberta
- **Quando** o proprietário abre o seletor de papel de um admin
- **Então** só aparece "Admin" (o papel "Proprietário" não é atribuível pela tela) e não existe "Vendedor"

### Responsável pelo lead

**Descrição:** Cada lead pode ter um responsável, que é um usuário do time. Serve para
cada pessoa achar a própria carteira e para a equipe saber quem está cuidando de quem.

**Componentes:**
- Campo "Responsável" no painel do lead: seletor com os usuários do time e a opção "Sem responsável".
- Coluna "Responsável" na tabela de Leads, com iniciais ou nome curto.
- Indicação do responsável no card do pipeline (iniciais).
- Filtro "Responsável" nos filtros de Pipeline e Leads, com atalho "Meus leads".
- Na página Hoje, alternância "Meus" / "Todos".

**Comportamentos:**
- Usuário define ou troca o responsável de um lead pelo painel.
- Usuário remove o responsável de um lead ("Sem responsável").
- Usuário atribui a si mesmo com um clique ("Assumir").
- Usuário filtra o pipeline e a tabela pelos próprios leads.
- Usuário filtra pelos leads de outra pessoa ou sem responsável.
- Na página Hoje, usuário vê só os próprios follow-ups ou os de todo o time.
- Lead novo entra sem responsável.
- Quando um usuário é removido, os leads dele ficam sem responsável (não somem).

**Critérios de aceite:**

#### CA-S1-07 — Definir responsável no painel · prova: automática
- **Dado** um lead sem responsável aberto no painel
- **Quando** o usuário escolhe um nome no campo Responsável
- **Então** o lead passa a mostrar esse responsável no painel, no card do pipeline e na tabela, e a troca fica registrada na linha do tempo do lead

#### CA-S1-08 — "Assumir" atribui ao usuário logado · prova: automática
- **Dado** um lead sem responsável
- **Quando** o usuário clica em "Assumir"
- **Então** ele passa a ser o responsável do lead

#### CA-S1-09 — Filtro "Meus leads" · prova: automática
- **Dado** leads com responsáveis variados e alguns sem responsável
- **Quando** o usuário ativa "Meus leads" no Pipeline ou na tabela de Leads
- **Então** só aparecem os leads em que ele é o responsável

#### CA-S1-10 — Filtro por responsável e por "sem responsável" · prova: automática
- **Dado** o filtro Responsável
- **Quando** o usuário escolhe outra pessoa ou "Sem responsável"
- **Então** a lista mostra só os leads correspondentes

#### CA-S1-11 — Hoje alterna entre meus e todos · prova: automática
- **Dado** follow-ups atrasados e de hoje de vários responsáveis
- **Quando** o usuário alterna para "Meus"
- **Então** as três listas (Atrasados, Para hoje, Reuniões) mostram só os leads dele; em "Todos" voltam a mostrar tudo

#### CA-S1-12 — Remover usuário não apaga leads · prova: automática
- **Dado** um usuário responsável por leads
- **Quando** ele é removido do time
- **Então** os leads continuam existindo e passam a "Sem responsável"

### Motivo de perda padronizado

**Descrição:** Ao perder um lead (Desqualificado ou Proposta Recusada), o motivo é
escolhido de uma lista fixa, a mesma usada hoje no ClickUp, para os números continuarem
comparáveis. "Outro" permite texto livre.

**Componentes:**
- Lista de motivos: Nunca respondeu abordagem; Fora do perfil; Não tem interesse; Não é prioridade; No show; Não tem budget; Tentativas de contato esgotadas; Não tem time; Outro.
- Caixa de texto que aparece só quando "Outro" é escolhido.
- Campo "Motivo de perda" no painel do lead com a mesma lista.

**Comportamentos:**
- Ao arrastar um lead para Desqualificado ou Proposta Recusada, o usuário escolhe o motivo antes de confirmar.
- Usuário escolhe "Outro" e escreve o motivo.
- Usuário corrige o motivo de perda pelo painel de um lead já perdido.
- Usuário não consegue confirmar a perda sem motivo.
- Leads perdidos antes da mudança mantêm o texto antigo como está.

**Critérios de aceite:**

#### CA-S1-13 — Perda exige um motivo da lista · prova: automática
- **Dado** um lead sendo movido para Desqualificado ou Proposta Recusada
- **Quando** o usuário tenta confirmar sem escolher motivo, ou escolhe "Outro" sem escrever
- **Então** a confirmação fica bloqueada

#### CA-S1-14 — Lista de motivos é a do ClickUp · prova: automática
- **Dado** a caixa de perda aberta
- **Quando** o usuário abre a lista de motivos
- **Então** vê exatamente os 8 motivos acima mais "Outro", nessa ordem

#### CA-S1-15 — Motivo "Outro" guarda o texto escrito · prova: automática
- **Dado** o usuário escolhe "Outro" e escreve um motivo
- **Quando** confirma
- **Então** o lead mostra o texto escrito como motivo de perda

#### CA-S1-16 — Motivo editável no painel · prova: automática
- **Dado** um lead perdido aberto no painel
- **Quando** o usuário troca o motivo pela lista
- **Então** o novo motivo fica salvo e aparece no painel

### Atividades com anexo

**Descrição:** O registro de atividade do lead (nota, ligação, reunião) passa a aceitar
arquivos, para o comercial guardar prints de conversa e documentos junto do histórico.

**Componentes:**
- Área de anexar arquivos no formulário de nova atividade (clique ou arrastar).
- Pré-visualização de imagens como miniatura na linha do tempo; outros arquivos como link com nome e tamanho.
- Visualização ampliada ao clicar numa imagem.
- Indicação de progresso durante o envio.

**Comportamentos:**
- Usuário anexa um ou mais arquivos a uma atividade antes de salvar.
- Usuário remove um arquivo da seleção antes de salvar.
- Usuário salva uma atividade só com arquivos, sem texto.
- Usuário abre ou baixa um anexo pela linha do tempo.
- Usuário tenta anexar arquivo acima do limite e é avisado.
- Usuário tenta anexar tipo de arquivo não aceito e é avisado.
- Pessoa sem login não consegue abrir o endereço de um anexo.

**Critérios de aceite:**

#### CA-S1-17 — Atividade com imagens aparece com miniaturas · prova: automática
- **Dado** o formulário de nova atividade com texto e duas imagens anexadas
- **Quando** o usuário salva
- **Então** a linha do tempo mostra a atividade com o texto e as duas miniaturas, e as miniaturas abrem a imagem ampliada

#### CA-S1-18 — Atividade só com anexo é aceita · prova: automática
- **Dado** o formulário de nova atividade sem texto e com um arquivo
- **Quando** o usuário salva
- **Então** a atividade é criada mostrando o arquivo

#### CA-S1-19 — Limite de tamanho e tipo · prova: automática
- **Dado** o formulário de nova atividade
- **Quando** o usuário escolhe um arquivo acima do limite ou de tipo não aceito
- **Então** o arquivo não entra na seleção e a tela diz o motivo

#### CA-S1-20 — Anexo é privado · prova: automática
- **Dado** o endereço de um anexo
- **Quando** alguém sem login tenta abri-lo
- **Então** o acesso é negado; logado, abre normalmente

#### CA-S1-21 — Apagar o lead apaga os anexos · prova: automática
- **Dado** um lead com atividades anexadas
- **Quando** o lead é excluído
- **Então** as atividades e os arquivos anexados somem junto

### Retorno de lead

**Descrição:** Quando um contato que já existe se cadastra de novo, hoje o sistema só
registra uma "entrada" silenciosa. Passa a avisar o time: o lead volta para o início do
funil quando faz sentido, ganha um registro "Lead voltou" na linha do tempo e fica em
destaque.

**Componentes:**
- Registro "Lead voltou" na linha do tempo, com funil e origem (utm) da nova entrada.
- Selo "Voltou" no card do pipeline e na tabela, enquanto o retorno é recente.
- Seção "Voltaram" na página Hoje com os leads que retornaram no período recente.

**Comportamentos:**
- Lead em estágio perdido, em Nutrição ou em Follow-up Futuro se cadastra de novo: volta para Leads de Entrada.
- Lead em estágio ativo de trabalho (Qualificação, Follow-up RA, Reunião, Proposta, Follow-up RR, Contrato) se cadastra de novo: fica onde está.
- Lead com Contrato Assinado se cadastra de novo: fica onde está.
- Em todos os casos, a linha do tempo ganha "Lead voltou" com funil e origem.
- O lead que voltou aparece com selo e na seção "Voltaram" da página Hoje por alguns dias.
- O responsável do lead é mantido no retorno.

**Critérios de aceite:**

#### CA-S1-22 — Lead perdido que volta reabre em Leads de Entrada · prova: automática
- **Dado** um lead em Desqualificado, Proposta Recusada, Nutrição ou Follow-up Futuro
- **Quando** chega um novo cadastro com o mesmo WhatsApp ou e-mail
- **Então** o lead passa para Leads de Entrada, o motivo de perda anterior fica guardado no registro da linha do tempo e o responsável é mantido

#### CA-S1-23 — Lead em trabalho ou fechado que volta fica onde está · prova: automática
- **Dado** um lead em Qualificação, Follow-up RA, Reunião, Proposta/Negociação, Follow-up RR, Contrato ou Contrato Assinado
- **Quando** chega um novo cadastro com a mesma identidade
- **Então** o estágio não muda

#### CA-S1-24 — Registro "Lead voltou" na linha do tempo · prova: automática
- **Dado** qualquer retorno de lead
- **Quando** o novo cadastro é processado
- **Então** a linha do tempo do lead mostra "Lead voltou" com o funil e a origem (utm_source/utm_campaign) da nova entrada

#### CA-S1-25 — Destaque de quem voltou · prova: automática
- **Dado** um lead que voltou dentro do período de destaque
- **Quando** o usuário abre o Pipeline, a tabela de Leads ou a página Hoje
- **Então** o lead aparece com o selo "Voltou" e consta na seção "Voltaram" de Hoje; passado o período, o selo some

#### CA-S1-26 — Leads que já voltaram antes da mudança não ganham selo retroativo · prova: automática
- **Dado** os 129 retornos já registrados na base
- **Quando** a mudança entra no ar
- **Então** nenhum lead muda de estágio nem ganha selo por retornos anteriores

### Visões salvas

**Descrição:** O usuário salva combinações de filtros do Pipeline e da tabela de Leads
com um nome, para abrir de novo com um clique. Há visões prontas para todos.

**Componentes:**
- Seletor de visões ao lado dos filtros, com as visões prontas e as do usuário.
- Botão "Salvar visão" com campo de nome.
- Ações de renomear e excluir visão própria.
- Visões prontas: "Leads Hoje" (entrada hoje), "Meus leads", e uma por funil ativo.

**Comportamentos:**
- Usuário aplica filtros e salva como visão com nome.
- Usuário abre uma visão e os filtros são aplicados.
- Usuário renomeia ou exclui uma visão própria.
- Usuário não consegue alterar nem excluir uma visão pronta.
- A última visão usada reabre quando o usuário volta à página.
- Visões salvas por um usuário não aparecem para os outros.

**Critérios de aceite:**

#### CA-S1-27 — Salvar e reabrir visão · prova: automática
- **Dado** filtros aplicados no Pipeline
- **Quando** o usuário salva como "Workshop quente" e depois seleciona essa visão
- **Então** os mesmos filtros são aplicados e a lista corresponde

#### CA-S1-28 — Visões prontas disponíveis · prova: automática
- **Dado** um usuário novo sem visões salvas
- **Quando** abre o seletor
- **Então** vê "Leads Hoje", "Meus leads" e uma visão por funil existente na base

#### CA-S1-29 — Visões são pessoais · prova: automática
- **Dado** uma visão salva pelo usuário A
- **Quando** o usuário B abre o seletor
- **Então** não vê a visão de A

#### CA-S1-30 — Última visão reabre · prova: automática
- **Dado** o usuário usou a visão "Workshop quente" e saiu da página
- **Quando** volta ao Pipeline
- **Então** a visão "Workshop quente" está aplicada

#### CA-S1-31 — Visão pronta não é editável · prova: automática
- **Dado** a visão "Leads Hoje" selecionada
- **Quando** o usuário procura renomear ou excluir
- **Então** as ações não estão disponíveis

## Fora de escopo

- Notificação de lead novo por WhatsApp (continua no tracking-avancado).
- Chat / WhatsApp dentro do CRM.
- Automações e réguas de cadência; cadência manual (CNT/FLW/RCP do ClickUp) não entra.
- Migração do histórico do ClickUp.
- Atribuição em massa de responsável.
- Restrição de leitura ou edição por responsável (decisão registrada em `docs/decisoes/2026-11-01-rls-leads-compartilhado.md`).
- Edição ou exclusão de anexos depois de salvos.
- Visões compartilhadas entre usuários (além das prontas).

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| SUP-S1-01 | O único usuário com login hoje (o admin existente) é a conta que vira proprietária. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-02 | Toda atividade passa a registrar quem a criou (hoje o campo existe mas fica vazio), inclusive as geradas pelo sistema ("Lead voltou", troca de responsável), que ficam como "Sistema". | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-03 | Período de destaque "Voltou": 7 dias a partir do retorno. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-04 | Limites de anexo: até 5 arquivos por atividade, 10 MB cada; tipos aceitos: imagens (jpg, png, webp, gif) e PDF. Validado no ClickUp em 2026-11-01: em 120 cards recentes, 108 tinham anexo (98 com 1, 8 com 2, 2 com 3); 118 PNG e 2 PDF, nenhum áudio; tamanho mediano 320 KB, máximo 439 KB. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-05 | A regra de retorno vale para qualquer canal de entrada (webhook, importação, criação manual), porque todos passam pelo mesmo ponto de deduplicação. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-06 | Motivos de perda antigos (texto livre) não são convertidos para a nova lista; ficam como estão e aparecem como "Outro" com o texto. | confirmada | Marcelle, 2026-11-01. |
| SUP-S1-07 | Provas que dependem do banco rodam como testes de integração contra o projeto Supabase de produção, criando usuários temporários `@teste.com` e apagando tudo ao final; só executam quando o `.env` local tem a service role (no CI ficam pulados). | confirmada | Marcelle, 2026-11-01. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| PER-S1-01 | Lead em Nutrição ou Follow-up Futuro que volta deve ir para Leads de Entrada (perde a data de próximo contato) ou só ganhar o selo e ficar onde está? | respondida | Volta para Leads de Entrada, igual ao ClickUp. Marcelle, 2026-11-01. |
| PER-S1-02 | As visões prontas por funil devem ser uma por valor de funil existente na base (hoje 7) ou só os funis principais (Sessão Estratégica, Lives, Workshop)? | respondida | Uma por funil existente na base; novos funis aparecem sozinhos. Marcelle, 2026-11-01. |
| PER-S1-03 | O responsável deve ser visível no card do pipeline (iniciais) ou só no painel e na tabela, para manter o card limpo? | respondida | Sim, iniciais no card. Marcelle, 2026-11-01. |
