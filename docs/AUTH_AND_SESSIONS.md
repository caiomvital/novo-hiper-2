# Autenticação e sessões (Fase 1E)

> **Status:** implementado e testado em ambiente de desenvolvimento. **Nada disto foi implantado em produção.**
> A implantação (junto com 1C + 1D) é uma etapa separada, com backup prévio (docs/BACKUP_SQLITE.md) e com o Bernardo presente.

## Modelo
- **Cookie de sessão** `nh_session`: `HttpOnly; SameSite=Strict; Path=/; Max-Age=30 dias`; **`Secure` em produção** (`NODE_ENV=production`).
- **A autoridade é o servidor.** O token (256 bits aleatórios) vive só no cookie; o banco guarda apenas o **SHA-256** dele
  (tabela `sessions`, migration 003) — vazamento de banco/backup não entrega sessões utilizáveis.
- **Persistente:** sobrevive a reinício do container (SQLite). Expiração **deslizante**: cada uso após ≥ 1 h renova para +30 dias
  (sem escrever a cada requisição). Sessões expiradas são removidas ao serem usadas e a cada login/inicialização (sem cron).
- **Logout** (`POST /api/auth/logout`): apaga a sessão no servidor e limpa o cookie. Um cookie copiado antes do logout deixa de funcionar.
- **Nada no navegador:** o antigo flag `novo_hiper_session_auth` do `localStorage` foi aposentado (removido no primeiro carregamento);
  o frontend pergunta ao servidor (`GET /api/auth/session`). Reload/PWA mantêm a sessão enquanto o cookie for válido.
- **Single-user:** sem cadastro, recuperação de senha, OAuth ou papéis.

## Credenciais
| Ambiente | Regra |
|---|---|
| **Produção** | `AUTH_USERNAME` e `AUTH_PASSWORD_HASH` **obrigatórios**; ausentes/inválidos → o servidor **não sobe** (fail-fast, antes de abrir o banco). **Não existe senha padrão.** O hash SHA-256 antigo é recusado. `AUTH_DEV_INSECURE_PASSWORD` em produção também derruba a inicialização. |
| Dev/teste | `AUTH_DEV_INSECURE_PASSWORD` (nome explícito, só fora de produção) **ou** `AUTH_PASSWORD_HASH`. Sem nenhuma, o login responde 503 `AUTH_NOT_CONFIGURED`. |

- Hash: **scrypt** (N=16384, r=8, p=1, sal aleatório), formato `scrypt:N:r:p:salt:hash` (sem `$`: seguro para `.env`/docker compose).
- Gerar: `node scripts/hash-password.mjs` — pede a senha sem eco (ou `--stdin`); imprime **só o hash**. Mínimo de 10 caracteres.
  A senha nunca é gravada, passada como argumento, nem logada.
- A senha antiga foi removida da tela de login e do bundle; nenhum teste/E2E usa a senha de produção (usam uma credencial de dev explícita).
- Login: tempo de verificação constante (sempre calcula o scrypt, mesmo com usuário errado), mesma mensagem para usuário/senha errados,
  **limite de tentativas** (5 falhas/15 min por IP → 429 + `Retry-After`; zera no sucesso; em memória).

## Endpoints `/api` — públicos × privados
**Públicos (allowlist exata, `backend/auth/middleware.ts`):**
| Método | Rota | Por quê |
|---|---|---|
| GET | `/api/health` | monitoramento/healthcheck do Docker |
| POST | `/api/auth/login` | precisa funcionar sem sessão |
| POST | `/api/auth/logout` | idempotente, sem dados; apaga a sessão se houver |

**Privados (todo o resto de `/api`, inclusive caminhos inexistentes → 401):** `GET /api/auth/session`; `plants` (GET /, /stock, /:id, /:id/stock; POST /; PUT/DELETE /:id);
`customers`; `orders`; `deliveries` (incl. `/start`, `/:id/state`, `/:id/finish`); `cash` (GET /, /summary; POST `/transactions` [desativada]);
`game` (`/current`, `/progress`); `upload`; `migration` (`/status`, POST `/`).
Fora de `/api`: **`/uploads/*` (fotos de plantas) continua público de propósito** (nomes aleatórios; carregadas por `<img>`/PWA).
Um teste **enumera todas as rotas registradas no Express** e prova 401 anônimo / não-401 com sessão para cada uma — rota nova sem classificação é pega automaticamente.

## CSRF — decisão
SameSite=Strict (cookie não vai em requisições cross-site) **mais** `csrfGuard` em métodos mutáveis (POST/PUT/PATCH/DELETE):
1. `Origin` presente → o host precisa ser o do próprio site (`Host`/`X-Forwarded-Host`, que o Nginx repassa) ou estar em `CORS_ORIGIN`; senão **403 CSRF_BLOCKED**. `Origin: null` → 403.
2. Sem `Origin`: `Sec-Fetch-Site: cross-site|same-site` → 403.
3. Sem nenhum dos dois (curl/servidor): permitido — não é vetor CSRF (navegador sempre envia `Origin` em mutação cross-origin) e a sessão continua obrigatória.
- Cobre também *login CSRF* e *logout CSRF*. GET/HEAD/OPTIONS não mudam estado (nenhum GET altera dados — auditado).
- **CORS** passou a **não refletir origens arbitrárias** (antes, em dev, aceitava qualquer origem com `credentials: true`) e a **não dar erro 500** para origem desconhecida: simplesmente não envia cabeçalhos CORS. Mesma origem do PWA é sempre aceita.
- Sem tokens CSRF/dupla submissão: proporcional ao risco (um usuário, mesma origem, SameSite=Strict + Origin + Sec-Fetch-Site).
- Limitação: o frontend em **outro domínio** (VITE_API_URL absoluto) não é suportado com cookie SameSite=Strict.

## `POST /api/cash/transactions` — desativada
Auditoria dos consumidores: o **único** uso do frontend era o crédito de **entrega avulsa** (sem pedido) em `App.tsx` (removido); os upgrades da loja
(câmera/ventilador) mexem só no `localStorage`; créditos de pedido nascem do `finish`. A rota permitia a qualquer cliente criar crédito/ajuste
arbitrário (inclusive com `order_id` forjado), então: **todos os tipos → 403 `CASH_TRANSACTIONS_DISABLED`**, sem gravar nada.
- **Entrega avulsa (sem pedido) — removida por decisão de negócio:** o crédito de venda nasce **somente** do fluxo de pedido/entrega
  (`POST /deliveries/:id/finish`). **Não existe** endpoint de venda avulsa (um `direct-sale` chegou a ser implementado e foi descartado).
  No frontend legado: o botão "Confirmar e Realizar Entrega" do mapa fica desabilitado sem pedido ativo ("Escolha um pedido para entregar"),
  `handleConfirmDelivery` e `handleDeliveryComplete` recusam entrega sem `orderId` (nenhum crédito, nenhuma baixa de estoque). O restante do mapa
  (destinos, escolha de planta, entrega de PEDIDOS) permanece igual.
- **Débito/compras** (loja da Fase 6) terão endpoint próprio, atômico e idempotente. Operações manuais legítimas hoje: **nenhuma**.

## `/api/migration` — restringida
É a importação do `localStorage` (plantas, pedidos e **histórico de vendas que vira crédito no caixa**) — vetor de dinheiro arbitrário, e a migração legada já foi concluída.
- Exige sessão (`/status` também).
- **Produção: desativada por padrão** (`403 LEGACY_MIGRATION_DISABLED`); só liga com `ENABLE_LEGACY_MIGRATION=true`. Dev/teste: habilitada.
- Mesmo habilitada: **só importa em banco sem operações** (orders/deliveries/cash vazios) — nunca mescla dinheiro em banco que já opera (`409 MIGRATION_NOT_ALLOWED`).
- `GET /status` informa `legacyMigrationEnabled`; o frontend, ao ver `false`, marca a migração como concluída e **não** exibe erro.

## Frontend
Login pela sessão real; tela de carregamento enquanto pergunta ao servidor; qualquer **401** (evento global) volta ao login **sem apagar** dados do negócio no `localStorage`;
sincronização com a API só depois de autenticado; senha removida da tela; logout invalida no servidor. Sem rede ao abrir: cai no login (sem sessão verificável não há acesso — decisão de segurança).

## Variáveis de ambiente de produção
| Variável | Obrigatória | Valor |
|---|:-:|---|
| `AUTH_USERNAME` | **sim** | `Bernardo` |
| `AUTH_PASSWORD_HASH` | **sim** | saída de `node scripts/hash-password.mjs` (gerada pelo Bernardo; **não** vai para o repositório) |
| `CORS_ORIGIN` | recomendado | `https://novohiper.fluxos.dev.br` |
| `SESSION_TTL_DAYS` | não | padrão 30 |
| `ENABLE_LEGACY_MIGRATION` | não | deixar `false`/ausente |
| `AUTH_DEV_INSECURE_PASSWORD` | **NUNCA** | proibida em produção (derruba a inicialização) |
| `AUTH_SALT` | removida | não é mais usada |

## Checklist PROPOSTO de implantação (1C + 1D + 1E) — NÃO executado
**Antes (com o Bernardo presente)**
1. Janela combinada; ninguém usando a loja.
2. No `.env` de produção (somente o Bernardo edita): confirmar `AUTH_USERNAME`; **remover** qualquer `AUTH_PASSWORD_HASH` antigo (SHA-256) e `AUTH_SALT`; conferir `CORS_ORIGIN`; **não** definir `AUTH_DEV_INSECURE_PASSWORD`.
3. O Bernardo gera o hash localmente (`node scripts/hash-password.mjs`) e grava `AUTH_PASSWORD_HASH` no `.env` — a senha não passa pelo chat nem pelo repositório.
4. Backup válido **com o script da 1B** (`backup` + `verify --source`), anotando contagens (hoje: 1 planta, 12 clientes, 1 lançamento de caixa).
5. Confirmar `main` limpa no servidor e `git pull --ff-only`; rodar a suíte localmente (backend/unit/lint/build/E2E) — já verde.
**Implantar**
6. `docker compose build novo-hiper` e `docker compose up -d --no-deps novo-hiper` (só este serviço; sem `down`, sem `prune`; mounts e `127.0.0.1:8504` preservados).
7. Acompanhar o log de inicialização: migrations **002** (plants.deleted_at) e **003** (sessions) aplicadas; sem erro de autenticação (fail-fast se o hash faltar/for inválido).
**Verificar**
8. `/api/health` 200; `GET /api/plants` anônimo → **401**; `GET /uploads/...` público 200.
9. O Bernardo faz login com a nova senha; `curl -i` mostra `Set-Cookie: nh_session=…; HttpOnly; Secure; SameSite=Strict`; reload mantém a sessão; logout volta ao login; cookie antigo → 401.
10. `verify`/contagens: plantas, clientes, pedidos e caixa iguais ao backup; `schema_migrations` = 1,2,3; Aventura abre; entrega de pedido e finish repetido (200 `alreadyApplied`).
11. PWA: recarregar 1–2 vezes (service worker) para trocar o frontend antigo.
**Rollback**
12. Imagem anterior (tag) + `.env` anterior; se necessário, restaurar o backup (procedimento da 1B). Atenção: o código antigo ignora as tabelas/colunas novas, mas **tem a API aberta** — só como medida temporária.
