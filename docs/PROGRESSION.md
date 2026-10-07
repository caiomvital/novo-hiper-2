# Progressão da Novo Hiper

> Estado: **Progressão 2A** — o servidor cria os pedidos e o bairro ganha moradores. Nenhuma região, barreira ou nível existe ainda.

## Princípio
Internamente há **contadores e condições**; para o jogador a progressão deve aparecer como **acontecimentos concretos**: a loja muda, aparecem coisas e pessoas, o bairro reage, obras avançam, caminhos se abrem. **Nunca** como XP, nível ou checklist.

- **Contador interno ≠ apresentação ao jogador.** Os números existem só no backend (`GET /api/progress`). O HUD continua simples (saldo e mensagens). Nada de "Entregas 4/10", "Missão: cadastre 3 plantas", "Nível 2".
- **Unlock permanente.** Um marco, uma vez alcançado, nunca é desfeito: gastar dinheiro, remover planta ou qualquer mudança posterior nos dados não "desconquista".

## Modelo
| Peça | Onde |
|---|---|
| Regras e limiares (**único lugar com os números**) | `backend/progress/milestones.ts` (`THRESHOLDS`, `MILESTONES`) |
| Estatísticas históricas (derivadas, nada duplicado) | `backend/progress/stats.ts` |
| Marcos conquistados | tabela `milestones(id PK, achieved_at)` — migration 006 |
| API | `GET /api/progress` (autenticada) → `{ stats, milestones: { id: { achieved, achievedAt } } }` |

### Estatísticas (todas monotônicas, derivadas do histórico)
- `deliveriesCompleted` — entregas com status `entregue`.
- `distinctCustomersServed` / `distinctHousesServed` — clientes e **casas** diferentes atendidas (destino congelado do pedido; ids legados contam como a casa amarela; destinos desconhecidos não contam).
- `plantsRegisteredHistorical` — plantas já cadastradas **inclusive as removidas** (exclusão lógica: a linha permanece).
- `distinctPlantsSold` — plantas diferentes efetivamente entregues.
- `upgradesPurchased` / `upgradesInstalled`.

### Marcos
`primeira_planta`, `primeira_entrega`, `primeira_melhoria` (melhoria **instalada**: a loja mudou), `entregas_10`, `casas_4`, `plantas_cadastradas_3`, `melhorias_3`, `bairro_vivo`.

**`bairro_vivo`** (regra inicial de desenvolvimento): ≥ 10 entregas **e** ≥ 4 casas diferentes **e** ≥ 3 plantas cadastradas historicamente **e** ≥ 3 melhorias instaladas. Hoje **não faz nada visível**: não remove barreira, não abre região, não dá dinheiro nem XP. Só fica registrado.

### Como são gravados
- A avaliação é **consequência dos eventos**: cadastrar planta, finalizar entrega, comprar e instalar melhoria chamam `evaluateMilestonesSafe` (depois do commit do evento; uma falha de progressão nunca derruba a operação principal).
- `GET /api/progress` reavalia (idempotente) e devolve o estado: dados anteriores ao recurso são reconhecidos na primeira consulta (com `achieved_at` = momento do reconhecimento).
- Transacional (`BEGIN IMMEDIATE`) e idempotente: `INSERT OR IGNORE`; o `achieved_at` original nunca é sobrescrito.
- Para criar um marco novo: acrescentar uma entrada em `MILESTONES` (e, se preciso, uma estatística em `stats.ts`). Nenhuma regra fica espalhada pelo frontend.

## Mensagens sem pedido (Aventura)
Distingue, sem alarme: sem plantas ("Cadastre uma planta na Novo Hiper para começar."), plantas sem estoque ("As plantas estão sem estoque. Passe na Novo Hiper para conferir.") e estoque ok ("Sem entregas no momento").

## Pedidos e moradores (Progressão 2A)

### O backend é a autoridade dos pedidos
- Pedido automático nasce **só** em `backend/orders/ensureOrder.ts` (`ensureOrder`), dentro de `BEGIN IMMEDIATE`: duas abas, retries ou 10 chamadas simultâneas nunca criam mais pedidos que a capacidade. O frontend **não** escolhe quando, cliente, planta, preço nem `order_number`.
- Eventos só **pedem a verificação**: cadastrar planta, repor/editar estoque, finalizar entrega (no servidor) e abrir o app / entrar na Aventura sem pedido ativo (`POST /api/orders/ensure`). Resposta: `{ created: true, order }` ou `{ created: false, reason }` com `active_order | cooldown | no_plants | no_stock | no_customers | disabled`.
- Ordem das regras: pedido ativo → recuo técnico → plantas → estoque livre → clientes desbloqueados → escolhas.
- **Capacidade = 1 pedido ativo** (sem fila visível, sem escolher entre pedidos). Futuramente podem existir 2–3 e um "balcão" físico na Novo Hiper.
- **Sem tempo como mecânica.** O recuo técnico (padrão **4 s**, `ORDER_COOLDOWN_MS`) existe só contra repetição/race/retry; não aparece, não é cronômetro, e após uma entrega o próximo pedido nasce na hora quando já cabe. Sem timer no frontend (o do `App.tsx`, o `setTimeout` de 15 s e a flag de `localStorage` foram removidos; o botão "Receber pedido" também).
- `ORDER_AUTOGEN=off` desliga **só a criação** (as verificações e motivos continuam) e existe para ambientes de teste; produção/DEV usam o padrão (ligado).
- **Preço congelado no pedido:** vem do `price` da planta **persistida** no momento da criação (o `unit_price` enviado pelo cliente é ignorado também em `POST /api/orders`, que continua por compatibilidade — **dívida técnica: remover**). Reprecificar a planta não muda pedidos antigos.
- **`order_number`** atribuído pelo backend (sequencial), na transação de escrita. Sem migration.
- **Estoque livre** = estoque − quantidade em pedidos abertos; nunca se cria pedido impossível. Se o dono baixar o estoque depois, o pedido **permanece** (`deliverable: false` no `GET /api/orders`), a Aventura avisa "falta estoque… reponha na Novo Hiper", a entrega recusa sem estoque negativo e **nenhum outro pedido** é criado para contornar.
- **Destino congelado** em `orders.destination_id` (migration 004); pedidos antigos nunca são recalculados.

### Roster de 8 moradores (`src/shared/roster.ts`, dados puros, fonte única)
| Grupo (interno) | Cliente | Casa | Distância da Novo Hiper |
|---|---|---|---|
| Início | Dona Maria · Seu João · Ana | `house_021` · `house_019` · `house_017` | ~44 m · ~44 m · ~93 m |
| Crescimento | Carlos · Dona Lúcia | `house_029` · `house_007` | ~93 m · ~131 m |
| Bairro mais amplo | Floricultura · Seu Antônio · Bia | `house_026` · `house_034` · `house_039` | ~144 m · ~200 m · ~242 m |

- Cada cliente tem id estável (os 5 primeiros mantêm os ids do app antigo), casa e **uma frase curta** de agradecimento (balão no feedback da entrega; não cita espécie). Sem diálogo, sem IA.
- A expansão da clientela é também **espacial**: cada grupo mora, em média, mais longe. Os outros 10 destinos ficam para depois.
- **"Floricultura" é cliente por compatibilidade provisória.** Futuramente deve ser reconsiderada como **estabelecimento físico** do mundo, e não como morador.

### Desbloqueio permanente dos grupos (marcos `vizinhos_2` e `vizinhos_3`)
Reaproveitam a tabela `milestones` (sem migration). Regras em `backend/progress/milestones.ts` (`NEIGHBORS`):
- **Grupo 1:** sempre.
- **Grupo 2 (`vizinhos_2`):** ≥ 1 melhoria instalada **e** ≥ 3 entregas.
- **Grupo 3 (`vizinhos_3`):** ≥ 2 melhorias instaladas **e** ≥ 6 entregas **e** ≥ 2 plantas cadastradas historicamente (variedade entra aqui, sem checklist).
Permanente: remover planta, gastar dinheiro ou perder a condição não "tranca" ninguém. Nada é anunciado: a descoberta é o primeiro pedido de Dona Lúcia, Seu Antônio ou Bia. `bairro_vivo` **não mudou** (10 entregas, 4 casas, 3 plantas, 3 melhorias) e a clientela crescente é o caminho natural até ele.

### Clientes existentes
- Pedido **antigo**: o `destination_id` congelado nunca muda.
- Cliente que já tem destino **moderno** válido: preservado, nunca recalculado.
- Cliente que só tem destino **legado** (ex.: `dest_vovo`): recebe **uma única vez** a casa do roster, na primeira vez que o servidor o apresenta (`introduceCustomer`, idempotente); pedidos **novos** usam essa casa, os antigos continuam na casa histórica.

## Direção futura (NÃO implementada)
- `bairro_vivo` poderá iniciar um **acontecimento no mundo**: Novo Hiper cresce → o bairro começa a reagir → a obra da avenida progride → um NPC/comunicação indica que a obra está terminando → depois a barreira "EM OBRAS" é retirada → novo caminho/região fica acessível. Candidata: a barreira leste da avenida H2.
- Mais de um pedido ativo (2–3), escolha entre pedidos e um **balcão físico** na Novo Hiper onde o pedido novo "chega".
- A clientela continuará crescendo com o jogo (os outros 10 destinos, preferências de cliente, pedidos com mais de uma unidade).
- Variedade de plantas como progressão (e a claraboia) ficam para depois.
- Remover `POST /api/orders` quando nada mais depender dele.
