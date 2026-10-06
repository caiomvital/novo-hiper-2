# Fase 1A — Caracterização do backend atual

Testes: `npm run test:backend` (Node ≥ 22.5; usa `node@22` via npx se o Node local for mais antigo).
Cada teste sobe o **app Express real** numa porta efêmera de `127.0.0.1`, com um **SQLite descartável** em
`/tmp/novo-hiper-test-*/test.db`, removido ao final. Nenhum teste altera o backend.

## Proteções contra tocar dados reais
- `assertSafeTestDbPath`: só aceita `.db` dentro do tmpdir do sistema, em diretório com prefixo `novo-hiper-test-`,
  fora de `/root/novo-hiper`, `data/`, `data-dev/`, `uploads*`, `/app/*`, `/root/novo-hiper-backups` (resolve symlinks).
- `assertEnvironmentIsSafeForTests` (setup de todo arquivo) e `scripts/run-backend-tests.mjs`: recusam rodar se
  `DATABASE_PATH`/`DATA_DIR`/`UPLOADS_DIR` herdados apontarem para fora de um local de teste, ou `NODE_ENV=production`.
- Após abrir o banco, o servidor de teste confere via `PRAGMA database_list` que o arquivo aberto é o descartável.
- A própria proteção é testada (`safety.test.ts`).

## Comportamentos confirmados (travados por teste)
- `finish`: baixa estoque por item, credita o total do pedido **uma vez**, marca entrega e pedido `entregue`.
- ~~`finish` repetido → 400~~ → **alterado na 1C** (ver contrato abaixo).
- ~~Dois `finish` simultâneos → 1×200 + 1×400~~ → **alterado na 1C**: ambos 200, um `alreadyApplied=false` e outro `true`.
- Rollback: falta de estoque no 2º item desfaz a baixa do 1º; falha injetada no caixa desfaz tudo.
- `start` repetido devolve a mesma entrega; `UNIQUE` impede 2ª entrega e 2º crédito por pedido.
- Caixa: crédito soma; débito/`upgrade_purchase` subtraem e exigem saldo; `order_id` repetido → 409.

## Bugs / riscos descobertos (NÃO corrigidos na 1A)
| # | Descoberta | Gravidade | Fase sugerida |
|---|---|---|---|
| B1 | **Excluir planta referenciada por pedido entregue → HTTP 500** (FK de `order_items`, mensagem genérica). Hipótese da FK **confirmada**. | Média | 1D |
| B2 ✅ **corrigido na 1C** | `PUT /api/orders/:id` aceitava `status:"entregue"` **sem** baixar estoque nem creditar caixa; depois o `start` é bloqueado. Pedido "entregue" que nunca virou dinheiro/estoque. | Alta | 1C/1E |
| B3 | `POST /api/cash/transactions` aceita **crédito livre** sem pedido (dinheiro "do nada"). | Alta | 1E |
| B4 | Tipo `adjustment` é **subtraído** do saldo (tratado como débito) e não exige saldo. | Média | 1E |
| B5 | Criar pedido cria o **cliente antes** de validar os itens: pedido inválido deixa cliente órfão. | Baixa | futura |
| B6 | Criar pedido **não verifica nem reserva estoque** (pode pedir 50 de 1); falha só no `start`/`finish`. | Média (para Fase 4) | 4A |
| B7 | `id` duplicado em planta/pedido → **500** (deveria ser 409). | Baixa | futura |
| B8 | `quantity` 0/inválida vira 1 silenciosamente (`parseInt(...) \|\| 1`); estoque decimal é truncado. | Baixa | futura |
| B9 | Caixa em `REAL`: `0.1 + 0.2` armazenado como `0.30000000000000004` (exibição arredonda). | Baixa/Média | D8 (centavos nas novas tabelas) |
| B10 | Sem autenticação em nenhuma rota (já conhecido, G1). Não testado aqui (1E). | Crítica | 1E |

## Encaminhamento dos achados (decidido após a 1A)
- **B2** → Fase **1C** (o `PUT /orders/:id` não poderá marcar `entregue`).
- **B3/B4** → Fase **1E** (restringir/autorizar `POST /cash/transactions`; não é corrigido na 1B).
- **B5/B6/B7/B8** → validação server-side **antes da Fase 4A** (ver `GAME_DESIGN_PHASE0.md`, §19).
- **B1** → Fase **1D**. **B9** → centavos nas tabelas novas (D8). **B10** → Fase **1E**.

## Fase 1C — contrato final (implementado)

### `POST /api/deliveries/:id/finish`
| Situação | HTTP | Corpo |
|---|---|---|
| 1ª finalização válida | **200** | `{ success: true, alreadyApplied: false, delivery, order, cashBalance, totalSales }` |
| Repetição (entrega já `entregue`) | **200** | `{ success: true, alreadyApplied: true, delivery, order, cashBalance, totalSales }` — **sem nenhum efeito** (nem `updated_at`) |
| Entrega inexistente | 404 | `{ error }` |
| Falha real (estoque insuficiente, planta removida, pedido sem itens, falha ao gravar caixa) | 400 | `{ error }` — ROLLBACK total; **nunca** `alreadyApplied` |
| Pedido da entrega não encontrado | 404 | `{ error }` |

- 1ª finalização: baixa estoque **uma vez**, credita o caixa **uma vez**, marca entrega e pedido `entregue`.
- `cashBalance`/`totalSales` na repetição são o caixa **atual** (podem diferir da 1ª resposta).
- A resposta mantém os campos anteriores e acrescenta somente `alreadyApplied` (compatível com o frontend atual,
  que ignora o corpo). Sem saldo em centavos, `newUnlocks` nem campos da Fase 2.

**Implementação:** a decisão "já aplicado?" lê `deliveries.status` **dentro** de uma transação de escrita
(`BEGIN IMMEDIATE`) — estado persistido, sem flag em memória. Rede de segurança: `UNIQUE(deliveries.order_id)` e
`UNIQUE(cash_transactions.order_id)` (+ checagem explícita do crédito). O `ROLLBACK` só é emitido pela requisição
que abriu a transação. Na repetição não há nenhuma escrita (a transação é aberta, lida e confirmada vazia).

**Concorrência:** N chamadas simultâneas → todas 200; exatamente uma com `alreadyApplied=false`.
(Hoje há uma única conexão SQLite síncrona, então as requisições se serializam; a verificação dentro da transação
de escrita mantém a correção mesmo se isso mudar.)

### `PUT /api/orders/:id`
`status: "entregue"` → **400** `{ code: "USE_FINISH_ENDPOINT", error }` (mesmo critério do `PATCH /deliveries/:id/state`).
A regra é avaliada antes da busca do pedido.
**`entregue` é terminal:** `PUT` em pedido já entregue (para `recebido`/`preparando`/`pronto`) → **409** `{ code: "ORDER_ALREADY_DELIVERED" }`, sem nenhuma alteração. Ordem das checagens: `entregue` solicitado → 400 `USE_FINISH_ENDPOINT`; status inválido → 400; pedido inexistente → 404; pedido já entregue → 409. `recebido | preparando | pronto` continuam permitidos
(o frontend só usa `preparando` e `pronto`). O pedido não é alterado (nem `updated_at`).

### Achado novo
| # | Descoberta | Gravidade | Fase sugerida |
|---|---|---|---|
| B11 ✅ **corrigido na 1C** | `PUT /api/orders/:id` permitia **reabrir** um pedido já entregue. Agora `entregue` é **terminal**: qualquer `PUT` em pedido entregue → **409** `{ code: "ORDER_ALREADY_DELIVERED" }`, sem alterar pedido, entrega, estoque nem caixa. | Média | — |

### Compatibilidade verificada
- `finish`: único consumidor = `src/App.tsx` → `api.finishDelivery(del.id)` (resultado ignorado, só `.catch`). Sem mudança no frontend.
- `PUT /orders/:id`: o frontend só envia `preparando`/`pronto` (`OrdersView` → `handleUpdateOrderStatus`). Sem mudança no frontend.
- O jogo da Aventura (Phaser) não usa nenhum dos dois endpoints.
