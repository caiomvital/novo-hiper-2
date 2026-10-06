# Exclusão lógica de plantas (Fase 1D)

`plants.deleted_at INTEGER NULL` (ms; `NULL` = ativa). **Restaurar no futuro = `deleted_at = NULL`** (sem endpoint agora).

## `DELETE /api/plants/:id` = remover do catálogo (sempre lógico, mesmo sem histórico)
| Caso | Resposta |
|---|---|
| 1ª remoção | **200** `{ success: true, deleted: true, alreadyDeleted: false, deletedAt, message }` |
| Repetição | **200** `{ success: true, deleted: true, alreadyDeleted: true, deletedAt }` — sem escrita |
| Planta usada por pedido **não entregue** | **400** (regra de segurança mantida; nada muda) |
| Inexistente | 404 |
Verificação de pedidos abertos e marcação ocorrem na **mesma transação** (`BEGIN IMMEDIATE`).
Uma semântica só (sem "delete físico para quem não tem histórico"): evita dois significados e preserva a possibilidade de restaurar. O estoque, `order_items`, `deliveries` e caixa **não** são tocados. Compatível com o frontend (`api.deletePlant` lê `success`).

## Política de pedidos
- **Histórico (entregues):** a planta continua referenciada e legível (`plant_name` etc. em `GET /orders`).
- **Abertos:** a remoção é **recusada** enquanto existir pedido não entregue com a planta — logo, um pedido aberto nunca fica apontando para planta removida pela API.
- **Defensivo:** se mesmo assim houver pedido aberto com planta removida (dado antigo/restauração), `start` e `finish` **não filtram `deleted_at`** e concluem normalmente (baixa estoque da linha removida, credita o caixa). Exceção deliberada à regra "fluxos normais não mexem em estoque de planta removida".

## Auditoria das consultas a `plants`
| Local | Consulta | Classe | Tratamento |
|---|---|:-:|---|
| `plants.ts` GET `/` | listagem | A | `deleted_at IS NULL` |
| `plants.ts` GET `/stock` | estoque geral (e `totalUnits`) | A | `deleted_at IS NULL` |
| `plants.ts` GET `/:id` | detalhe | A | `deleted_at IS NULL` → 404 |
| `plants.ts` GET `/:id/stock` | estoque da planta | A | `deleted_at IS NULL` → 404 |
| `plants.ts` POST `/` | INSERT | C | id repetido (inclusive de removida) → 500 atual (B7), nunca sobrescreve |
| `plants.ts` PUT `/:id` | edição | C | removida → **409 `PLANT_DELETED`** |
| `plants.ts` DELETE `/:id` | soft-delete | — | `UPDATE deleted_at` (idempotente) |
| `orders.ts` POST `/` | valida plantas do pedido | C | removida → **400 `PLANT_DELETED`** |
| `orders.ts` GET `/`, GET `/:id`, POST (resposta) | `LEFT JOIN plants` | B | sem filtro (histórico mostra a planta removida) |
| `game.ts` `/current` | `LEFT JOIN plants` (entrega aberta) | B | sem filtro |
| `deliveries.ts` `/start` | valida estoque | B (pedido pré-existente) | **sem filtro** (política acima) |
| `deliveries.ts` `/finish` | baixa estoque | B (pedido pré-existente) | **sem filtro** (política acima) |
| `migration.ts` `/status` | `COUNT(*)` | infra | conta **todas** as linhas (população do banco) |
| `migration.ts` POST | `SELECT id` + INSERT | infra | id existente (inclusive removida) é pulado — não ressuscita |
| **Futuro:** geração de pedidos (Fase 4A), métricas da Fase 2 | — | A/C | **devem** filtrar `deleted_at IS NULL` |
