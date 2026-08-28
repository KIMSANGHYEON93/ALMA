FROM node:22-alpine AS builder

WORKDIR /app
ARG BACKEND_URL=http://localhost:8000
ENV BACKEND_URL=${BACKEND_URL}

COPY package.json package-lock.json ./
# package-lock.json is authored by npm 11; node:22-alpine bundles npm 10.
RUN npm install -g npm@11.6.2 && npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
