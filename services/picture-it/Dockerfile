FROM oven/bun:1.3.14 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS assets
COPY tsconfig.json index.ts ./
COPY scripts ./scripts
COPY src ./src
RUN bun run download-fonts

FROM oven/bun:1.3.14 AS runtime
ENV NODE_ENV=production \
    HOME=/home/bun \
    PICTURE_PORT=8090 \
    PICTURE_TEMP_ROOT=/tmp/picture-work
WORKDIR /app

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/picture-work /home/bun/.picture-it/fonts \
    && chown -R bun:bun /app /tmp/picture-work /home/bun

COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --from=assets --chown=bun:bun /root/.picture-it/fonts ./fonts
COPY --chown=bun:bun package.json bun.lock tsconfig.json index.ts ./
COPY --chown=bun:bun src ./src
COPY --chown=bun:bun scripts ./scripts
COPY --chown=bun:bun test ./test
COPY --chown=bun:bun docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 0755 /usr/local/bin/docker-entrypoint.sh

USER bun
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 \
  CMD curl --fail --silent http://127.0.0.1:8090/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "run", "src/service/main.ts"]
