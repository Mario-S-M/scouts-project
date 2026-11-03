FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist

# Logos e imágenes institucionales que el PDF de informes incrusta en tiempo de ejecución
COPY public ./public
# Plantilla del protocolo de traslado (formato oficial CNAR)
COPY templates ./templates

RUN mkdir -p /app/uploads/evidencias /app/uploads/fotos

EXPOSE 3000

CMD ["node", "dist/main"]
