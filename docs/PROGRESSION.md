# Progressão da Novo Hiper

> Estado: **Progressão 1** — base persistente. Nenhuma região, barreira ou nível existe ainda.

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

## Direção futura (NÃO implementada)
- `bairro_vivo` poderá iniciar um **acontecimento no mundo**: Novo Hiper cresce → o bairro começa a reagir → a obra da avenida progride → um NPC/comunicação indica que a obra está terminando → depois a barreira "EM OBRAS" é retirada → novo caminho/região fica acessível. Candidata: a barreira leste da avenida H2.
- A **clientela crescerá** conforme o jogo progride. Os cinco clientes fixos atuais (`FICTIONAL_CUSTOMERS`) são **provisórios**.
- **Dívida técnica:** o gerador de pedidos mora no **frontend** (`App.tsx`: timer de 60–90 s, no máximo 5 pendentes, só com o app aberto e autenticado). Antes de clientela dinâmica ou regiões ele deverá migrar para uma arquitetura **backend-authoritative**. Também: o backend aceita o `unit_price` enviado pelo cliente ao criar pedido; progressão deve preferir **contagens** a limiares de dinheiro por isso.
- Variedade de plantas como progressão (clientela e melhorias que dependem do catálogo) e a claraboia ficam para depois.
