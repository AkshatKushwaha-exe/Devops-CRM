# syntax=docker/dockerfile:1.7
# Stage 1 builds the React app; stage 2 serves it from unprivileged Nginx, which also proxies /api.

FROM node:24.22-alpine3.24 AS build
RUN npm install --global pnpm@10.33.4
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.30-alpine3.24 AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="devops-crm-frontend" \
      org.opencontainers.image.source="https://github.com/AkshatKushwaha-exe/Devops-CRM" \
      org.opencontainers.image.version="${VERSION}"
# host:port of the API. The image entrypoint renders templates/*.template into conf.d at start.
ENV API_UPSTREAM=backend:8000
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
