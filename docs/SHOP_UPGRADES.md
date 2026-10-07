# Loja de Utilidades e melhorias da Novo Hiper

Primeiro ciclo completo: **entregar → ganhar dinheiro → comprar → voltar → instalar → ver a loja melhorar → persistir**.

## Onde fica cada coisa
| Parte | Autoridade / local |
|---|---|
| Preço, ids e catálogo | `backend/shop/catalog.ts` (o cliente nunca informa preço) |
| Saldo | `cash_transactions` (crédito = venda; compra = `type 'upgrade_purchase'`, id `shop_<upgradeId>`) |
| Propriedade e instalação | tabela `shop_upgrades` (migration 005) |
| Visual e posição | frontend (`src/phaser-game/world/shopUpgrades.ts`, `worldMap.ts`) — **nada de coordenadas no banco** |

## Modelo
`shop_upgrades(upgrade_id PK, price_paid, purchased_at, installed_at NULL, cash_transaction_id UNIQUE)`
- sem linha → `available`; `installed_at` NULL → `pending` (comprada, aguardando instalação); preenchido → `installed`.
- Compra única por melhoria (PK). Se um dia houver mais de um item por lugar, acrescentar `slot_id`.

## API (todas exigem sessão)
- `GET /api/shop` → `{ balance, upgrades: [{ id, name, description, price, state, … }] }`
- `POST /api/shop/upgrades/:id/purchase` → débito + `pending`. Saldo < preço → 400 `INSUFFICIENT_FUNDS` (nada gravado). Repetição → 200 `alreadyApplied: true` sem cobrar.
- `POST /api/shop/upgrades/:id/install` → só se comprada (409 `NOT_PURCHASED`); idempotente.

Transação `BEGIN IMMEDIATE` (mesmo padrão de `/deliveries/:id/finish`): estado e saldo são lidos dentro da transação; só há operações síncronas do SQLite lá dentro. Rede de segurança: PK de `shop_upgrades` e PK do débito.

## Fluxo no jogo
Loja de Utilidades (prédio do quarteirão sul-central, calçada da H3) → painel de compra → Novo Hiper (calçada da porta) → "Instalar" → a fachada muda. O Phaser só emite intents (`openShop`, `openInstall`); o React fala com a API e publica o estado no snapshot (saldo, melhorias instaladas/pendentes).

## Catálogo
| Melhoria | Preço | Estado |
|---|---|---|
| Placa de madeira (fachada) | R$ 60 | **implementada** |
| Jardineiras floridas | R$ 90 | planejada |
| Banco de madeira | R$ 120 | planejada |
| Claraboia de vidro no telhado | R$ 200 | planejada |

Os itens planejados ainda não existem no catálogo do backend nem no jogo: entram quando forem implementados.

## Testes
- Backend (banco descartável por teste): `tests/backend/shop.test.ts`.
- E2E em **backend isolado** (banco temporário descartável, sobe sozinho no `playwright test`): `tests/e2e/*.isolated.spec.ts`; infraestrutura em `scripts/e2e-isolated-backend.mjs` e `playwright.config.ts` (project `isolated`). O `data-dev` compartilhado fica para o teste **manual**; testes que controlam saldo/estado devem usar o isolado.
