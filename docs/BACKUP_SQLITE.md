# Backup do SQLite do Novo Hiper (WAL-safe)

> **Status:** implementado e testado em bancos descartáveis (Fase 1B). **Ainda não foi executado contra produção.**
> A primeira execução em produção só deve ocorrer com autorização explícita.

## Por que existe
O banco usa **WAL** (`journal_mode=WAL`). Dados confirmados podem ficar **somente** no arquivo `novo-hiper.db-wal`
até o próximo *checkpoint*. Copiar ou abrir só o `.db` (`cp`, ou uma conexão `mode=ro` sem acesso ao `-wal`)
produz um backup **desatualizado ou vazio** — foi exatamente o erro do backup de 06/10/2026
(`INVALID-empty-…db`, 0 linhas em todas as tabelas, enquanto a produção tinha dados).

## Mecanismo
`VACUUM INTO '<arquivo>'` (SQLite), via `node:sqlite`, em `scripts/sqlite-backup.mjs`:
- lê um **instantâneo consistente** (inclui o que está só no WAL) sem bloquear quem escreve;
- gera um arquivo **novo e independente** (convertido para `journal_mode=DELETE`; sem `-wal`/`-shm`);
- não é uma cópia de arquivo (um teste estático garante que o script não usa `copyFile`/`cp`).

Escolhido em vez da API `backup()` do Node porque funciona em **qualquer Node ≥ 22.5** (a API só existe a partir
do 22.16) e é uma única instrução SQL testada por décadas. Limitação: o arquivo sai compactado (páginas livres
descartadas) — é um estado lógico idêntico, não uma imagem byte a byte.

## Como executar
Requer Node ≥ 22.5. No host (Node 20) use `npx -y node@22`:

```bash
# origem = banco vivo; destino = pasta FORA da pasta de dados do banco
npx -y node@22 scripts/sqlite-backup.mjs backup \
  --db /root/novo-hiper/data/novo-hiper.db \
  --out-dir /root/novo-hiper-backups \
  --label pre-deploy
```
Saída (JSON): caminho do backup, manifesto, contagens por tabela, SHA-256 e avisos. O comando **já verifica**
o backup ao final e sai com código ≠ 0 se algo estiver errado.

Códigos de saída: `0` ok · `1` falhou/inválido · `2` uso incorreto · `3` a origem mudou durante o backup (repita).

Arquivos gerados (permissão `0600`, pasta `0700`):
- `novo-hiper-<AAAAMMDD>T<HHMMSS>Z[-label].db` — o backup;
- `…db.manifest.json` — origem, versão do SQLite/Node, tamanho, **SHA-256**, `integrity_check`, **contagens por tabela**.

Cuidados:
- `--out-dir` **não pode** ser a pasta do banco de origem (recusado). Nunca grave backups dentro de `data/`.
- Nunca sobrescreve: nome repetido → erro.
- Se a origem recebe escritas durante a cópia (contagens antes ≠ depois), o script **repete até 3 vezes** e, se
  persistir, **falha** (código 3) em vez de gravar um backup suspeito.
- Rodar no host contra o arquivo do bind mount do container funciona (mesmo kernel/sistema de arquivos). **Não**
  use em volumes de rede/VM diferentes do processo que escreve (a memória compartilhada do WAL não funciona entre máquinas).

## Como verificar
```bash
npx -y node@22 scripts/sqlite-backup.mjs verify /root/novo-hiper-backups/novo-hiper-….db
# opcional: comparar com a origem viva
npx -y node@22 scripts/sqlite-backup.mjs verify <backup.db> --source /root/novo-hiper/data/novo-hiper.db
```
Verifica: cabeçalho SQLite e **modo não-WAL**, SHA-256 e tamanho contra o manifesto, `PRAGMA integrity_check`,
contagens contra o manifesto (e contra a origem, se `--source`), schema presente.
Contagens do Novo Hiper: `plants, customers, orders, order_items, deliveries, cash_transactions, game_progress`
(tabela ausente em schema antigo = **aviso**, não erro).

## Como identificar um backup INVÁLIDO
| Sintoma | Significado |
|---|---|
| `O arquivo está em modo WAL … cópia ingênua` | foi copiado só o `.db` com WAL ativo |
| Todas as tabelas com 0 linhas e a origem tinha dados | dados ignorados do WAL (como o backup `INVALID-empty-…`) |
| `SHA-256 diverge do manifesto` / tamanho diferente | arquivo alterado, truncado ou corrompido |
| `integrity_check falhou` | corrupção |
| `Não foi possível abrir o backup isoladamente` | depende de arquivos que não acompanham |
| `Manifesto ausente` | não há como provar o conteúdo esperado |
| `Contagens divergem da origem atual` (com `--source`) | backup não reflete a origem (esperado se houve escritas depois) |

## Como restaurar (procedimento — NÃO executar sem autorização)
1. **Verifique** o backup: `verify <backup.db>` deve sair com 0.
2. **Pare a aplicação** (somente o container do app): `docker stop novo-hiper-app`.
3. **Guarde o estado atual**, sem apagar nada: `mkdir /root/novo-hiper-backups/antes-restore-$(date +%s)` e **mova**
   `novo-hiper.db`, `novo-hiper.db-wal` e `novo-hiper.db-shm` para lá (os **três**: um `-wal` antigo ao lado de um
   `.db` restaurado corromperia o resultado).
4. **Copie** o backup verificado para `data/novo-hiper.db` (somente o `.db`; sem `-wal`/`-shm`).
5. `docker start novo-hiper-app` e confira `/api/health`, o login e as contagens de negócio.
6. Se algo falhar, o estado anterior está intacto na pasta `antes-restore-*`.

Ensaiar o restore apenas em cópias descartáveis (o teste `CLI — fluxo de backup → verificação → restauração` faz isso).

## Testes
`npm run test:backend -- tests/backend/backup.test.ts` — 23 testes, incluindo:
- banco em WAL com linhas confirmadas **só no `-wal`**: o `.db` isolado tem 1 linha; o backup tem as 3;
- backup aberto **sozinho** (sem `-wal`/`-shm`) em outra pasta;
- **controle negativo**: cópia ingênua é reprovada pelo verificador;
- guarda estática: o script não pode usar cópia de arquivo;
- schema real do Novo Hiper com o app rodando e contagens iguais ao banco vivo;
- origem mudando durante o backup, arquivos adulterados/truncados/vazios, manifesto ausente, tabelas ausentes.

## Fora do escopo desta fase
Agendamento/cron, retenção/rotação, criptografia, envio para fora do servidor. Decidir depois.
