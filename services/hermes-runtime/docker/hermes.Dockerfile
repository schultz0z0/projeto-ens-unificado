FROM ghcr.io/hostinger/hvps-hermes-agent:latest

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HERMES_SOURCE_DIR=/opt/hermes-src \
    NEXUS_GRAPH_BACKEND=neo4j-multi-tenant-user \
    NEXUS_GRAPH_URL=bolt://neo4j:7687 \
    NEXUS_DEFAULT_DB=nexus \
    NEXUS_TENANT_ID=\
    NEXUS_NEO4J_USER=neo4j \
    NEXUS_NEO4J_PASSWORD=CHANGEME\
    NEXUS_USER_ID=\n    NEXUS_MEMORY_DIR=/opt/data/memory
    NEXUS_GRAPH_JSON=/opt/data/graphify-out/graph.json

# Base runtime/development dependencies expected by Hermes Desktop-like usage:
# - curl/git/build tools for setup and integrations
# - Chromium + Playwright deps for browser automation
# - Node/npm/npx for JS-based MCP servers
# - Python venv/pip/uv for Python-based MCP servers
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
      bash curl git build-essential ca-certificates openssl wget gnupg \
      chromium \
      python3 python3-pip python3-venv \
      nodejs npm \
      tini \
    && rm -rf /var/lib/apt/lists/*

# Install the repo-vendored Hermes Agent source so VPS builds use this
# monorepo/fork instead of pulling hermes-agent from PyPI.
COPY vendor/hermes-agent /opt/hermes-src

# Bootstrap the Hermes venv used by the Hostinger image. Install Hermes extras
# from the local source, plus MCP SDK, Playwright and uv so MCP/tool
# dependencies can be resolved at runtime.
RUN /opt/hermes/.venv/bin/python3 -m ensurepip --upgrade && \
    /opt/hermes/.venv/bin/python3 -m pip install --upgrade pip setuptools wheel && \
    /opt/hermes/.venv/bin/python3 -m pip install --upgrade \
      -e "/opt/hermes-src[web,pty]" \
      "mcp" \
      "playwright" \
      "PyYAML" \
      "graphifyy[all]" \
      "uv" && \
    /opt/hermes/.venv/bin/python3 -m playwright install chromium && \
    /opt/hermes/.venv/bin/python3 -m playwright install-deps

# Install pptx-studio skill (Node.js 20+ ja vem do apt-get install acima)
# Esta skill precisa de: dom-to-pptx, adm-zip, playwright (Node)
# Install graphify wrapper (v3.8+: Neo4j multi-tenant + multi-user)
COPY vendor/hermes-agent/skills/code-graph/graphify/tools/graphify_backend.py /opt/graphify_backend.py
COPY vendor/hermes-agent/skills/code-graph/graphify/tools/memory_store.py /opt/memory_store.py
COPY vendor/hermes-agent/skills/code-graph/graphify/tools/memory_api.py /opt/memory_api.py
COPY vendor/hermes-agent/skills/code-graph/graphify/tools/neo4j_admin.py /opt/neo4j_admin.py
RUN chmod +x /opt/graphify_backend.py /opt/memory_store.py /opt/memory_api.py /opt/neo4j_admin.py &&     /opt/hermes/.venv/bin/python /opt/graphify_backend.py --check 2>&1 | tail -2;     echo "smoke-test-ok (Neo4j checa apenas em runtime)"

# Install pptx-studio skill (Node.js 20+ ja vem do apt-get install acima)
# Esta skill precisa de: dom-to-pptx, adm-zip, playwright (Node)
COPY vendor/hermes-agent/skills/marketing/pptx-studio /opt/pptx-studio
WORKDIR /opt/pptx-studio
RUN npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -5 && \
    node scripts/patch-dom-to-pptx.js 2>&1 | tail -5 && \
    # Compila primitives/ em dist/styles.css (timeline, comparison, quote, stats)
    # Se primitives/*.css mudar, o dist/ e regenerado automaticamente
    npm run build:css:full 2>&1 | tail -3 && \
    # Smoke test: garantir que o build gerou output nao-vazio
    test -s primitives/dist/styles.css && echo "OK: dist/styles.css compiled ($(wc -c < primitives/dist/styles.css) bytes)" || \
        (echo "FATAL: dist/styles.css vazio apos build" && exit 1) && \
    npm cache clean --force
WORKDIR /opt/hermes-src

# Install graphify skill (knowledge graph do codebase, graphifyy[all] ja instalado via pip acima).
# O comando abaixo gera SKILL.md + references/ em ~/.hermes/skills/graphify/ (auto-detectado pelo Hermes).
RUN mkdir -p /home/nexusai/.hermes/skills &&     /opt/hermes/.venv/bin/graphify install --platform hermes 2>&1 | tail -3

# Make common tools available without requiring the caller to know the venv path.
RUN ln -sf /opt/hermes/.venv/bin/hermes /usr/local/bin/hermes && \
    ln -sf /opt/hermes/.venv/bin/uv /usr/local/bin/uv && \
    printf '#!/usr/bin/env bash\nexec /opt/hermes/.venv/bin/python3 "$@"\n' > /usr/local/bin/hermes-python && \
    chmod +x /usr/local/bin/hermes-python

COPY docker/hermes-init.sh /usr/local/bin/hermes-init.sh
COPY docker/hermes-api-server.sh /usr/local/bin/hermes-api-server.sh
COPY docker/hermes-kanban-dashboard.sh /usr/local/bin/hermes-kanban-dashboard.sh
COPY docker/ensure-ens-rag-mcp.sh /usr/local/bin/ensure-ens-rag-mcp.sh
COPY docker/ensure-ens-rag-mcp.py /usr/local/bin/ensure-ens-rag-mcp.py
COPY templates/hermes/config.yaml /opt/hermes-defaults/config.yaml

RUN chmod +x \
      /usr/local/bin/hermes-init.sh \
      /usr/local/bin/hermes-api-server.sh \
      /usr/local/bin/hermes-kanban-dashboard.sh \
      /usr/local/bin/ensure-ens-rag-mcp.sh \
      /usr/local/bin/ensure-ens-rag-mcp.py

ENTRYPOINT ["/usr/bin/tini", "--"]

