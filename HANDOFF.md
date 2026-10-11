# Handoff — Novo Hiper

Projeto pessoal e pequeno: um painel de loja de plantas (React + Express + SQLite) com um jogo embutido,
"Aventura", feito para o filho de 8 anos do dono (Bernardo) brincar de entregar plantas pelo bairro.
Este arquivo é o ponto de partida para qualquer sessão nova (humana ou IA) que for mexer no projeto.

## Onde as coisas estão

- **Repositório**: `git@github.com-novo-hiper:caiomvital/novo-hiper-2.git`, branch `main`.
- **Produção**: clone em `/root/novo-hiper` na VPS, rodando via `docker compose` (container `novo-hiper-app`,
  porta `127.0.0.1:8504` atrás de um Nginx). Guia completo de deploy/backup: `DEPLOY.md`.
- **Dev manual**: clone separado em `/root/novo-hiper-dev` (mesma VPS). Backend isolado num container Docker
  (`novo-hiper-dev-api`, porta `4317`) + Vite solto (`127.0.0.1:5173`), subidos por `./dev-start.sh`. Testado
  de fora via túnel SSH (`ssh -N -L 5173:127.0.0.1:5173 root@<ip-da-vps>`). Para a escala deste projeto, esse
  ambiente de dev é mais do que o necessário — produção também serviria para testar a maioria das mudanças.
- **Credencial de dev**: usuário `Bernardo`, senha definida em `AUTH_DEV_INSECURE_PASSWORD` dentro de
  `dev-start.sh` (arquivo não versionado com esse valor — ver localmente). Nunca funciona em produção
  (`loadAuthConfig` recusa essa variável fora de dev).
- **Observação de infra**: o container `novo-hiper-dev-api` sempre aparece como `unhealthy` no `docker ps` —
  é só o healthcheck do container batendo na porta errada (`3000` em vez de `4317`); a API em si responde
  normalmente. Não é um bug para investigar de novo.

## Estado atual (commit `2a51691`, já em produção)

- **Painel da loja** (React): catálogo de plantas, pedidos, caixa, upload de foto — preexistente, estável.
- **Aventura** (Phaser, dentro do painel): mapa do bairro top-down, trecho de plataforma (estilo SNES, com
  zoom de câmera), e o **interior explorável da Novo Hiper** (balcão → pedidos, prateleira/estoque →
  catálogo, bancada → retirar a planta do pedido antes de entregar).
- **Progressão**: o backend é a autoridade de tudo (pedidos automáticos, marcos permanentes). Documentado em
  `docs/PROGRESSION.md` — leitura obrigatória antes de mexer em pedidos, clientela ou marcos.
  - **Progressão 2A** (pronta): pedidos nascem sozinhos no backend, roster de 8 moradores em 3 grupos que
    vão sendo liberados.
  - **Progressão 2B — "o bairro reage"** (começada, não fechada): `GET /api/progress` devolve `worldStage`
    (`obraLeste`: `parada` → `ativa` → `quase_pronta`; `environmentalNeighbors`: 0–3), derivado dos marcos
    já gravados, sem migration. O frontend só renderiza o que o backend manda.
- **Jogo antigo (`Jogo 2D 🎮`)**: desativado da interface (sem botão), mas o código continua em `src/game/`
  e `DeliveryGameView` — reversível, não foi apagado.

### Dentro do 2B: o que ficou pendente

- **Item C do débito original** (reposicionar o balão de fala do cliente): não resolvido — o texto original
  do bug se perdeu, e a única hipótese investigada (ancorar o balão na posição real do sprite) seria um
  no-op, não uma correção de verdade. Precisa de uma descrição concreta do problema antes de mexer.
- **Fora de escopo do 2B, por decisão explícita** (não é esquecimento): abrir a barreira "EM OBRAS" / criar
  uma região nova, mais de um pedido ativo + balcão físico na loja, sincronização entre abas, remover
  `POST /api/orders` (mantido só por compatibilidade), passe de arte.

### Pendências visuais conhecidas (`docs/VISUAL_BACKLOG.md`)

- Postura do sprite top-down do Bernardo (cabeça projetada/corcunda) — vem da arte original, não mexer sem
  arte nova.
- Cenário do `WorldScene` ainda em formas geométricas simples (placeholder) — candidato ao próximo passe de
  arte.

## Próximo passo em andamento

O dono vai gerar um tileset/spriteset com IA (ChatGPT ou Gemini) para substituir os placeholders visuais e
trazer as imagens para avaliação antes de integrar.

## Como validar uma mudança

```bash
npm run lint          # tsc --noEmit
npm run build          # build de produção (vite)
npx vitest run         # testes unitários
npm run test:backend   # testes de backend (precisa Node ≥22.5 por causa de node:sqlite)
npx playwright test    # E2E completo (~15-20 min; backends isolados e descartáveis, nunca tocam em data-dev)
```

Dado o tamanho do projeto, nem toda mudança pequena precisa rodar a suíte inteira — use julgamento.

## Como fazer deploy

1. Backup a quente do SQLite + uploads (ver `DEPLOY.md`, seção 14) — o banco usa WAL, não precisa parar o
   container.
2. `git pull origin main` em `/root/novo-hiper`.
3. `docker compose build --no-cache && docker compose up -d`.
4. Conferir `curl http://localhost:8504/api/health`.

**Nunca** fazer deploy ou tocar em produção sem o dono pedir explicitamente.

## Convenções deste projeto

- Documentação e mensagens de commit em português; nomes de variáveis/funções em inglês.
- Commits só quando pedido explicitamente — não commitar proativamente.
- O backend é sempre a autoridade (preço, estoque, marcos, estágio do mundo); o Phaser só emite intenções e
  renderiza o que o React/backend mandam — nunca decide regra de negócio sozinho.
- Mudanças que exigiriam migration ou decisão arquitetural grande: investigar e apresentar o plano antes de
  implementar. O resto, implementar direto e validar.
