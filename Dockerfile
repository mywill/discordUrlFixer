# Build stage
FROM node:24.19.0-alpine3.24 AS build
RUN apk add --no-cache build-base python3
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ src/
RUN pnpm build

# Runtime stage
FROM node:24.19.0-alpine3.24
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN apk add --no-cache libstdc++ build-base python3 && \
    corepack enable && \
    pnpm install --frozen-lockfile --prod && \
    apk del build-base python3
COPY --from=build /app/dist/ dist/
COPY drizzle/ drizzle/
RUN mkdir -p /app/data
VOLUME ["/app/data"]
CMD ["node", "dist/index.js"]
