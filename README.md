# Novo Hiper — Plantas e Jardinagem

Aplicativo web progressivo (PWA) de gerenciamento de loja infantil de plantas, catálogo com fotografias reais, gestão de pedidos de clientes, controle de estoque em tempo real, caixa da loja e simulação de entregas em Olinda, Pernambuco.

O projeto foi projetado com arquitetura leve e desacoplada para execução em VPS própria sem depender de serviços externos como Supabase ou Firebase.

---

## Sumário da Arquitetura

```text
                     Navegador / PWA
                           ↓  (HTTPS)
                  Nginx Reverse Proxy
                           ↓  (:3000 / :APP_PORT)
                   Node.js Express API
                     ↙            ↘
        SQLite Persistente      Uploads de Imagens
     (/app/data/novo-hiper.db)   (/app/uploads/plants/)
```

- **Frontend**: Single Page Application (SPA) com React 19, TypeScript, Tailwind CSS v4, Lucide Icons e suporte completo a PWA (Service Workers, offline e instalação nativa).
- **Backend**: API REST em Node.js com Express, estruturada com rotas modulares e validações estritas de negócio.
- **Banco de Dados**: SQLite persistente com WAL (*Write-Ahead Logging*) ativo para alta concorrência e integridade referencial.
- **Armazenamento de Fotos**: Imagens gravadas diretamente no sistema de arquivos do servidor com validação de tipo MIME e tamanho máximo, mantendo apenas a referência relativa no SQLite.
- **Isolamento em Docker**: Execução encapsulada via Docker e Docker Compose com volumes externos para preservação total dos dados entre recriações de containers.

---

## Estrutura Básica do Projeto

```text
novo-hiper/
├── backend/                  # Código-fonte da API REST
│   ├── routes/
│   │   ├── plants.ts         # Catálogo e estoque de plantas
│   │   ├── customers.ts      # Clientes e destinos
│   │   ├── orders.ts         # Pedidos e itens com preços fixados
│   │   ├── deliveries.ts     # Entregas e finalizações validadas
│   │   ├── cash.ts           # Caixa virtual e transações
│   │   ├── game.ts           # Estado e progresso do mini-jogo
│   │   ├── upload.ts         # Upload e sanitização de imagens
│   │   └── migration.ts      # Migração atômica do localStorage
│   ├── app.ts                # Configuração do Express e CORS
│   └── db.ts                 # Conexão SQLite e inicialização do esquema
├── src/                      # Código-fonte do frontend React PWA
│   ├── components/           # Componentes visuais e modais
│   ├── game/                 # Lógica de mapa e tipos do jogo
│   ├── services/             # API client, migração, som e storage local
│   ├── types.ts              # Definições de tipos TypeScript
│   ├── App.tsx               # Componente raiz com sincronização
│   └── main.tsx              # Ponto de entrada React
├── data/                     # Diretório de persistência do SQLite (.gitignore)
├── uploads/                  # Diretório de fotos das plantas (.gitignore)
├── server.ts                 # Servidor de entrada full-stack
├── Dockerfile                # Imagem de produção Node.js
├── docker-compose.yml        # Configuração de containers e volumes
├── .env.example              # Modelo de variáveis de ambiente
├── .gitignore                # Arquivos ignorados pelo Git
├── README.md                 # Visão geral e instruções do projeto
└── DEPLOY.md                 # Guia passo a passo de deploy na VPS
```

---

## Variáveis de Ambiente

As variáveis de ambiente são configuradas no arquivo `.env` a partir do modelo `.env.example`:

| Variável | Valor Padrão | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo de execução do Node.js |
| `PORT` | `3000` | Porta interna em que o servidor escuta requisições |
| `APP_PORT` | `3000` | Porta externa exposta no host da VPS via Docker Compose |
| `DATA_DIR` | `/app/data` | Diretório onde o arquivo SQLite é armazenado |
| `DATABASE_PATH` | `/app/data/novo-hiper.db` | Caminho do arquivo do banco SQLite |
| `UPLOADS_DIR` | `/app/uploads` | Diretório de armazenamento físico das fotos |
| `CORS_ORIGIN` | `*` ou domínio | Origem autorizada para requisições CORS |
| `VITE_API_URL` | `/api` | Prefixo da URL da API consumida pelo frontend |

---

## Como Executar Localmente

### Pré-requisitos
- Node.js 22 ou superior
- npm

### Passos:
1. Clone o repositório:
   ```bash
   git clone https://github.com/caiomvital/novo-hiper.git
   cd novo-hiper
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie os diretórios de persistência:
   ```bash
   mkdir -p data uploads/plants
   ```

4. Configure o `.env`:
   ```bash
   cp .env.example .env
   ```

5. Inicie o servidor em modo de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse a aplicação no navegador em `http://localhost:3000`.

---

## Como Fazer Build

Para compilar o frontend e testar a checagem de tipos estática:

```bash
# Validar tipagem TypeScript
npm run lint

# Gerar o bundle de produção em dist/
npm run build

# Iniciar servidor full-stack de produção
npm start
```

---

## Execução via Docker

Para rodar toda a aplicação em container Docker isolado:

```bash
# Construir e iniciar os containers em segundo plano
docker compose up -d --build

# Verificar logs
docker compose logs -f novo-hiper

# Parar os containers sem perder dados
docker compose down
```

Os dados do SQLite (`./data`) e as imagens (`./uploads`) são mapeados para volumes persistentes no host.

---

## Deploy em Produção na VPS

Para instruções detalhadas de implantação em VPS Linux (incluindo Nginx, HTTPS com Certbot, backups sem parada e atualizações seguras via Git), consulte o arquivo **[DEPLOY.md](./DEPLOY.md)**.
