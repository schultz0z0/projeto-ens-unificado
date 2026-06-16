FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/outputs /app/tmp /app/temp/uploads && \
    useradd --create-home --shell /usr/sbin/nologin appuser && \
    chown -R appuser:appuser /app

COPY docker-entrypoint.sh /usr/local/bin/designer-api-entrypoint.sh
RUN chmod +x /usr/local/bin/designer-api-entrypoint.sh

EXPOSE 8090

ENTRYPOINT ["/usr/local/bin/designer-api-entrypoint.sh"]
CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT:-8090}"]
