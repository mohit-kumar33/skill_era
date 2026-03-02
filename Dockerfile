FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Build TypeScript
FROM base AS build
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

EXPOSE 3000
USER node

CMD ["node", "dist/server.js"]
