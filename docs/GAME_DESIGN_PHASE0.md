# Novo Hiper — Aventura: Documento Técnico da Fase 0

> **Status:** Fase 0 (análise e arquitetura). Nenhum código, banco, migration ou produção foi alterado.
> **Base:** `NOVO_HIPER_GAME_DESIGN_V2.md` + estado do repositório em `e46a6a0` (`main`).
> **Regra:** este documento descreve o que **será** construído. Nada aqui está implementado.
> Todo trecho de SQL/TypeScript é **ilustrativo** (esboço de contrato), não migration.

---

## 0. Sumário executivo

**Decisões já tomadas pelo Bernardo (fixas neste documento)**

| # | Decisão |
|---|---|
| D1 | Autenticação real validada no servidor (Fase 1). APIs privadas não aceitam chamadas anônimas; só `/api/health` (e o que for deliberadamente público) fica aberto. Sem multiusuário. |
| D2 | Backend **obrigatório** para qualquer operação da Aventura que altere estado importante. Sem sincronização offline de entregas, dinheiro, estoque, compras, inventário, progresso. Offline = no máximo conteúdo cacheado em modo leitura. |
| D3 | A geração **oficial** de pedidos passa para o backend (documentada aqui; implementada na Fase 4). |
| D4 | `POST /deliveries/:id/finish` é **idempotente de verdade**: repetir devolve 200 com o estado já concluído, sem novo estoque/caixa/progresso. Teste explícito na Fase 1. |
| D5 | "Planta cadastrada" **não** se infere por prefixo de id. Origem explícita (`source`). Distinguir atual × total histórico × maior marco. Excluir planta nunca re-bloqueia região. |
| D6 | UI híbrida: **Phaser** = mundo; **React** = menus, loja, inventário, diálogos, overlays. Ponte limpa React↔Phaser. |
| D7 | Clientes e residências **fictícios**. Dados reais de Olinda só para bairros, ruas, praças, parques, landmarks públicos, referência visual. |
| D8 | Novas tabelas usam **centavos inteiros**. O modelo financeiro existente não é migrado agora; este documento define a convivência. |
| D9 | A Fase 1 inclui um procedimento **reproduzível e testado** de backup do SQLite com WAL (com `integrity_check` e validação de contagens). |

### 0.1 Decisões P1–P12 (resolvidas pelo Bernardo após a Fase 0)

| ID | Decisão | Consequência técnica |
|---|---|---|
| **P1** | Cookie de sessão **HttpOnly + Secure + SameSite=Strict**, validado no backend. Duração inicial **30 dias**. **Logout invalida a sessão** no servidor. **Nenhuma** credencial/sessão sensível em `localStorage`. | Sessão precisa de estado revogável no servidor (tabela de sessões ou lista de revogação) — um token puramente stateless não atende "logout invalida". Detalhar na 1E. |
| **P2** | `source='migration'` **NÃO** conta para gatilhos de "plantas cadastradas por Bernardo". **Somente `source='user'` conta.** Plantas `migration` continuam existindo normalmente no catálogo. | Elegibilidade para métricas = `source = 'user'` (substitui a proposta `user`+`migration` da §8.2). |
| **P3** | Desbloqueios de crescimento do catálogo usam **marco histórico** (`plants_max`). Excluir planta não regride. Métricas atuais continuam disponíveis para regras que precisem delas. | Confirma a §7.1/7.3. |
| **P4** | O timer automático **não** faz parte da Aventura nova. **Não remover** o comportamento legado agora. Geração futura controlada pelo servidor e pelo estado do jogo. | Confirma a §10; o timer do `App.tsx` permanece intocado. |
| **P5** | Preços de itens **fixos/configuráveis em centavos**. Sem precificação dinâmica. Ganho médio só para balanceamento de design. | Catálogo `shop/catalog.json` com `priceCents`. |
| **P6** | Câmera e ventilador reaproveitados **conceitualmente** no sistema novo de itens/upgrades. Sem acoplar a arquitetura nova à implementação antiga. | Itens novos no catálogo; nada importado de `storeUpgrades.ts`. Resolve P6 da §23 ("recomeçar"). |
| **P7** | V1 começa com **1 pedido ativo**. Arquitetura pode permitir expansão futura. | Limite configurável (constante/regra), valor inicial 1. |
| **P8** | "Loja de Utilidades" continua nome **provisório**. **Manter `src/phaser-game`** por ora; sem rename estrutural sem necessidade. | A árvore `src/adventure/` da §5.3 é **alvo conceitual**; as pastas internas (`bridge/`, `world/`, `ui/`…) podem ser criadas dentro de `src/phaser-game/`. |
| **P9** | Jogo antigo continua visível durante a V1. Não remover nem alterar sem autorização. | Classe **C** mantida até nova decisão. |
| **P10** | **ODbL é gate da Fase 9.** Antes de distribuir dataset derivado de OSM, revisão específica. Não bloqueia as fases atuais. | Sem ação antes da Fase 9. |
| **P11** | A senha atual será **substituída na implantação da Fase 1E**. A nova senha **não** pode ser commitada, hardcoded nem registrada em documentação; o Bernardo a define **direto no ambiente de produção**. A mudança de auth em produção exige **presença/autorização explícita** dele. | O código só lê hash/segredo de variáveis de ambiente; nenhum valor padrão de senha no repositório depois da 1E (inclui remover o texto da tela de login e o default de `E2E_PASSWORD`/hash embutido). Deploy da 1E só com o Bernardo presente. |
| **P12** | Cadastro de plantas **continua no React**. O Phaser apenas reage ao estado persistido no backend. | Nenhuma tela de cadastro no jogo. |

> Estas decisões **substituem** as recomendações correspondentes da §23, que fica preservada abaixo apenas como histórico.

**Os cinco pilares técnicos propostos**

1. **Servidor é a autoridade** de plantas, pedidos, estoque, caixa, progresso, compras e inventário. Phaser e React são clientes.
2. **Progresso por eventos append-only** (`progress_events` com chave de idempotência) → contadores/marcos derivados → **motor de regras** data-driven que concede `unlocks` permanentes (`onceOnly`).
3. **Mundo = regiões data-driven** (JSON versionado, carregado sob demanda), nunca `mapa1/mapa2`. A região 0 é o mapa pequeno de partida.
4. **Ponte React↔Phaser tipada**: Phaser emite *intenções espaciais* (`interact`), React decide UI/chamadas à API, e devolve um *snapshot* de estado somente-leitura. Phaser nunca chama a API de negócio.
5. **Pipeline geográfico offline** (build-time) que gera JSON próprio; nenhum mapa online em runtime; procedural **determinístico** com versão e overrides manuais.

**Descobertas do estado atual que condicionam o plano** (detalhes na §1)

- 🔴 **O backend não valida autenticação.** O token de login é gerado e descartado; nenhuma rota o verifica. Hoje qualquer pessoa na internet lê/escreve plantas, pedidos, caixa e entregas (`GET /api/cash` responde sem credencial em produção). → Fase 1.
- 🔴 `POST /api/cash` aceita **crédito direto** (dinheiro "do nada") e `/api/migration` é uma rota destrutiva/privilegiada, ambas sem proteção.
- 🟠 O frontend usa `localStorage` como fonte primária e o backend como espelho opcional (`if (isBackendConnected)`). Conflita com D2/§20.
- 🟠 Pedidos são gerados no navegador (`createNewRandomOrder`) e enviados ao backend. Conflita com D3.
- 🟠 O backend não distingue planta do usuário × preset × migração. Conflita com D5.
- 🟠 `finish` repetido devolve **400** (não idempotente por D4). Excluir planta já entregue provavelmente falha por FK (a confirmar na Fase 1).
- 🟡 Destinos legados têm **endereços reais** (rua + número). Conflita com D7.

---

## 1. Inventário técnico do estado atual

### 1.1 Aplicação (React + Vite + Express + SQLite)

| Camada | Situação |
|---|---|
| Backend | Express + `node:sqlite` (Node 22). 9 routers (`auth, plants, customers, orders, deliveries, cash, game, upload, migration`), ~2.060 linhas. Sem middleware de auth. WAL ligado, `foreign_keys=ON`. |
| Esquema | `plants, customers, orders, order_items, deliveries, cash_transactions, game_progress` (ids `TEXT`, tempos em `INTEGER` ms, dinheiro `REAL` em reais). `game_progress` já tem `active_order_id, active_delivery_id, player_x/y, mission_state, store_upgrades`, **hoje pouco usada**. |
| Finish de entrega | Transacional (`BEGIN/COMMIT/ROLLBACK`), baixa estoque, marca entrega/pedido `entregue`, cria `cash_transactions` (checa existência por `order_id`, que é `UNIQUE`). Repetição → 400. |
| Frontend | `App.tsx` mantém plantas/pedidos/caixa/destinos em estado + `localStorage`, com *write-through* ao backend se conectado. Crédito no caixa é aplicado **localmente primeiro** e o backend recebe depois (`startDelivery` → `finishDelivery`). Há geração automática de pedidos por timer. |
| Melhorias da loja | `camera` e `ventilador` (R$ 45 / R$ 35), **somente** em `localStorage` (`novo_hiper_loja_melhorias_v1`). |
| Destinos/clientes | `REALISTIC_DESTINATIONS` (id `dest_*`, endereço com rua e número reais de Olinda, lat/lng) + `FICTIONAL_CUSTOMERS` (12 já migrados para a produção). |

### 1.2 Jogo antigo (`src/game/` + `src/components/game/`, ≈ 4.940 linhas)

Canvas 2D desenhado por código (sem assets), acoplado a React por `useGameEngine` (hook com loop `requestAnimationFrame`).

| Arquivo | Linhas | Papel |
|---|---:|---|
| `architectureRenderer.ts` | 1.081 | Desenho vetorial de edifícios coloniais (loja, 3 casas, coreto, igreja, telhados, janelas, toldo, placa) |
| `spriteRenderer.ts` | 810 | Bernardo (pernas/tronco/cabeça/cabelo/braços/planta carregada/selo de status) e 3 clientes desenhados |
| `natureRenderer.ts` | 504 | Palmeira, ipê, poste, banco, canteiro, vaso, paralelepípedo, pavimento português |
| `useGameEngine.ts` | 428 | Máquina de estados da missão, movimento, interação (`pickup`/`deliver`), partículas, persistência de posição |
| `renderer.ts` | 415 | Terreno, ruas/calçadas, guia da rota (bússola), marcadores de interação, Y-sort, partículas |
| `mapData.ts` | 222 | Mapa 1360×960: 6 construções, decorações, obstáculos |
| `types.ts` | 123 | `MissionState`, `DeliveryMission`, `MapBuilding`, … |
| `collisionSystem.ts` | 96 | AABB + deslize em eixos |
| `components/game/*.tsx` | ≈1.560 | `DeliveryGameView`, `MissionSelectModal`, `DeliverySuccessModal`, `StoreUpgradesModal`, `VirtualControls` (joystick + D-pad) |
| `services/gameStorage.ts` | — | Missão ativa e posição do jogador em `localStorage` |

**Máquina de missão antiga:** `AGUARDANDO_INICIO → INDO_PARA_RETIRADA → PLANTA_RETIRADA → INDO_PARA_CLIENTE → PRONTO_PARA_ENTREGA → ENTREGA_CONCLUIDA → FINALIZADA`. É um bom modelo conceitual para a entrega nova.

### 1.3 Aventura Phaser (`src/phaser-game/`, em produção como "Aventura (Beta)")

| Parte | Estado |
|---|---|
| Cenas | `WorldScene` (protótipo abstrato 1600×1200, 1 entrada), `PlatformScene` (1 fase, 2 buracos de 120 px, validada) |
| Módulos puros testados | `config/{platform,world,sprite}Config`, `logic/{jumpPhysics,worldEntrance,fall,animation}`, `input/InputState`, `phaserGlobals` (mitiga vazamento de listeners do Phaser 3.90) |
| UI | `AdventureGameScreen` (React) monta/destrói `Phaser.Game`; `TouchControls` (D-pad + pulo). **Não há botão/ação "interagir"**, nem camada de diálogo. |
| Dados | Nenhum. Não lê plantas, pedidos, clientes ou progresso. |
| Sprites | Plataforma integrada (idle/walk/jump/thumbs-up). Top-down em `design-assets/` (não integrado). |
| Testes | 43 unitários (Vitest) + 19 E2E (Playwright/Chrome real, backend isolado de dev). Nenhum teste de backend. |
| Diagnóstico | `window.__NH_ADVENTURE__` só com `import.meta.env.DEV`. |

### 1.4 Débitos/lacunas relevantes para o plano

| ID | Achado | Impacto | Onde trato |
|---|---|---|---|
| G1 | Sem autenticação no backend | Qualquer um altera dinheiro/estoque | Fase 1 |
| G2 | `POST /api/cash` aceita `credit` livre; `/api/migration` aberto | Fraude/estrago mesmo com auth se não restringir | Fase 1 |
| G3 | `finish` repetido → 400 | Viola D4 | Fase 1 |
| G4 | Exclusão de planta com histórico **quebra por FK (CONFIRMADO na 1A: HTTP 500)** | Viola §7 (planta excluída não pode travar nada) | Fase 1D |
| G5 | Sem `source` em `plants` | Impossível contar "plantas cadastradas" no servidor | Fase 2 |
| G6 | Pedidos gerados no cliente | Viola D3 | Fase 4 |
| G7 | Estado primário em `localStorage` | Viola §20/D2 para a Aventura | Fases 2–4 (Aventura nasce server-first; legado fica como está) |
| G8 | Dinheiro `REAL` | Deriva de arredondamento | §9 (convivência) |
| G9 | Endereços reais nos destinos | Viola D7 | Fase 4 (modelo de clientes) |
| G10 | Senha padrão exibida na tela de login e hash SHA-256 com salt fixo | Credencial pública, hash fraco | Fase 1 |
| G11 | Backup ingênuo/`mode=ro` ignora WAL (erro real cometido no deploy de 06/10) | Backup inválido | Fase 1 (procedimento testado) |
| G12 | Precache PWA 2,7 MB; chunk do Phaser ≈ 1,5 MB | Regiões grandes não podem entrar no precache | §14 |

---

## 2. Core loop definitivo

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ CADASTRAR/AMPLIAR CATÁLOGO (admin React, já existe)                      │
│   └─► evento: plant_registered ─────────────────────────────┐           │
│                                                              ▼           │
│ SERVIDOR gera PEDIDO (plantas reais + estoque + cliente/destino elegível)│
│   └─► evento: order_generated                                            │
│                                                                          │
│ NOVO HIPER (hub)  ──► pegar a planta do pedido ativo                     │
│   └─► sair ► EXPLORAR BAIRRO ► achar cliente                             │
│        (opcional) ► entrada especial ► PlatformScene ► cliente           │
│   └─► ENTREGAR (animação/joinha)                                         │
│   └─► React → POST /finish  (idempotente)                                │
│          ├─ estoque −1 vez        ├─ caixa +1 vez                        │
│          └─ progress_event(delivery_completed:<id>)                      │
│                       └─► MOTOR DE REGRAS avalia ► unlocks (once-only)   │
│                                                    └─► evento anunciado  │
│ DINHEIRO ─► LOJA DE UTILIDADES ─► INVENTÁRIO ─► Novo Hiper (colocar)     │
│        └────────────── mundo cresce / loja fica mais bonita ─────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

**Invariantes do loop**

- Sem cronômetro, vidas, Game Over, ranking por velocidade. Queda/erro → checkpoint seguro.
- Exploração livre mesmo sem pedido; o pedido ativo só orienta (bússola/marcador).
- Toda mutação importante passa por **uma chamada de API transacional e idempotente**; o jogo apenas a dispara e reflete o resultado.
- O estado de progresso nunca é calculado no cliente.

---

## 3. Jornada dos primeiros 10–15 minutos

Pressupõe um Bernardo real com catálogo possivelmente **pequeno ou vazio**. Nada assume espécie específica.

| Min | Momento | O que acontece | Sistema |
|---:|---|---|---|
| 0–1 | Abrir Aventura | Câmera na Novo Hiper (interior/fachada), Bernardo parado, dica curta | Região 0, snapshot |
| 1–2 | **Sem plantas?** | Aviso amigável: "Cadastre uma planta para receber o primeiro pedido" com botão para o catálogo (React). Sem bloqueio do mapa: pode explorar | Regra `no_plants` |
| 2–3 | Pedido 1 chega | Anúncio curto + balão no balcão. Bússola aponta o balcão | `order_generated` |
| 3–4 | Pegar a planta | Interagir no balcão → planta nas mãos (sprite "carregando"; arte a definir) | `interact(pickup)` |
| 4–7 | Sair e achar o cliente | Rua inicial e praça; cliente 1 é **próximo**, sem plataforma | Região 0 |
| 7–8 | Entregar | Interagir com o cliente → diálogo → joinha | `interact(deliver)` → `POST /finish` |
| 8–9 | Recompensa | "+R$ x" no caixa (React), som, partículas | resposta do `finish` |
| 9–10 | Volta/ vê a rua bloqueada | Placa "Em obras — volta mais tarde". Curiosidade, não obrigação | Saída bloqueada |
| 10–13 | Pedido 2 (mais longe) | Cliente 2 na outra ponta do mapa inicial; incentiva explorar | `order_generated` |
| 13–15 | Primeira vitrine de progresso | Dinheiro suficiente para o item mais barato? Loja de Utilidades visível (porta fechada/ "em breve" até a Fase 6) | Regras |

**Princípios:** recompensa a cada ~3 min; no máximo 1 linha de texto por tela; tutorial por *fazer* (dicas contextuais, nunca modal longo).

---

## 4. Jornada das primeiras 5 entregas (adaptável ao catálogo real)

O servidor escolhe **tipo de entrega por posição na jornada**, não por espécie.

| Entrega | Intenção | Destino | Plataforma | Pode destravar |
|---:|---|---|:---:|---|
| 1 | Ensinar o ciclo completo | Casa mais próxima (≤ 1 quarteirão) | Não | — (mas conta para métricas) |
| 2 | Incentivar explorar | Casa na outra extremidade da região 0 | Não | Marco "2 entregas" (anúncio leve) |
| 3 | Primeira porta de progresso | Cliente na praça | Não | Pode abrir a **primeira expansão** conforme gatilhos (§7.4) |
| 4 | Variedade | Cliente novo (vindo da expansão, se aberta) | Não | Loja de Utilidades acessível |
| 5 | Primeira aventura | Destino com `kind: platform` (quintal/terreno) | **Sim** (1 destino) | Compra do 1º item possível |

**Adaptação ao catálogo:**
- Pedido 1 exige apenas ≥ 1 planta com estoque. Pedidos seguintes preferem **variedade** (evitar a mesma planta em pedidos consecutivos quando houver alternativa) mas aceitam repetir se o catálogo tem 1 espécie.
- Se o estoque acabar: o servidor **não gera** pedido e devolve `reason: 'no_stock'` → React mostra "Reabasteça o catálogo".
- Quantidade/variedade de plantas só **abre conteúdo extra**, nunca é pré-requisito para as 5 primeiras entregas.

---

## 5. Arquitetura React + Phaser

### 5.1 Responsabilidades

| Camada | Dono de | Nunca faz |
|---|---|---|
| **Servidor** | Plantas, pedidos, estoque, caixa, progresso, unlocks, compras, inventário, posições de itens | Renderizar nada |
| **React** | Chamadas à API, autenticação, estado de negócio em memória (snapshot), menus, diálogos, loja, inventário, modo organizar, anúncios, HUD de dinheiro, acessibilidade | Física, colisão, câmera |
| **Phaser** | Renderização do mundo, movimento, colisão, câmera, animação, plataforma, **detectar interações espaciais** | `fetch` de negócio, decidir dinheiro/estoque/progresso, abrir menus complexos |

### 5.2 Ponte (`AdventureBridge`)

Objeto criado pelo React ao montar a Aventura, guardado em `game.registry.set('bridge', bridge)`. Dois canais **tipados**, sem acoplamento direto de classes:

```ts
// Phaser → React (intenções espaciais; nunca mutam estado de negócio)
type WorldEvent =
  | { type: 'interact'; kind: 'pickup' | 'customer' | 'shop' | 'door' | 'sign'; targetId: string }
  | { type: 'enteredRegion'; regionId: string }
  | { type: 'platformCompleted'; areaId: string }     // plataforma terminou (fase 8)
  | { type: 'ready' } ;

// React → Phaser (comandos e estado)
type WorldCommand =
  | { type: 'applySnapshot'; snapshot: WorldSnapshot }   // substitui estado de leitura
  | { type: 'setInputEnabled'; enabled: boolean }       // pausa input quando há overlay
  | { type: 'playAnimation'; actor: 'player' | string; name: 'thumbsUp' | 'carry' | 'idle' }
  | { type: 'focus'; targetId: string }                  // câmera/bússola
  | { type: 'revealRegion'; regionId: string };          // após anúncio de unlock
```

- Implementação: um *emitter* mínimo próprio (≈30 linhas) ou `Phaser.Events.EventEmitter`; **sem** dependência de estado global compartilhado. Não usa `window`.
- **Snapshot (`WorldSnapshot`)** — somente leitura para o Phaser, montado pelo React a partir de `GET /api/adventure/state`:
  `regions[] (id, unlocked, version)`, `activeOrder?`, `customers[] (id, regionId, slotId)`, `placements[]`, `upgrades[]`, `unseenEvents[]`, `player {regionId, x, y}`, `flags`.
- **Ciclo de uma interação:** Phaser emite `interact` → React `setInputEnabled(false)` → abre diálogo/chama API → recebe resposta → `applySnapshot` → `playAnimation` → `setInputEnabled(true)`.
- **Política offline (D2):** sem backend, o snapshot cacheado pode alimentar `applySnapshot` em **modo leitura** (`flags.readOnly = true`): o jogador caminha, mas `interact` que exigiria mutação mostra "Sem conexão" e **não enfileira nada**.

### 5.3 Estrutura de arquivos proposta (evitar `WorldScene` monolítica)

```text
src/adventure/                      # (nome final a decidir; hoje: src/phaser-game/)
├── AdventureApp.tsx                # raiz React: Provider, ponte, HUD, overlays
├── bridge/
│   ├── bridge.ts                   # tipos WorldEvent/WorldCommand + emitter
│   └── useAdventureBridge.ts
├── state/
│   ├── api.ts                      # cliente da API da Aventura (autenticado)
│   ├── useAdventureState.ts        # snapshot, refresh, estados de erro/offline
│   └── types.ts                    # WorldSnapshot, DTOs
├── ui/                             # SOMENTE React
│   ├── DialogOverlay.tsx  ShopOverlay.tsx  InventoryOverlay.tsx
│   ├── PlacementOverlay.tsx  UnlockAnnouncement.tsx  Hud.tsx
│   └── TouchControls.tsx           # + botão de Interagir
├── game/                           # SOMENTE Phaser (sem fetch)
│   ├── createGame.ts  phaserGlobals.ts
│   ├── input/InputState.ts         # + ação 'interact'
│   ├── scenes/
│   │   ├── BootScene.ts            # carrega assets mínimos
│   │   ├── WorldScene.ts           # orquestra: carrega região, câmera, jogador
│   │   ├── PlatformScene.ts        # existente
│   │   └── InteriorScene.ts        # Novo Hiper por dentro (Fase 7)
│   ├── world/
│   │   ├── RegionLoader.ts         # busca JSON da região (lazy), cache
│   │   ├── RegionRenderer.ts       # chão/ruas/prédios a partir do JSON
│   │   ├── CollisionMap.ts         # colisores da região
│   │   ├── InteractableRegistry.ts # pontos de interação → eventos
│   │   ├── PlayerController.ts     # movimento + animação top-down
│   │   ├── NpcManager.ts           # clientes/ambiente (posições do snapshot)
│   │   ├── GateManager.ts          # barreiras de áreas bloqueadas
│   │   └── Compass.ts              # guia ao alvo ativo
│   └── platform/                   # lógica/config da plataforma (existente)
├── data/                           # conteúdo versionado (JSON), compartilhável com testes
│   ├── regions/region_00_inicio.json
│   ├── rules/progression.json
│   └── shop/catalog.json
└── shared/                         # TS puro, sem Phaser/React (testável em Node)
    ├── progression/ruleEngine.ts   # avalia regras (usado no servidor e em testes)
    ├── economy/money.ts            # toCents/fromCents/format
    └── region/schema.ts            # validação do formato de região
```

> `shared/` é importado por **servidor e cliente** (mesma lógica de regras/dinheiro, testada uma vez). A migração de `src/phaser-game/` → `src/adventure/` é um *rename* mecânico a fazer na Fase 3A, não agora.

### 5.4 Alternativas descartadas
- *Tudo no canvas (UI Phaser):* difícil em celular (teclado, acessibilidade, scroll), duplica componentes.
- *Phaser chamando a API:* espalha autoridade, dificulta testes e a política offline.
- *Estado global em `window`:* já temos um diagnóstico dev-only; negócio **não** vai por aí.

---

## 6. Regiões, conexões e clientes/destinos

### 6.1 Modelo de região (JSON versionado)

```jsonc
{
  "schema": 1,
  "id": "region_00_inicio",
  "contentVersion": "1.0.0",
  "name": "Novo Hiper e arredores",
  "size": { "w": 1600, "h": 1200 },          // unidades de jogo (px lógicos)
  "unlockRule": null,                         // null = sempre disponível; senão id de regra
  "realWorld": { "municipality": "Olinda", "name": "Varadouro", "inspiration": "loose" }, // opcional
  "tiles": { "ground": "cobble", "layers": [] },
  "roads": [ { "id": "r1", "polyline": [[0,600],[1600,600]], "width": 64, "surface": "cobble" } ],
  "collision": [ { "id": "c1", "type": "rect", "x": 80, "y": 95, "w": 320, "h": 155 } ],
  "buildings": [ { "id": "novo_hiper", "kind": "shop_home", "rect": {…}, "door": { "x": 240, "y": 280 }, "style": "colonial_green" } ],
  "slots": {                                  // pontos nomeados e estáveis
    "customer_home": [ { "id": "ch_01", "door": {…}, "style": "casa_a" } ],
    "interactables": [ { "id": "pickup_counter", "kind": "pickup", "x": 240, "y": 285, "radius": 48 } ],
    "spawns": [ { "id": "player_start", "x": 260, "y": 310 } ],
    "platformEntrances": []                   // Fase 8
  },
  "connections": [
    { "id": "to_rua_norte", "edge": "north", "toRegion": "region_01_rua_norte", "gate": { "unlockRule": "unlock_rua_norte", "lockedVisual": "obras" } }
  ],
  "decor": [ { "kind": "palm", "x": 700, "y": 420 } ],
  "overrides": []                             // §15.2 (item 7)
}
```

**Regras do modelo**
- **Ids estáveis** (região, slot, porta, interagível) — o progresso salvo referencia **ids**, nunca coordenadas.
- **Conexões com *gate*:** uma conexão bloqueada existe no mapa (placa/obra/portão) e **o mesmo desenho** vira passagem aberta quando `unlockRule` está em `unlocks`. Nenhum mapa é reconstruído.
- Uma região só é **carregada** quando o jogador se aproxima/entra; a região 0 vem no bundle principal.
- A validação do schema roda em teste (CI) e no carregamento (falha segura: região inválida = não carrega + log).

### 6.2 Clientes e destinos fictícios

```ts
interface CustomerDef {            // conteúdo do mundo (versionado em JSON), não dado de usuário
  id: string;                      // 'cust_dona_lia'
  name: string;                    // fictício
  regionId: string;
  homeSlotId: string;              // aponta um slot 'customer_home'
  kind: 'casa' | 'comercio' | 'praca' | 'escola' | 'quintal';
  deliveryKind: 'simple' | 'platform';  // define se a entrega usa plataforma
  platformAreaId?: string;         // se 'platform'
  appearance: { palette: string; sprite: string };
  dialogue: { greet: string; thanks: string };  // curto
  minProgress?: string;            // regra que habilita este cliente (opcional)
}
```

**Salvaguardas de privacidade (D7)**
- Nome, número e rua do cliente **não** são reais. Endereço em jogo = *rótulo fictício* ("Casa Azul, Rua das Mangueiras") ou apenas o nome da casa. Nenhum campo `lat/lng` de residência.
- Os destinos legados `REALISTIC_DESTINATIONS` (com número de rua real) **não** migram para o mundo novo: viram *clientes novos* com rótulos fictícios; os 12 clientes já gravados em produção continuam existindo no banco (legado) e podem ser mapeados 1:1 a `CustomerDef` por id quando fizer sentido.
- Casas de cliente são **modelos genéricos** posicionados em slots, nunca geometria derivada de um lote privado real (§15.2, item 8).
- Landmarks públicos (praça, igreja, parque) podem ter o nome real; moradores nunca.

### 6.3 Seleção de cliente pelo servidor (resumo; detalhe na §10)
Cliente elegível = região desbloqueada **e** `minProgress` satisfeito **e** sem pedido aberto **e** compatível com o tipo de entrega desejado para a posição na jornada (§4).

---

## 7. Motor de progressão e gatilhos

### 7.1 Métricas: atual × histórica × acumulada

| Métrica | Tipo | Fonte | Regride? |
|---|---|---|:---:|
| `plants_current` | **Atual** | `COUNT(plants WHERE source IN eligible)` | Sim (é o estado) |
| `plants_registered_total` | **Acumulada** | `progress_events` `plant_registered` | **Não** |
| `plants_max` | **Máximo histórico** | `MAX(plants_current)` já visto | **Não** |
| `species_variety_current / _max` | Atual / Máx. | `COUNT(DISTINCT species)` | Atual sim, máx. não |
| `orders_generated_total` | Acumulada | evento `order_generated` | Não |
| `deliveries_completed_total` | Acumulada | evento `delivery_completed` | Não |
| `revenue_cents_total` | Acumulada | soma de créditos de entrega | Não |
| `cash_balance_cents` | **Atual** | saldo do caixa | Sim |
| `customer_served:<id>` | Evento único | `delivery_completed` por cliente | Não |
| `upgrade_installed:<id>` | Evento único | compra/instalação | Não |
| `region_discovered:<id>` | Evento único | entrada na região | Não |

**Regra de ouro:** regras de **desbloqueio** devem preferir métricas **acumuladas/máximas/únicas**. Métricas **atuais** (`plants_current`, saldo) só entram em regras quando a intenção é de fato "estado agora" (ex.: *oferta temporária*), e nunca para um unlock `onceOnly`. Assim, "4ª planta → Rua Norte" usa `plants_max >= 4` (ou `plants_registered_total`), e excluir planta não desfaz nada.

**Decisão a registrar:** `plants_registered_total` conta cadastros (um *re-cadastro* após exclusão conta de novo?) vs `plants_max` (não conta). Proposta: **usar `plants_max`** para marcos de "tamanho do catálogo" (evita farm de cadastrar/excluir) e `plants_registered_total` apenas informativo. (Pendência P3.)

### 7.2 Eventos como fonte (append-only)

```sql
-- ESBOÇO (não é migration)
CREATE TABLE progress_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,          -- 'plant_registered','order_generated','delivery_completed',...
  ref_id       TEXT NOT NULL,          -- id do objeto (plantId, deliveryId)
  payload      TEXT,                   -- JSON mínimo
  created_at   INTEGER NOT NULL,
  UNIQUE(type, ref_id)                 -- idempotência POR CONSTRUÇÃO
);
```
Contadores são **derivados** (`COUNT(*) WHERE type=…`) ou cacheados em tabela auxiliar atualizada **na mesma transação** do fato de domínio. `UNIQUE(type, ref_id)` impede contar a mesma entrega duas vezes mesmo que `/finish` seja repetido (D4).

### 7.3 Motor de regras (data-driven)

Regras são **dados** (JSON versionado em `data/rules/progression.json`), avaliadas por uma função **pura** em `shared/progression/ruleEngine.ts`:

```ts
interface Rule {
  id: string;                         // 'unlock_rua_norte'
  version: number;
  when: Condition;                    // árvore de condições
  grants: Grant[];                    // efeitos
  onceOnly: boolean;                  // default true
  announce?: { eventId: string };     // evento visível ao jogador (separado do unlock)
}
type Condition =
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { metric: MetricKey; op: '>=' | '>' | '==' | '<=' | '<'; value: number }
  | { event: { type: string; refId?: string } }          // "cliente X atendido", "item Y comprado"
  | { unlocked: string };                                // depende de outro unlock
type Grant =
  | { unlockRegion: string } | { unlockCustomer: string } | { unlockShop: string }
  | { unlockItem: string }  | { reward: { cents: number } /* só se desejado */ };
```

**Avaliação**
- **Quando:** depois de cada transação que cria um `progress_event` (dentro da *mesma* transação ou imediatamente após, em transação própria idempotente). Nunca em polling do cliente.
- **Como:** `evaluate(rules, metrics, existingUnlocks) → newUnlocks[]`. Pura e determinística → testável sem banco.
- **`onceOnly`:** a regra só concede uma vez; `unlocks(rule_id PK)` garante. Re-avaliação com a condição ainda verdadeira não faz nada.
- **Não regressão:** não existe operação `lock`. Remover planta pode tornar a condição falsa, mas o `unlock` persiste.
- **Ordem/dependência:** `unlocked: <ruleId>` permite cadeias; o motor itera até ponto fixo (limite de profundidade, detecção de ciclo no teste de schema).
- **Versionamento:** `rules_version` gravado; mudar uma regra **não revoga** unlocks já concedidos; regra nova que passaria a valer é avaliada normalmente na próxima oportunidade.

**Proibido (regra de código):** `if (plantCount >= 4)` fora de `data/rules/*.json`. Teste de lint simples (grep) na CI para literais de marcos em `src/`.

### 7.4 Regras de exemplo (configuráveis, só ilustram)

```jsonc
[
 { "id":"unlock_rua_norte",       "when": { "metric":"plants_max","op":">=","value":4 },
   "grants":[{"unlockRegion":"region_01_rua_norte"}], "announce":{"eventId":"ev_rua_norte"} },
 { "id":"unlock_novos_clientes",  "when": { "all":[ {"metric":"plants_max","op":">=","value":5},
                                                  {"metric":"deliveries_completed_total","op":">=","value":3} ] },
   "grants":[{"unlockCustomer":"cust_grupo_2"}], "announce":{"eventId":"ev_novos_clientes"} },
 { "id":"unlock_loja_utilidades", "when": { "metric":"deliveries_completed_total","op":">=","value":5 },
   "grants":[{"unlockShop":"shop_utilidades"}], "announce":{"eventId":"ev_loja_nova"} },
 { "id":"unlock_regiao_parque",   "when": { "all":[ {"metric":"plants_max","op":">=","value":8},
                                                  {"metric":"deliveries_completed_total","op":">=","value":10} ] },
   "grants":[{"unlockRegion":"region_02_parque"}] },
 { "id":"unlock_evento_ventilador","when": { "event":{"type":"upgrade_installed","refId":"ventilador"} },
   "grants":[{"unlockCustomer":"cust_visitante_especial"}] }
]
```

### 7.5 Eventos de desbloqueio vs. desbloqueio (persistência separada)
- `unlocks(rule_id, unlocked_at)` = **o que existe**.
- `announcements_seen(event_id, seen_at)` = **o que o jogador já viu**. O anúncio é mostrado enquanto existir `unlock` sem `seen`. Reabrir o jogo em outro dispositivo **não** repete.
- O anúncio (`UnlockAnnouncement.tsx`, React) é enfileirado pelo servidor no snapshot (`unseenEvents[]`) e marcado como visto por `POST /api/progress/announcements/:id/seen` (idempotente).

### 7.6 Reação a nova planta com o jogo já avançado
- Plantas novas entram no **pool elegível imediatamente** (se `source` conta e `stock > 0`); o próximo pedido gerado já pode usá-las.
- Marcos já atingidos **não** disparam de novo (`onceOnly`); marcos acima do atual avaliam normalmente (ex.: já tinha `plants_max = 6`, agora 7 → regra de 8 ainda não; a 8ª libera).
- Se o jogador **removeu** plantas antes e re-cadastra: `plants_max` não sobe até superar o histórico (anti-farm). Mensagem opcional: "Você já alcançou X antes".
- Se o catálogo aumentou muito de uma vez (importação): o motor avalia todas as regras pendentes de uma vez e agrupa os anúncios (máx. 1 modal + lista), evitando "cascata" de popups.

---

## 8. Persistência e esquema futuro (sem migrations)

### 8.1 Princípios
- **SQLite é a única fonte** de progresso importante. `localStorage` só para preferências/cache (volume, modo de controle, última região visitada para *preload*, snapshot de leitura).
- Todas as mutações = **uma transação** + **chave de idempotência** quando o cliente pode repetir.
- Conteúdo do mundo (regiões, regras, catálogo de itens) = **arquivos JSON versionados no repositório** (imutáveis em runtime); o banco guarda **estado do jogador** referenciando ids estáveis.

### 8.2 Esboço de entidades

> Convenções do projeto: `id TEXT PK`, tempos `INTEGER` (ms), dinheiro novo em **centavos `INTEGER`**.

```sql
-- (A) plants: origem explícita (D5)
ALTER TABLE plants ADD COLUMN source TEXT NOT NULL DEFAULT 'user'
  CHECK(source IN ('user','preset','migration'));
-- backfill proposto: prefixos conhecidos → 'preset'; criadas por /api/migration → 'migration'; demais → 'user'.
-- elegibilidade para contagem: source IN ('user','migration')  [ver pendência P2]

-- (B) eventos de progresso (§7.2)
CREATE TABLE progress_events (...);   -- UNIQUE(type, ref_id)

-- (C) estado derivado/cache de marcos (opcional; recomputável a partir de B)
CREATE TABLE progress_counters (
  key TEXT PRIMARY KEY, value INTEGER NOT NULL, max_value INTEGER NOT NULL, updated_at INTEGER NOT NULL);

-- (D) desbloqueios permanentes e anúncios
CREATE TABLE unlocks (
  rule_id TEXT PRIMARY KEY, rules_version INTEGER NOT NULL,
  unlocked_at INTEGER NOT NULL, source_event_id TEXT);
CREATE TABLE announcements_seen (event_id TEXT PRIMARY KEY, seen_at INTEGER NOT NULL);

-- (E) estado do jogador (evoluir a game_progress existente)
--   active_order_id, carrying_plant_id, last_region_id, player_x, player_y, updated_at

-- (F) economia da loja (centavos)
CREATE TABLE purchases (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  idempotency_key TEXT NOT NULL UNIQUE, cash_tx_id TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, purchase_id TEXT NOT NULL UNIQUE,
  acquired_at INTEGER NOT NULL);
CREATE TABLE placements (                       -- slots de decoração/móveis
  slot_id TEXT PRIMARY KEY, inventory_item_id TEXT NOT NULL UNIQUE, placed_at INTEGER NOT NULL);
CREATE TABLE store_upgrades (                   -- melhorias estruturais/automáticas
  item_id TEXT PRIMARY KEY, installed_at INTEGER NOT NULL, purchase_id TEXT NOT NULL UNIQUE);

-- (G) pedidos gerados pelo servidor (colunas aditivas)
ALTER TABLE orders ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy'
  CHECK(origin IN ('legacy','manual','server'));
ALTER TABLE orders ADD COLUMN region_id TEXT;
ALTER TABLE orders ADD COLUMN delivery_kind TEXT CHECK(delivery_kind IN ('simple','platform'));

-- (H) clientes: referenciar definições de conteúdo (cliente é conteúdo; a linha no banco registra vínculo/uso)
ALTER TABLE customers ADD COLUMN content_id TEXT;       -- id em data/…/customers
ALTER TABLE customers ADD COLUMN is_fictional INTEGER NOT NULL DEFAULT 1;
```

### 8.3 Fonte de verdade por assunto

| Assunto | Fonte | Observação |
|---|---|---|
| Plantas, estoque | `plants` | Catálogo único. **Sem catálogo paralelo no Phaser.** |
| Pedidos/entregas | `orders`, `deliveries` | Gerados no servidor (Fase 4) |
| Caixa | `cash_transactions` | Único livro-caixa; compras usam `type='upgrade_purchase'` (já existe) |
| Progresso | `progress_events` + `unlocks` | Idempotente por construção |
| Itens/inventário/posições | `purchases/inventory_items/placements/store_upgrades` | Restaura em qualquer dispositivo |
| Mundo | JSON versionado no repositório | `contentVersion` por região |
| Preferências | `localStorage` | Perder isso não afeta progresso |

### 8.4 Migração do estado legado
- **Melhorias `camera`/`ventilador` (hoje em `localStorage`)**: o legado continua assim (jogo antigo congelado — classe C). Na Fase 6, `store_upgrades` nasce vazio; **decisão pendente (P6)** se esses dois itens do jogo antigo serão importados como já comprados (exigiria um endpoint de importação manual, único e idempotente, acionado pelo Bernardo) ou recomeçam.
- **Missão ativa/posição do jogo antigo (`localStorage`)**: ignoradas pela Aventura.

---

## 9. Economia

### 9.1 Dinheiro: convivência `REAL` (reais) × centavos

**Fato:** `cash_transactions.amount` e `plants.price` são `REAL` em reais; `ORDER total` idem. Continuam assim (D8).

**Regras de convivência**
1. **Fronteira única:** `shared/economy/money.ts` com `toCents(reais) = Math.round(reais * 100)` e `fromCents(c) = c / 100`. **Nenhum** código novo manipula reais como `number` solto.
2. **Domínio novo em centavos:** preços de item, `purchases.price_cents`, recompensas e métricas (`revenue_cents_total`) são inteiros.
3. **Escrita no livro-caixa existente:** ao gravar em `cash_transactions` (coluna `REAL`) grava-se `fromCents(c)`, que para valores de 2 casas é representável sem erro prático. O saldo para decisões de compra é calculado em centavos: `SUM(ROUND(amount * 100))`.
4. **Compra:** numa única transação, (a) lê saldo em centavos, (b) rejeita se insuficiente, (c) insere `cash_transactions(type='upgrade_purchase', amount=fromCents(price))`, (d) insere `purchases` + `inventory_items`. Falha em qualquer passo → rollback total.
5. **Teste de convivência obrigatório:** para N valores aleatórios com 2 casas, `ROUND(toCents(x)) == soma exata`; e o saldo em centavos derivado do `REAL` nunca diverge ≥ 1 centavo em 10⁴ operações.
6. **Transição opcional futura (não agora):** coluna aditiva `amount_cents INTEGER` em `cash_transactions` com `CHECK(amount_cents = ROUND(amount*100))` e backfill; só quando houver motivo concreto.

### 9.2 Ganhos e gastos iniciais (proposta; sujeita a P5)
- **Recompensa da entrega** = o que já existe: preço da planta × quantidade (o caixa real). O jogo **não inventa** dinheiro; a recompensa visual é o caixa da loja.
- **Faixa de preços dos itens iniciais:** baixa e fixa — ex.: 1º item ≈ R$ 15–25; ventilador/câmera existentes R$ 35/45 como referência. Como os preços das plantas são do Bernardo (desconhecidos), preços fixos em reais podem ficar "caros demais" se ele cadastra plantas muito baratas. **Alternativa:** preço de item expresso em *"valor de N entregas médias"*. Mais complexa; recomendação: **fixos e baixos na V1**, revisão após teste real.
- **Anti-grind:** sem moeda extra, sem recompensas repetitivas, sem custos de manutenção.
- **Item mais barato alcançável após 2–3 entregas**; ao menos 1 compra possível antes da 5ª entrega.

### 9.3 Proteção financeira (testes obrigatórios — §20)
- `finish` idempotente (D4); crédito único por `order_id` (já `UNIQUE`).
- Compra idempotente por `idempotency_key` (UUID gerado no cliente a cada *intenção* de compra; reenvio devolve o mesmo resultado).
- Concorrência: duas compras simultâneas com saldo para uma → exatamente uma sucede.
- `POST /api/cash` direto: **remover/restringir** `credit` e `adjustment` (Fase 1); créditos só via `finish`, débitos só via compra.

---

## 10. Geração de pedidos pelo servidor (arquitetura; implementação na Fase 4)

```text
POST /api/orders/generate          (autenticado)
  corpo: { }  (o cliente NÃO informa planta/cliente)
  servidor, numa transação:
    1. se já existe pedido aberto (recebido/preparando/pronto) e limite atingido → 409 {reason:'open_order_limit'}
    2. plantas elegíveis = plants WHERE source IN eligible AND stock_quantity > 0
         (reservar? ver nota) ; se vazio → 409 {reason:'no_stock'|'no_plants'}
    3. regiões desbloqueadas ← unlocks; clientes elegíveis ← content + minProgress satisfeito
    4. posição na jornada ← deliveries_completed_total → deliveryKind desejado (§4)
    5. escolher (planta, cliente) por sorteio ponderado: preferir variedade (evitar repetir a
         última planta/cliente quando houver alternativa)
    6. criar orders + order_items + customer link; emitir progress_event(order_generated:<id>)
  resposta: { order, customer, region, deliveryKind }
```

**Pontos de projeto**
- **Aleatoriedade:** `Math.random` aqui é aceitável (pedidos não precisam ser reproduzíveis), mas a função recebe um `rng` injetável → testes determinísticos.
- **Reserva de estoque:** hoje o estoque só baixa no `finish`; `startDelivery` valida. Dois pedidos para a última unidade são possíveis → o `finish` falha para o segundo ("estoque insuficiente"). Proposta: **gerar** só se `estoque − (unidades em pedidos abertos) ≥ 1` (reserva lógica **sem** coluna nova, calculada na consulta). Evita pedido impossível.
- **Limite de pedidos abertos:** 1–2 na V1 (simples para o jogador; evita "pilha de pendências").
- **Gatilho de geração:** (a) botão/ação do React "Aguardar pedido"; (b) automática após `finish` (+ pequeno atraso narrativo); (c) após cadastrar a 1ª planta. **Sem timer no cliente.** (Pendência P4: o timer automático atual do legado continua só no jogo antigo.)
- **Compat. com o legado:** o fluxo antigo (cliente cria pedido via `POST /api/orders`) continua funcionando até decisão futura; a Aventura usa **apenas** `generate`. Pedidos têm `origin` para distinguir.
- **Pedidos que "descobrem o mundo" (§10 do V2):** o cliente/pedido pode carregar `unlockOnDelivery` (regra por evento `customer_served:<id>`), tratado pelo motor.

---

## 11. Loja de Utilidades, catálogo de itens, inventário, colocação

### 11.1 Loja de Utilidades (estabelecimento físico, não modal da Novo Hiper)
Fluxo (V2 §12): sair → andar → entrar → interagir com vendedor → **overlay React** com itens → comprar → voltar → inventário → colocar.
- **Phaser:** porta + vendedor como `interactable` (`kind: 'shop'`); animação do vendedor.
- **React:** `ShopOverlay` (lista, preço, saldo, comprar). `POST /api/shop/purchase { itemId, idempotencyKey }`.
- Visível cedo (V2): na V1 a loja é visível desde a região 0, mas **abre** por regra (5 entregas, §7.4) — antes disso mostra placa "Abre em breve".

### 11.2 Catálogo de itens (conteúdo versionado, V1 pequena)

| Tipo | Itens V1 (proposta) | Colocação |
|---|---|---|
| Estrutural/automático | **Ventilador** (já existe no legado), **Câmera** (existente) | `store_upgrades`, aparece sozinho na loja |
| Posicionável | **Prateleira**, **Vaso decorativo** (1–2 itens) | Slots |
| Fora da V1 | Balcão, mesa, expositor, armário, tapete, luminária, fachada, placa externa | V2 |

```jsonc
{ "id":"item_prateleira","kind":"furniture","name":"Prateleira de madeira",
  "priceCents":2500,"placement":{"slotTypes":["wall_shelf"],"size":[1,1]},
  "unlockRule":null,"art":{"inventory":"…","placed":"…"} }
```

### 11.3 Inventário (V1)
`inventory_items` (itens comprados e **não** colocados) + `placements` (colocados). Um item comprado vira **1 linha**; `UNIQUE(purchase_id)` impede duplicar por reenvio. Sem empilhar/vender/descartar na V1.

### 11.4 Colocação de móveis/decoração (V1)
- **Slots fixos nomeados** na `InteriorScene` (ex.: `wall_shelf_1..4`, `floor_spot_1..3`), **não** pixel a pixel, **não** grade livre (mobile-friendly).
- **Modo organizar (React + Phaser):** React abre `PlacementOverlay` com o inventário; Phaser destaca slots válidos (`applySnapshot` + `highlightSlots`); toque no slot → `POST /api/placements { slotId, inventoryItemId }` (valida tipo/slot livre) → snapshot atualiza.
- **Restauração:** `placements` vêm no snapshot → qualquer dispositivo reproduz a loja idêntica.
- **Estruturais** (fachada, ventilador): sem modo organizar; aparecem na interior/fachada ao serem instaladas.

---

## 12. Integração pedido real ↔ Phaser (Fase 4)

### 12.1 Máquina de estados da entrega (servidor autoritativo)

```text
pedido: recebido ──► preparando ──► pronto ──► (entrega iniciada) ──► entregue
                                      │
                     jogador "pega a planta" (pickup)  = marca pedido 'pronto' + game_progress.carrying_plant_id
```
Reaproveitar os estados existentes (`recebido/preparando/pronto/entregue`; `deliveries: iniciada/a_caminho/entregue`) — **sem** estados novos na V1. O "a_caminho" corresponde a `carrying`.

### 12.2 Chamadas e quem as faz

| Passo no jogo | Evento Phaser→React | Ação React → API | Efeito |
|---|---|---|---|
| Pegar planta | `interact(pickup, counter)` | `POST /api/adventure/pickup {orderId}` | pedido→`pronto`, `carrying_plant_id`, cria/retoma `delivery` `a_caminho` (idempotente por `order_id UNIQUE`) |
| Entregar | `interact(customer, id)` + validação de proximidade | `POST /api/deliveries/:id/finish` | estoque −1 vez, caixa +1 vez, evento `delivery_completed`, avalia regras |
| Animação | — | resposta 200 → `playAnimation(thumbsUp)` → `applySnapshot` | joinha; unlocks/anúncios no snapshot |
| Repetição | (rede instável, duplo toque) | mesma chamada | **200 com o estado já concluído**; nenhum efeito extra |

**Importante:** o **joinha acontece depois do 200** do servidor (o jogo não celebra uma entrega que o servidor rejeitou). Em falha de rede: o personagem espera, mostra "Tentando de novo…", repete a mesma chamada (segura por idempotência); sem backend → "Sem conexão", **nada** é enfileirado (D2).

### 12.3 Resposta do `finish` (contrato proposto)
```jsonc
{ "delivery": {"id","status":"entregue","finishedAt"}, "order": {"id","status":"entregue"},
  "cash": {"balanceCents": 12500, "creditedCents": 1000, "alreadyApplied": false},
  "progress": { "newUnlocks": ["unlock_rua_norte"], "unseenAnnouncements": ["ev_rua_norte"] } }
```
Na repetição: `alreadyApplied: true`, `newUnlocks: []` (já concedidos antes), mesmos valores de caixa.

### 12.4 Entrega com `PlatformScene` (Fase 8)
- Só quando o cliente tem `deliveryKind: 'platform'` e `platformAreaId`. Phaser abre a plataforma pela entrada especial **da região**.
- A `PlatformScene` conclui com `platformCompleted` → o cliente "recebe" a planta no fim da fase → **mesmo** fluxo de `finish`. A plataforma **não** conhece pedidos/dinheiro.
- Falha/queda continuam sem punição (checkpoint já implementado/testado).
- **Uma** plataforma na V1 (quintal do cliente 5). A `PlatformScene` atual precisa ser parametrizada por `areaId` (layout em dados), o que **não** existe hoje (decisão R7).

---

## 13. Eventos/anúncios, progressão persistente e expansão do mapa

### 13.1 Expansão por gatilho (Fase 5 — exatamente **uma** expansão)
```text
snapshot.regions[region_01].unlocked == false  →  GateManager desenha barreira "obras" na conexão norte
servidor concede unlock_rua_norte  →  snapshot.regions[region_01].unlocked = true
  → React exibe UnlockAnnouncement ("NOVA RUA DESBLOQUEADA!")  →  seen
  → Phaser: GateManager anima a barreira abrindo; RegionLoader pré-carrega region_01 (lazy)
```
Persistência: `unlocks`. Reabrir/reload/outro dispositivo → conexão já aberta, sem anúncio repetido.

### 13.2 Regiões sem crescer o monólito
`WorldScene` apenas: carrega região → `RegionRenderer` + `CollisionMap` + `InteractableRegistry` + `GateManager` + `PlayerController`. **Adicionar região = adicionar JSON + regra**, sem tocar a cena.

### 13.3 Progressão persistente — checklist
Regiões, unlocks, eventos vistos, clientes/estabelecimentos desbloqueados, marcos históricos, compras, inventário, posições, upgrades, posição/estado do jogador → **todos no SQLite**.

---

## 14. Carregamento de regiões e PWA

**Problema:** precache atual 2,7 MB (já com chunk do Phaser ≈ 1,5 MB). Regiões ricas (tiles, atlas, landmarks) não podem inflar o *precache*.

**Estratégia**
1. **Precache só do essencial:** shell, Phaser (lazy chunk existente), sprites do Bernardo, **região 0** (JSON ≤ ~100 KB gz) e interior da Novo Hiper.
2. **Regiões fora do precache:** `public/regions/<id>/<contentVersion>/…` (JSON + atlas) com `globIgnores` no Workbox; **CacheFirst** em `runtimeCaching` com nome de cache versionado.
3. **Pré-busca inteligente:** ao receber `unlock` de uma região (ou ao jogador chegar perto da conexão) → `fetch` para aquecer o cache (não bloqueia o jogo).
4. **Versionamento por URL:** `…/1.0.0/region.json` — nova versão = nova URL; cache antigo expira por `ExpirationPlugin`.
5. **Orçamento (propostas):** precache total ≤ 3,5 MB; cada região ≤ 300–500 KB gz; atlas de sprites compartilhado entre regiões.
6. **Offline (D2):** regiões **já visitadas** abrem do cache em **modo leitura**; sem chamadas de negócio.
7. **Teste:** auditoria automatizada do manifesto de precache (falha se > orçamento) + E2E "offline: abrir região visitada".

---

## 15. Pipeline Olinda real → mundo do jogo

> **Nada disso é construído antes das Fases 9/10.** Aqui só se define o desenho para não fechar portas.

### 15.1 Visão

```text
Fontes públicas (OSM, IBGE, outros aprovados)
   │  download manual/versionado (extratos), registro de origem+licença+data+hash
   ▼
IMPORTADOR offline (tools/geo/)  ── filtra: ruas, cruzamentos, praças, parques, pontos públicos
   ▼
SIMPLIFICADOR  ── projeção local → grade de jogo, Douglas-Peucker, snap a ângulos, fusão de ruas
   ▼
FORMATO INTERMEDIÁRIO (geo-ir.json, versionado)  ← revisão humana/diff no git
   ▼
GERADOR PROCEDURAL DETERMINÍSTICO  ── casas fictícias, vegetação, decoração, NPCs
   ▼  + OVERRIDES MANUAIS (landmarks, clientes, plataformas, gates)
JSON DE REGIÃO (§6.1)  ──►  Phaser (runtime não conhece OSM/IBGE)
```

### 15.2 Respostas às 12 perguntas da §29

**1. Representar regiões inspiradas em bairros reais sem acoplar a mapas online.**
Campo opcional `realWorld` (município, nome do bairro, tipo de inspiração: `strict|loose|none`) **apenas como metadado**; a geometria jogável é JSON próprio. Nenhum `fetch` a serviço de mapas em runtime. Ordem de desbloqueio independe da geografia real.

**2. Dados que podem vir de OSM, IBGE e outras fontes.**
- **OpenStreetMap:** malha viária (`highway=*`), cruzamentos, praças/parques (`leisure=park`, `place=square`), orla (`natural=coastline`), pontos públicos (igrejas, museus, mirantes), uso do solo genérico. **Evitar** POIs comerciais privados e qualquer dado de moradores.
- **IBGE:** limites municipais/de bairros e malhas territoriais (para delimitar e nomear regiões), eventualmente setores censitários **apenas** como contorno (sem dados demográficos individuais).
- **Prefeitura de Olinda / dados abertos estaduais (PE):** a verificar existência e termos (patrimônio histórico, equipamentos públicos).
- **IPHAN / patrimônio:** lista de bens para curadoria de landmarks (referência textual; **não** copiar fotos).
- **Não usar:** imagens de satélite/fotos de terceiros, Google Maps/Street View, tiles de OSM como arte.

**3. Licenças/atribuições (a confirmar juridicamente antes da Fase 9).**
- **OSM — ODbL 1.0:** exige atribuição "© OpenStreetMap contributors"; **share-alike** para *Derivative Database* publicamente utilizada; *Produced Works* (ex.: arte renderizada/estilizada do jogo) exigem atribuição mas **não** share-alike. **Risco:** o JSON de ruas simplificado derivado do OSM pode ser considerado *derivative database* — nesse caso esse **dataset** (não o código do jogo) precisaria ser liberado sob ODbL. **Mitigação:** manter os dados derivados do OSM em arquivo/dataset **separado** e licenciado/atribuído, com pasta `data/geo/` própria; o jogo (arte, código, regras) permanece separado como *collective work*; **parecer jurídico simples antes da Fase 9**. Respeitar as políticas de uso das APIs públicas (Overpass/Nominatim têm limites; **não** usar em produção/bulk) → preferir **extratos regionais** (ex.: Geofabrik) processados offline.
- **IBGE:** os dados abertos do IBGE em geral exigem **citação da fonte** e seguem política de dados abertos própria; **confirmar a licença exata de cada dataset** (malhas, limites) no momento do download e registrar em `docs/geo-sources.md`.
- **Atribuição no jogo:** tela "Créditos/Sobre" + `NOTICE`/`ATTRIBUTION.md`. O PWA deve exibir "© OpenStreetMap contributors" quando dados OSM influenciarem as regiões.
- **Landmarks:** nomes/localização públicos são fatos; **desenho próprio estilizado**; sem fotos/ilustrações de terceiros sem licença compatível (CC0/CC-BY com atribuição).
- **LGPD/privacidade:** nenhum dado pessoal; casas fictícias (D7).

**4. Formato intermediário interno (`geo-ir.json`).**
```jsonc
{ "irVersion": 1, "source": [{"name":"OSM","extract":"…","date":"…","sha256":"…","license":"ODbL-1.0"}],
  "origin": { "lat": …, "lng": … }, "projection": "local-equirectangular",
  "nodes": [ { "id":"n1","x":120,"y":340,"kind":"junction" } ],
  "ways":  [ { "id":"w1","kind":"street|path|stairs","name":"…","nodes":["n1","n2"],"width":3 } ],
  "areas": [ { "id":"a1","kind":"square|park|water|block","polygon":[[…]],"name":"…" } ],
  "pois":  [ { "id":"p1","kind":"church|museum|viewpoint","x":…,"y":…,"name":"…","curated":true } ] }
```
Unidades em **metros locais** (plano), antes da escala de jogo; sem lat/lng nos campos do jogo.

**5. Simplificar geometria real → coordenadas de jogo.**
Projeção equiretangular local centrada na região; **escala de compressão** (ex.: 1 m real ≈ 0,15–0,25 unid. de jogo, ajustável por região); simplificação Douglas-Peucker com tolerância; *snap* a ângulos de 15°/45°/90°; remover vielas irrelevantes; limitar nº de ruas/quarteirões; alargar ruas para jogabilidade (larguras mínimas de 48–64 px); garantir **conectividade** (grafo conexo) e **tamanho mínimo de quarteirão** para caber casas/NPCs; ajustar distâncias (percursos ≤ 60–90 s entre pontos de interesse).

**6. Geração procedural determinística.**
`seed = hash(regionId + datasetSha256 + generatorVersion)`; PRNG **semeado e sem estado global** (ex.: `mulberry32`/`sfc32` iniciado por `xmur3(seed)`); **proibido** `Math.random`, `Date`, ordem de iteração não definida; ordenar entidades por id antes de sortear; coordenadas inteiras. **Testes *golden*:** gerar a região 2× → saída idêntica (byte a byte) e comparar com *snapshot* versionado no git.

**7. Overrides manuais sobre região gerada.**
`overrides[]` na região (§6.1), aplicados **depois** do gerador, por **id estável** (ex.: `{"op":"replace","target":"house_17","with":{…}}`, `remove`, `add`, `pin` — fixa um elemento gerado para não mudar quando o algoritmo mudar). Overrides vivem em arquivo separado `regions/<id>.overrides.json` (revisão em PR).

**8. Casas/clientes fictícios sem reproduzir residências identificáveis.**
Casas geradas por **modelos genéricos** (kit de ~8–12 estilos) em slots; **nunca** extrair footprint/forma de edificação residencial do OSM; números e nomes fictícios; clientes e moradores só existem como `CustomerDef` do jogo; revisão de curadoria obrigatória por região (checklist: "nenhum nome/rua/número real de morador").

**9. Landmarks públicos como conteúdo manual.**
Entidades `landmark` em `data/landmarks/*.json` com: id, nome público, posição âncora relativa à região, **sprite/prédio desenhado à mão (estilizado)**, interação opcional (placa/curiosidade), fonte da informação. São **overrides `pin`**: o gerador **reserva** a área; não os recria proceduralmente.

**10. Região gerada entra no sistema de gatilhos.**
É só uma região (§6.1) com `unlockRule` + `connections` — indistinguível das manuais para o motor. O pipeline apenas **produz** o JSON.

**11. Versionar região gerada sem destruir progresso salvo.**
- O progresso referencia **ids estáveis** (região, slot, cliente, porta), nunca coordenadas.
- `contentVersion` (conteúdo) e `generatorVersion` (algoritmo) são separados. **Mudar o gerador não altera regiões publicadas**: cada região publicada é **artefato congelado** (o JSON gerado é commitado/versionado); regerar produz nova `contentVersion`.
- **Teste de compatibilidade:** para cada `contentVersion` nova, validar que todos os ids referenciados pelo estado salvo (clientes, slots de `placements`, gates) ainda existem; se não, a mudança exige **tabela de renomeação** (`idMap`) aplicada na carga.
- Slots de decoração do jogador pertencem à Novo Hiper (interior fixo), não a regiões geradas — risco isolado.

**12. Build-time × runtime.**
- **Build-time/dev tools (`tools/geo/`, não vai ao bundle):** importador, simplificador, gerador, validadores, *golden tests*, curadoria.
- **Runtime (bundle):** `RegionLoader`, `RegionRenderer`, `CollisionMap`, leitura de JSON; **sem** parser OSM, sem projeção, sem gerador pesado.
- Opcional leve em runtime: variações visuais cosméticas determinísticas (ex.: tom de vegetação) a partir de `seed` pré-computado no JSON.

### 15.3 Fontes candidatas (a registrar em `docs/geo-sources.md` na Fase 9)

| Fonte | Conteúdo | Licença/termos (verificar) | Uso proposto |
|---|---|---|---|
| OpenStreetMap (extrato Geofabrik/Overpass pontual) | ruas, praças, parques, POIs públicos | ODbL 1.0 + atribuição | Geometria base (dataset separado) |
| IBGE (malhas territoriais / limites de bairros) | contornos de município/bairro | Termos de dados abertos IBGE (citar fonte) — confirmar | Delimitar e nomear regiões |
| Prefeitura de Olinda / PE dados abertos | equipamentos públicos, patrimônio | A verificar | Curadoria de landmarks |
| IPHAN | bens tombados (lista) | A verificar | Referência textual (sem fotos) |
| Wikimedia/Wikidata | nomes/descrições de lugares | CC0/CC-BY-SA (conforme item) | Só fatos textuais, com atribuição |

---

## 16. Inventário e classificação A/B/C/D do jogo antigo

Legenda: **A** reaproveitar conceito **e código** · **B** reaproveitar conceito, reimplementar em Phaser · **C** manter temporariamente · **D** descartar futuramente.

| Sistema | Arquivo(s) | Linhas | Classe | Justificativa / destino |
|---|---|---:|:---:|---|
| Máquina de estados da missão (`MissionState`) | `types.ts`, `useGameEngine.ts` | ~120 | **B** | Conceito excelente; servidor passa a ser autoritativo; vira estados do fluxo §12 |
| Colisão AABB + deslize | `collisionSystem.ts` | 96 | **A** | TS puro; vai para `shared/` ou `CollisionMap`; já testável em Node |
| Dados do mapa (construções/decor/obstáculos) | `mapData.ts` | 222 | **B** | Reaproveitar **layout e ideias** como seed da região 0 em JSON; coordenadas/tamanhos úteis |
| Interação `pickup`/`deliver` + prompts por proximidade | `useGameEngine.ts`, `types.ts` | ~150 | **B** | Vira `InteractableRegistry` + botão Interagir (React/Touch) |
| Bússola/guia de rota e marcadores | `renderer.ts` | ~110 | **B** | `Compass.ts` em Phaser |
| Y-sort/profundidade | `renderer.ts` | ~70 | **B** | Phaser tem `setDepth(y)` |
| Partículas (folha, brilho, coração, poeira) | `useGameEngine.ts`, `renderer.ts` | ~120 | **B** | Phaser `ParticleEmitter` |
| Terreno, ruas, calçadas, paralelepípedo | `renderer.ts`, `natureRenderer.ts` | ~300 | **B** | Cores/estilo reaproveitados como arte/tiles na região 0 |
| Natureza (palmeira, ipê, poste, banco, canteiro, vaso) | `natureRenderer.ts` | ~500 | **B** | Gerar **sprites/atlas** a partir do desenho (capturar o canvas em PNG) ou redesenhar |
| Arquitetura (loja, casas, coreto, igreja, telhado colonial, toldo) | `architectureRenderer.ts` | 1.081 | **B** | Idem; é o maior acervo visual. Candidato a *pré-render para atlas* (build-time) |
| Bernardo/clientes desenhados por código | `spriteRenderer.ts` | 810 | **D** | Substituídos pelos sprites reais; clientes a redesenhar como sprites |
| Câmera/viewport | `DeliveryGameView.tsx`, `renderer.ts` | ~100 | **D** | Phaser cuida |
| Controles virtuais (joystick + D-pad) | `VirtualControls.tsx` | 277 | **B** | Joystick não existe no `TouchControls` atual; **reaproveitar a UX** (modo joystick/D-pad) |
| Modal de seleção de missão | `MissionSelectModal.tsx` | 195 | **B** | Vira overlay React da Aventura (lista de pedido ativo) |
| Modal de sucesso | `DeliverySuccessModal.tsx` | 153 | **A** | Lógica de apresentação reaproveitável com dados do `finish` |
| Modal de melhorias | `StoreUpgradesModal.tsx` | 234 | **B** | Base visual do `ShopOverlay`; dados vêm do servidor |
| Melhorias (`camera`, `ventilador`) | `storeUpgrades.ts` | ~120 | **C → B** | Mantém no legado (localStorage); conceito vira itens do catálogo §11 |
| Persistência de missão/posição | `gameStorage.ts` | ~100 | **D** | `localStorage`; substituído por `game_progress` (servidor) |
| Cliente/destinos legado (`REALISTIC_DESTINATIONS`) | `storage.ts` | — | **D** (para a Aventura) | Endereços reais; substituídos por `CustomerDef` fictícios. **C** no jogo antigo |
| Geração de pedido no cliente (`createNewRandomOrder`) | `storage.ts` | ~120 | **C → D** | Mantida só para o legado; Aventura usa servidor |
| Jogo antigo inteiro (aba "Jogo 2D") | todos | ~4.940 | **C** | Mantido funcional até a Aventura cobrir o ciclo; decisão de aposentar **depois** da Fase 7, com aprovação |

**Observação:** **nada é apagado** nesta fase (V2: "Não deletar").

---

## 17. Estratégia gradual Canvas → Phaser

1. **Congelar** o jogo antigo (C): só correções críticas. Convive na aba "Jogo 2D".
2. **Aventura = server-first desde o início**; não herda `localStorage`.
3. **Extrair o reaproveitável (A)** para `shared/` com testes (colisão AABB).
4. **Converter o visual antigo (B)** por *pré-render*: script de dev que desenha as funções `draw*` em canvas offscreen e exporta **atlas PNG** (uma vez, build-time). Preserva a arte colonial sem reescrever 1.000+ linhas em Phaser e sem dependência de runtime do Canvas antigo.
5. **Paridade funcional mínima** (entrega simples ponta a ponta na Aventura, Fase 4) → só então avaliar aposentar o legado, com aprovação explícita (e backup do que ele usa).
6. Critério para remover a aba legada: Aventura cobre pedido→entrega→caixa→loja→melhorias, com testes E2E e validação em celular.

---

## 18. Plano de testes

### 18.1 Sistemas que **exigem testes antes** da implementação (test-first)
1. **Auth** (Fase 1): rota privada sem token → 401; token inválido/expirado → 401; `/api/health` público; login com senha errada → 401 e *rate limit*.
2. **`finish` idempotente** (D4): 1ª chamada aplica; 2ª–Nª devolvem 200 `alreadyApplied`; estoque baixa 1 vez; caixa credita 1 vez; `progress_events` 1 linha; sob **concorrência** (2 requisições simultâneas) → 1 aplicação.
3. **Rollback:** falha no meio do `finish` (estoque insuficiente; erro injetado antes do caixa) → nada persiste.
4. **Estoque/caixa:** nunca negativo; `CHECK`s respeitados; exclusão de planta com histórico funciona (G4).
5. **Backup WAL** (D9): script gera backup; `integrity_check` ok; contagens iguais ao banco vivo **incluindo dados só presentes no WAL** (teste: escrever, **não** fazer checkpoint, fazer backup, comparar).
6. **Motor de regras:** `onceOnly`; não regressão após excluir planta; idempotência de avaliação; dependências/ciclos; métricas atual×máx×acumulada; regras por evento (cliente/item).
7. **Compra:** saldo insuficiente; idempotência por `idempotency_key`; duas compras concorrentes; convivência `REAL`↔centavos (§9.1).
8. **Geração de pedido:** só plantas elegíveis com estoque; nunca `preset`; respeita reserva; limite de abertos; `rng` injetável; variedade.
9. **Região (schema):** validação; ids únicos; conectividade; slots referenciados existem.
10. **Determinismo do gerador** (Fase 9): golden tests.

### 18.2 Infraestrutura de testes
- **Backend:** Vitest + app Express importado e servido numa porta efêmera (`app.listen(0)`); `DATABASE_PATH` em **arquivo temporário** por teste (`os.tmpdir()`); `fetch` nativo. Sem `supertest` por ora. Cada teste cria banco novo (esquema via `getDb()`).
- **Unit puro:** `shared/` (regras, dinheiro, schema de região) em Node.
- **E2E:** Playwright (já existe) + novos fluxos: sem plantas → cadastrar → pedido → entrega → anúncio; reload preserva unlock; offline em modo leitura.
- **Mobile:** checklist manual em celular a cada fase de jogo (3, 4, 7, 8) — "PARAR PARA TESTE NO CELULAR".
- **CI:** workflow `npm test` + lint + build + E2E (backend de dev em container `node:22` próprio).
- **Regressão:** os 62 testes atuais continuam como barreira.

---

## 19. Fases de desenvolvimento refinadas

> Regra do V2 mantida: **uma fase por vez**, testes, relatório, **parar** e aguardar aprovação. Cada sub-etapa abaixo é um **marco verificável** dentro da fase (não uma fase nova).

### Fase 0 — Documento e inventário ✅ (este arquivo)

### Fase 1 — Segurança e testes do backend *(pré-requisito de tudo que mexe em dinheiro)*
- **1A Harness de testes do backend** (banco temporário, porta efêmera).
- **1B Backup SQLite com WAL**: `scripts/backup-sqlite.*` (API de backup / `VACUUM INTO`), restauração de teste, `integrity_check`, validação de contagens; **teste** que prova captura de dados só no WAL; documentação do procedimento.
- **1C `finish` idempotente (D4)** + testes (sequencial e concorrente) + rollback.
- **1D Exclusão de planta com histórico** (confirmar e corrigir G4) + teste.
- **1E Autenticação real (D1):** sessão/token validado; middleware em todas as rotas exceto `/api/health` (e uploads de imagens, se mantidos públicos *deliberadamente*); cookie `HttpOnly; Secure; SameSite=Strict` (ou token em header — decidir em P1); `AUTH_SECRET` obrigatório em produção; expiração; *rate limit* de login; hash de senha forte (scrypt) com migração segura; **remover a senha da tela de login**; restringir `POST /api/cash` (`credit`/`adjustment`) e `/api/migration`; front passa a usar `/api/auth/me` em vez do flag em `localStorage`.
- **Atenção:** 1E altera **login em produção** → exige variáveis de ambiente novas e janela de deploy planejada; o Bernardo precisa estar presente para validar o login.
- *Não inclui:* progressão, geração de pedidos, schema novo de jogo.
- **PARAR PARA REVISÃO.**

### Fase 2 — Fundação da progressão persistente
- **2A** `plants.source` (+ backfill revisado por você) e contagens elegíveis.
- **2B** `shared/progression/ruleEngine.ts` + `shared/economy/money.ts` (puros, 100% testados).
- **2C** `progress_events`, `unlocks`, `announcements_seen`; API mínima (`GET /api/progress`, `POST …/announcements/:id/seen`).
- **2D** Ganchos transacionais: `plant_registered`, `delivery_completed` (dentro do `finish`).
- Provar com 2–3 regras de teste (cadastro de plantas e entregas). **Sem criar regiões.**
- **PARAR.**

### Fase 3 — Primeiro bairro Phaser pequeno
- **3A Fundação (sem conteúdo novo):** renomear módulo; `AdventureBridge`; `InputState` + botão **Interagir** (teclado/touch); `RegionLoader` + schema + `region_00_inicio.json` mínimo; `InteractableRegistry`; testes.
- **3B Conteúdo:** Novo Hiper (exterior), rua inicial, praça, 2–3 casas fictícias (slots), 1 saída **bloqueada** (obras); Bernardo top-down (sprites reais, collider validado); colisão; câmera; controles mobile; entrada/saída da loja (se necessário).
- Reaproveitar `mapData.ts` (B) como ponto de partida do layout.
- **PARAR PARA TESTE NO CELULAR E REVISÃO.**

### Fase 4 — Primeira entrega real ponta a ponta
- **4A** Servidor gera pedidos (`POST /api/orders/generate`), clientes fictícios (`CustomerDef`), reserva lógica de estoque, limite de abertos; testes.
- **4B** Fluxo pickup → mapa → cliente → entregar → joinha → `finish` (via React) → snapshot.
- **4C** Teste de idempotência **pela UI** (duplo toque/reenvio) + E2E.
- Primeira entrega **sem** plataforma.
- **PARAR.**

### Fase 5 — Primeira expansão por gatilho
- Uma regra real, um gate, uma região 01 pequena, anúncio, persistência após reload/reinício, "excluir planta não re-bloqueia" (teste explícito). **PARAR.**

### Fase 6 — Loja de Utilidades e economia de itens
- `purchases`, `inventory_items`, `store_upgrades`; catálogo pequeno; `POST /api/shop/purchase` idempotente; débito em `cash_transactions('upgrade_purchase')` na **mesma** transação; `ShopOverlay` (React); porta/vendedor (Phaser); decisão P6 (import de melhorias legadas). **PARAR.**

### Fase 7 — Personalização da Novo Hiper
- `InteriorScene`; `placements`; modo organizar (React+Phaser); 1–2 itens posicionáveis + 1 melhoria estrutural; restauração em outro dispositivo. **PARAR.**

### Fase 8 — Primeira entrega com `PlatformScene`
- Parametrizar `PlatformScene` por `areaId` (layout em dados); 1 destino `platform`; `platformCompleted` → `finish`. Testes de alcance/física existentes seguem valendo. **PARAR.**

### Fase 9 — Pipeline geográfico de Olinda (prova de conceito)
- Parecer de licença; `docs/geo-sources.md`; importador → IR → simplificador → gerador determinístico → overrides → comparação com região manual; **golden tests**. **PARAR.**

### Fase 10 — Regiões inspiradas em Olinda (uma por vez, com curadoria) • **Fase 11** — Polimento (conforme V2).

### Mudanças em relação ao V2
- Fase 1 passa a incluir **autenticação, backup e restrição de rotas de dinheiro** (descobertas G1/G2/G10/G11).
- Fase 2 passa a incluir `plants.source` e o contrato de dinheiro/centavos.
- **Geração de pedidos no servidor** entra na **Fase 4A** (antes da entrega real), não antes — ainda não há UI que a consuma.
- Fase 3 divide-se em 3A (fundação/ponte) e 3B (conteúdo) para reduzir risco.

---

## 20. Escopo exato da V1 e itens da V2

### 20.1 V1 jogável (mínimo coerente)
- Auth real, backup testado, backend testado.
- Progressão persistente (motor + 2–3 regras reais).
- Região 0 (Novo Hiper + rua inicial + praça + 2–3 casas + saída bloqueada) e **1 expansão** (região 01).
- Pedidos gerados no servidor com plantas reais; entrega simples ponta a ponta com joinha e caixa/estoque corretos e idempotentes.
- Loja de Utilidades com **catálogo mínimo** (2 estruturais + 1–2 posicionáveis), compra com caixa real, inventário, colocação em slots, restauração multi-dispositivo.
- **Uma** entrega com plataforma.
- Anúncios de desbloqueio persistentes.
- Modo leitura offline para regiões já visitadas.

### 20.2 Explicitamente V2 (ou depois)
Sementes/cultivo; colecionáveis; multiplayer; economia complexa; geração integral de Olinda; editor livre; dezenas de lojas; combate; vidas/Game Over; cronômetros/ranking; venda/descarte de itens; empilhamento de inventário; fachada/placa externa/expositor/armário; múltiplas regiões geradas; diálogos ramificados; NPCs ambientais complexos; música.

---

## 21. Diagrama textual do fluxo completo

```text
[React: login] ──cookie/token──► [API autenticada]
      │
      ▼
[AdventureApp] ──GET /api/adventure/state──► WorldSnapshot
      │                                          ▲
      ├─ cria AdventureBridge ─► Phaser.Game ────┤ applySnapshot / commands
      │                                          │
      │       WorldScene (região 0) ◄── RegionLoader (JSON)  ◄── cache PWA
      │            │  PlayerController / CollisionMap / Gates / Compass
      │            └─ interact(kind,id) ───────────────────────────► React
      │
 ┌────┴───────────────────────────────────────────────────────────────────┐
 │ interact(pickup)   → POST /adventure/pickup  → pedido 'pronto'         │
 │ interact(customer) → POST /deliveries/:id/finish  (idempotente)        │
 │      transação: estoque−1 · caixa+1 · progress_event · regras          │
 │      resposta {cash, newUnlocks, unseenAnnouncements}                  │
 │      └─► playAnimation(thumbsUp) + applySnapshot                       │
 │ interact(shop)     → ShopOverlay → POST /shop/purchase (idempotência)  │
 │ interact(door:loja)→ InteriorScene → modo organizar → POST /placements │
 │ interact(door:especial) → PlatformScene → platformCompleted → finish   │
 │ unseenAnnouncements → UnlockAnnouncement → POST …/seen                 │
 └────────────────────────────────────────────────────────────────────────┘
SERVIDOR: plants · orders · deliveries · cash_transactions · progress_events
          unlocks · announcements_seen · purchases · inventory · placements
CONTEÚDO (git): regions/*.json · rules/*.json · shop/catalog.json · customers
```

---

## 22. Riscos técnicos conhecidos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|:-:|:-:|---|
| R1 | Introduzir auth quebra o login em produção | M | Alto | Fase 1E com janela combinada, `AUTH_SECRET` em `.env`, *rollback* documentado, testar em ambiente espelho |
| R2 | `REAL` × centavos gera inconsistência | M | Alto | §9.1 (fronteira única, testes de convivência, saldo calculado em centavos) |
| R3 | Idempotência incompleta sob concorrência | B | Alto | **1A mediu:** dois `finish` simultâneos hoje resultam em 1×200 + 1×400 (conexão única e SQLite síncrono serializam). Ainda assim manter `UNIQUE` como rede de segurança e teste concorrente na 1C; risco sobe se o código passar a usar mais de uma conexão |
| R4 | Backup incorreto de WAL (já ocorreu) | A→B | Alto | Procedimento testado (D9) antes de qualquer deploy com migração |
| R5 | Precache PWA estoura com regiões | M | Médio | §14, orçamento automatizado |
| R6 | Chunk do Phaser (~1,5 MB) pesa em celular antigo | M | Médio | Lazy já existe; medir; considerar `phaser` custom build/tree-shake mais tarde |
| R7 | `PlatformScene` hoje é uma fase fixa | A | Médio | Parametrizar por `areaId` (Fase 8) |
| R8 | Phaser 3.90 vaza listeners globais | B (mitigado) | Baixo | `phaserGlobals.ts` já cobre; teste E2E existe |
| R9 | Licença ODbL exigir liberar dataset derivado | M | Médio | Dataset OSM separado + parecer jurídico antes da Fase 9 |
| R10 | Reidentificação de residências reais | B | Alto | D7, casas genéricas, checklist de curadoria |
| R11 | Complexidade da ponte (estados fora de sincronia) | M | Médio | Snapshot único de leitura, comandos idempotentes, testes de contrato da ponte |
| R12 | Conflito de edição dos 2 jogos (legado × Aventura) no mesmo caixa/estoque | M | Médio | Servidor único autoridade; ambos usam as mesmas rotas; testes cobrem os dois caminhos |
| R13 | Arte (clientes, edifícios, tiles) é gargalo | A | Médio | Pré-render dos desenhos antigos (§17.4); começar com poucos modelos |
| R14 | Estado stale em PWA instalado após deploy | M | Baixo | `autoUpdate` + versão de API/snapshot e *refresh* prompt |
| R15 | Crescimento do escopo ("só mais um sistema") | A | Médio | Regra de uma fase por vez; V2 explícito (§20.2) |

---

## 23. Decisões que dependiam do Bernardo (HISTÓRICO — todas resolvidas na §0.1)

| ID | Pergunta | Recomendação |
|---|---|---|
| **P1** | Sessão por **cookie HttpOnly** (recomendado; funciona com imagens e PWA) ou token em header `Authorization`? Duração da sessão (ex.: 30 dias)? | Cookie `HttpOnly+Secure+SameSite=Strict`, 30 dias, renovação deslizante |
| **P2** | Plantas `source='migration'` contam como "cadastradas"? (vieram do `localStorage` do próprio Bernardo) | **Sim**, se não forem exemplo; `preset` nunca conta |
| **P3** | Marcos de "tamanho do catálogo" usam `plants_max` (anti-farm) ou `plants_registered_total`? | `plants_max` |
| **P4** | O gerador automático de pedidos por timer: some na Aventura (pedido sob demanda/após entrega) ou continua? | Sem timer; gerar após `finish` e por ação do jogador |
| **P5** | Preços dos itens: **fixos e baixos** ou relativos ao ganho médio por entrega? | Fixos e baixos na V1 |
| **P6** | Importar as melhorias do jogo antigo (`camera`, `ventilador`) como "já compradas" ou recomeçar na Aventura? | Recomeçar (mais simples); reavaliar |
| **P7** | Limite de pedidos abertos na Aventura: 1 ou 2? | 1 na V1 |
| **P8** | Nome final da Loja de Utilidades e do módulo (`src/adventure`)? | Decidir na Fase 3A |
| **P9** | O jogo antigo continua visível na aba "Jogo 2D" durante toda a V1? | Sim, congelado, revisar após Fase 7 |
| **P10** | Quem faz o parecer sobre ODbL (consulta jurídica simples ou decisão sua)? | Decidir antes da Fase 9 |
| **P11** | Fase 1E: janela para trocar o login em produção (precisa de você presente) e **nova senha** (a atual é pública) | Definir na abertura da Fase 1 |
| **P12** | Cadastro/exclusão de plantas pela Aventura ou continua só no catálogo React? | Continua só no catálogo (V2 §5) |

---

## 24. Sequência de implementação — marcos verificáveis (resumo)

```text
F1  1A harness → 1B backup WAL → 1C finish idempotente → 1D delete planta → 1E auth/rotas $$
F2  2A plants.source → 2B ruleEngine+money (puros) → 2C tabelas/API → 2D ganchos transacionais
F3  3A bridge+interagir+RegionLoader → 3B bairro pequeno + Bernardo top-down (celular)
F4  4A pedidos no servidor+clientes fictícios → 4B fluxo de entrega → 4C idempotência pela UI
F5  regra+gate+região 01+anúncio+persistência
F6  compras+inventário+Loja (React/Phaser)
F7  InteriorScene+placements+melhoria estrutural
F8  PlatformScene parametrizada em 1 destino
F9  PoC geo (licenças, IR, gerador determinístico, overrides)      F10 regiões Olinda   F11 polimento
```

*Fim do documento da Fase 0.*
