# Guia Passo a Passo de Deploy na VPS — Novo Hiper

Este manual orienta a instalação e operação do **Novo Hiper** em uma VPS Linux utilizando Docker Compose, Node.js e SQLite com persistência em disco.

O projeto foi preparado para operar de forma isolada, sem alterar outros serviços existentes na VPS (como n8n, PostgreSQL, Redis, Evolution API ou instâncias Nginx preexistentes).

---

## Sumário da Arquitetura em Produção

```text
Internet (Navegador PWA do Usuário)
       ↓ HTTPS (Porta 443)
Nginx da VPS (Reverse Proxy)
       ↓ HTTP (Porta local :3000 ou :APP_PORT)
Container Docker Novo Hiper (Node.js + Express)
     ↙                     ↘
Volume Persistente       Volume Persistente
  ./data/novo-hiper.db     ./uploads/plants/
```

---

## 1. Clonar o Repositório

Conecte-se à sua VPS via SSH e clone o repositório oficial no diretório de sua preferência (ex: `/opt/novo-hiper` ou no seu home):

```bash
git clone https://github.com/caiomvital/novo-hiper.git /opt/novo-hiper
```

---

## 2. Entrar no Diretório

Acesse a pasta criada:

```bash
cd /opt/novo-hiper
```

---

## 3. Criar o `.env` a partir de `.env.example`

Copie o modelo de variáveis de ambiente:

```bash
cp .env.example .env
```

> **Aviso de Segurança**: O arquivo `.env` nunca deve ser versionado no Git. Ele já está listado no `.gitignore`.

---

## 4. Configurar as Variáveis

Abra o arquivo `.env` com seu editor (ex: `nano .env` ou `vim .env`):

```bash
nano .env
```

Exemplo de configuração para produção:

```env
# Modo de produção
NODE_ENV=production

# Porta interna do container
PORT=3000

# Porta externa exposta no host da VPS
# Altere se a porta 3000 já estiver em uso na VPS por outro serviço (ex: APP_PORT=3001)
APP_PORT=3000

# Diretórios de persistência do container
DATA_DIR=/app/data
DATABASE_PATH=/app/data/novo-hiper.db
UPLOADS_DIR=/app/uploads

# Domínio oficial do seu aplicativo para cabeçalhos de CORS (obrigatório em produção)
CORS_ORIGIN=https://novohiper.seudominio.com.br

# Prefixo da API REST para o frontend PWA
VITE_API_URL=/api

# Autenticação (obrigatório em produção; sem senha padrão). Veja docs/AUTH_AND_SESSIONS.md
AUTH_USERNAME=Bernardo
# Gere com: node scripts/hash-password.mjs  (formato scrypt:N:r:p:salt:hash)
AUTH_PASSWORD_HASH=
SESSION_TTL_DAYS=30
```

---

## 5. Criar e Inicializar os Diretórios Persistentes

Crie as pastas no sistema de arquivos da VPS que serão montadas como volumes persistentes:

```bash
mkdir -p data uploads/plants

# Definir permissões de leitura/escrita adequadas
chmod -R 775 data uploads
```

---

## 6. Construir os Containers

Execute a compilação da imagem Docker sem interferir em outros containers da máquina:

```bash
docker compose build --no-cache
```

O build instalará as dependências, executará o empacotamento do frontend Vite/PWA e preparará o servidor Node.js.

---

## 7. Iniciar os Containers

Inicie o serviço em segundo plano:

```bash
docker compose up -d
```

Verifique se o container está em execução:

```bash
docker compose ps
```

---

## 8. Verificar se o Frontend Responde

Faça uma requisição local na porta configurada para conferir o HTML do frontend:

```bash
curl -i http://localhost:3000/
```

Deverá retornar `HTTP/1.1 200 OK` com o documento HTML da SPA.

---

## 9. Verificar se a API Responde

Verifique a saúde do backend Node.js e da conexão com o banco de dados:

```bash
curl -i http://localhost:3000/api/health
```

Resposta esperada (`200 OK`):

```json
{
  "status": "ok",
  "service": "Novo Hiper Backend API",
  "database": "SQLite (connected)",
  "timestamp": 1728148800000
}
```

---

## 10. Verificar se o SQLite foi Criado

Verifique se o arquivo do banco de dados e os logs WAL foram gerados no volume persistente do host:

```bash
ls -la data/
```

Deverá constar o arquivo `novo-hiper.db`. Você pode inspecionar o esquema com:

```bash
sqlite3 data/novo-hiper.db ".tables"
```

Tabelas presentes:
- `plants`
- `customers`
- `orders`
- `order_items`
- `deliveries`
- `cash_transactions`
- `game_progress`

---

## 11. Testar o Upload de Imagem

Envie uma imagem de teste para validar o armazenamento físico em disco:

```bash
curl -s -X POST http://localhost:3000/api/upload \
  -F "image=@/caminho/para/uma/foto.jpg;type=image/jpeg"
```

A resposta retornará o caminho relativo gravado:

```json
{
  "success": true,
  "filePath": "/uploads/plants/plant_...",
  "fileName": "plant_...",
  "mimeType": "image/jpeg"
}
```

Confira se o arquivo foi gravado fisicamente na pasta:

```bash
ls -la uploads/plants/
```

---

## 12. Configurar o Nginx como Reverse Proxy

Crie um arquivo de configuração para o Novo Hiper no diretório do Nginx existente da sua VPS (ex: `/etc/nginx/sites-available/novo-hiper.conf`):

```nginx
server {
    listen 80;
    server_name novohiper.seudominio.com.br;

    # Limite máximo de upload para as fotos das plantas
    client_max_body_size 6M;

    # Cabeçalhos de segurança
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";

    # Roteamento do frontend SPA e API para a porta do container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache estático otimizado para as fotos das plantas
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_set_header Host $host;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
```

> **Nota**: Se você alterou `APP_PORT` para outra porta no `.env` (ex: `3001`), ajuste `http://127.0.0.1:3001` no `proxy_pass`.

Ative o site e recarregue o Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/novo-hiper.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 13. Configurar HTTPS com Certbot (Let's Encrypt)

Gere o certificado SSL para o seu domínio:

```bash
sudo certbot --nginx -d novohiper.seudominio.com.br
```

O Certbot configurará o redirecionamento automático de HTTP para HTTPS e instalará a rotina de renovação automática no cron/systemd.

---

## 14. Fazer Backup do SQLite e Uploads (Sem Downtime)

Como o SQLite utiliza **WAL (`PRAGMA journal_mode = WAL;`)**, é possível realizar backups a quente sem parar o container e sem travar a aplicação:

### Backup Imediato

```bash
mkdir -p /opt/novo-hiper/backups/db
mkdir -p /opt/novo-hiper/backups/uploads

# 1. Backup consistente do SQLite
sqlite3 /opt/novo-hiper/data/novo-hiper.db ".backup /opt/novo-hiper/backups/db/novo-hiper-$(date +%Y%m%d_%H%M%S).db"

# 2. Backup compactado das fotos das plantas
tar -czf /opt/novo-hiper/backups/uploads/plants-$(date +%Y%m%d_%H%M%S).tar.gz -C /opt/novo-hiper/uploads plants
```

### Script de Backup Diário Automático

Crie o arquivo `/opt/novo-hiper/backup.sh`:

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR="/opt/novo-hiper/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

# Backup quente do SQLite
sqlite3 /opt/novo-hiper/data/novo-hiper.db ".backup $BACKUP_DIR/db/novo-hiper-$TIMESTAMP.db"

# Backup das fotos
tar -czf "$BACKUP_DIR/uploads/plants-$TIMESTAMP.tar.gz" -C /opt/novo-hiper/uploads plants

# Manter últimos 15 dias de backups
find "$BACKUP_DIR/db" -name "*.db" -mtime +15 -delete
find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +15 -delete

echo "Backup executado com sucesso em $TIMESTAMP"
```

Torne o script executável e adicione ao cron (`crontab -e`):

```bash
chmod +x /opt/novo-hiper/backup.sh

# Rodar todos os dias às 03:00
0 3 * * * /opt/novo-hiper/backup.sh >> /var/log/novo-hiper-backup.log 2>&1
```

---

## 15. Atualizar Futuramente Usando Git Sem Perder Dados

Como os dados do banco (`./data`) e as imagens (`./uploads`) estão mapeados em volumes no host, recriar os containers é 100% seguro:

```bash
cd /opt/novo-hiper

# 1. (Recomendado) Rodar backup preventivo
./backup.sh

# 2. Puxar novidades do repositório
git pull origin main

# 3. Reconstruir a imagem da aplicação
docker compose build --no-cache

# 4. Reiniciar o container com zero perda de dados
docker compose up -d

# 5. Conferir status dos logs
docker compose logs --tail=30 novo-hiper
```
