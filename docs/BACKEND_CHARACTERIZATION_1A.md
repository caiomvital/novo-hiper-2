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
- `finish` repetido → **400** (não idempotente — será 200 na 1C), sem efeito em estoque/caixa.
- Dois `finish` simultâneos → 1×200 + 1×400 (serializados); estoque/caixa aplicados uma vez.
- Rollback: falta de estoque no 2º item desfaz a baixa do 1º; falha injetada no caixa desfaz tudo.
- `start` repetido devolve a mesma entrega; `UNIQUE` impede 2ª entrega e 2º crédito por pedido.
- Caixa: crédito soma; débito/`upgrade_purchase` subtraem e exigem saldo; `order_id` repetido → 409.

## Bugs / riscos descobertos (NÃO corrigidos na 1A)
| # | Descoberta | Gravidade | Fase sugerida |
|---|---|---|---|
| B1 | **Excluir planta referenciada por pedido entregue → HTTP 500** (FK de `order_items`, mensagem genérica). Hipótese da FK **confirmada**. | Média | 1D |
| B2 | `PUT /api/orders/:id` aceita `status:"entregue"` **sem** baixar estoque nem creditar caixa; depois o `start` é bloqueado. Pedido "entregue" que nunca virou dinheiro/estoque. | Alta | 1C/1E |
| B3 | `POST /api/cash/transactions` aceita **crédito livre** sem pedido (dinheiro "do nada"). | Alta | 1E |
| B4 | Tipo `adjustment` é **subtraído** do saldo (tratado como débito) e não exige saldo. | Média | 1E |
| B5 | Criar pedido cria o **cliente antes** de validar os itens: pedido inválido deixa cliente órfão. | Baixa | futura |
| B6 | Criar pedido **não verifica nem reserva estoque** (pode pedir 50 de 1); falha só no `start`/`finish`. | Média (para Fase 4) | 4A |
| B7 | `id` duplicado em planta/pedido → **500** (deveria ser 409). | Baixa | futura |
| B8 | `quantity` 0/inválida vira 1 silenciosamente (`parseInt(...) \|\| 1`); estoque decimal é truncado. | Baixa | futura |
| B9 | Caixa em `REAL`: `0.1 + 0.2` armazenado como `0.30000000000000004` (exibição arredonda). | Baixa/Média | D8 (centavos nas novas tabelas) |
| B10 | Sem autenticação em nenhuma rota (já conhecido, G1). Não testado aqui (1E). | Crítica | 1E |
