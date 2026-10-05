# Build & Runtime stage for Novo Hiper
FROM node:22-bookworm-slim

# Definir diretório de trabalho
WORKDIR /app

# Instalar utilitários de sistema necessários (sqlite3 para backups a quente e curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copiar manifesto de dependências e package-lock.json consistente
COPY package.json package-lock.json ./

# Instalação limpa e reprodutível de dependências em produção
RUN npm ci

# Copiar código-fonte da aplicação
COPY . .

# Compilar frontend React (Vite + PWA + Tailwind)
RUN npm run build

# Criar diretórios para volumes persistentes
RUN mkdir -p /app/data /app/uploads/plants

# Declarar volumes persistentes para SQLite e fotos das plantas
VOLUME ["/app/data", "/app/uploads"]

# Expor porta interna da aplicação
EXPOSE 3000

# Variáveis padrão
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV DATABASE_PATH=/app/data/novo-hiper.db
ENV UPLOADS_DIR=/app/uploads

# Healthcheck interno do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Iniciar servidor full-stack (API Node.js + SQLite + Frontend PWA)
CMD ["npm", "start"]
