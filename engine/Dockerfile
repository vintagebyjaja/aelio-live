# AELIO engine image, for the Cloudflare Containers variant (cloudflare/aelio-engine-worker/wrangler.container.toml).
# Not needed for the Workers VPC variant, where the engine runs directly on your machine.
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git util-linux && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV AELIO_DATA_DIR=/data AELIO_SECURE_COOKIES=1 AELIO_ALLOWED_HOSTS=aelio-engine.internal,localhost,127.0.0.1
# Secrets (OPENAI_API_KEY, AELIO_PROXY_SECRET, Stripe, Firebase ids) are passed in as container env vars, never baked in.
EXPOSE 8787
CMD ["python", "-m", "aelio.cli", "serve", "--host", "0.0.0.0", "--port", "8787"]
