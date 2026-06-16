FROM ghcr.io/hostinger/hvps-hermes-agent:latest

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HERMES_SOURCE_DIR=/opt/hermes-src

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
      "uv" && \
    /opt/hermes/.venv/bin/python3 -m playwright install chromium && \
    /opt/hermes/.venv/bin/python3 -m playwright install-deps

# Make common tools available without requiring the caller to know the venv path.
RUN ln -sf /opt/hermes/.venv/bin/hermes /usr/local/bin/hermes && \
    ln -sf /opt/hermes/.venv/bin/uv /usr/local/bin/uv && \
    printf '#!/usr/bin/env bash\nexec /opt/hermes/.venv/bin/python3 "$@"\n' > /usr/local/bin/hermes-python && \
    chmod +x /usr/local/bin/hermes-python

COPY docker/hermes-init.sh /usr/local/bin/hermes-init.sh
COPY docker/hermes-api-server.sh /usr/local/bin/hermes-api-server.sh
COPY docker/hermes-kanban-dashboard.sh /usr/local/bin/hermes-kanban-dashboard.sh

RUN chmod +x \
      /usr/local/bin/hermes-init.sh \
      /usr/local/bin/hermes-api-server.sh \
      /usr/local/bin/hermes-kanban-dashboard.sh

ENTRYPOINT ["/usr/bin/tini", "--"]
