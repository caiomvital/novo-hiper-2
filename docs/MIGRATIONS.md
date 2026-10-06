# Migrations de schema (SQLite)

> Introduzidas na Fase 1D. **Ainda não executadas em produção.** O deploy que contém este código aplicará as
> migrations pendentes automaticamente na primeira inicialização do backend — **faça o backup (docs/BACKUP_SQLITE.md)
> antes** e só com autorização explícita.

## Situação anterior
O schema era criado só por `CREATE TABLE IF NOT EXISTS` no startup (`initSchema`). Isso **não altera tabelas já
existentes**; qualquer coluna nova exigiria `ALTER TABLE` improvisado. Não havia versão de schema.

## Mecanismo (a menor solução robusta)
Código em `backend/migrations/`:
- `001_baseline.ts` — o schema anterior, verbatim (`IF NOT EXISTS`): no-op em banco existente (só registra a versão), cria tudo em banco novo.
- `002_plants_deleted_at.ts` — `ALTER TABLE plants ADD COLUMN deleted_at INTEGER` + índice.
- `003_sessions.ts` — tabela `sessions` (id = SHA-256 do token, created_at, last_seen_at, expires_at) + índice (Fase 1E).
- `index.ts` — lista oficial **em ordem**; `runner.ts` — `runMigrations(db)`, chamado por `getDb()` uma vez ao abrir o banco.
- Tabela de controle **`schema_migrations(version PK, name, checksum, applied_at)`**.

Garantias:
| Propriedade | Como |
|---|---|
| Uma única vez | versão registrada; relida **dentro** da transação `BEGIN IMMEDIATE` (2ª instância não reaplica) |
| Atômica | SQL + registro na mesma transação; falha → `ROLLBACK`, nada persiste, app **não sobe** com erro explícito |
| Detectável/versionada | `SELECT * FROM schema_migrations` |
| Sem apagar dados | migrations só adicionam; teste compara linha a linha antes/depois |
| Banco existente × novo | ambos cobertos por teste (`tests/backend/migrations.test.ts`) |
| Edição de migration aplicada | **recusada** (checksum SHA-256 do SQL normalizado) — `CHECKSUM_MISMATCH` |
| Código mais velho que o banco | **recusado** (`SCHEMA_TOO_NEW`) |
| Lacuna no histórico / lista inválida | `GAP` / `INVALID_LIST` |

## Como adicionar uma migration
1. Criar `backend/migrations/00N_nome.ts` exportando `{ version: N, name, sql }` (N = última + 1).
2. Acrescentar **no final** de `MIGRATIONS` em `index.ts`.
3. Nunca editar uma migration já aplicada em qualquer banco. Corrigir = nova migration.
4. Escrever teste (banco novo, existente com dados, reexecução).
5. Antes de qualquer deploy com migration: **backup válido** + `verify`.

## Consultar a versão
`sqlite3`/Node: `SELECT version, name, datetime(applied_at/1000,'unixepoch') FROM schema_migrations;`

## Limitações conhecidas
- Sem *down/rollback* de migration: o caminho de volta é restaurar o backup (procedimento em BACKUP_SQLITE.md).
- O SQLite não permite `DROP COLUMN` seguro em todas as versões; migrations destrutivas exigem recriar tabela (não há nenhuma).
- Duas instâncias abrindo o mesmo arquivo ao mesmo tempo: a segunda pode receber `SQLITE_BUSY` (não há `busy_timeout` configurado). Hoje só há um processo escritor.
