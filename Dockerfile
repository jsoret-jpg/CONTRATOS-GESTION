FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir uvicorn fastapi gunicorn && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/storage

EXPOSE 10000

# Ejecutamos python directamente importando main:app e imprimiendo el traceback completo
CMD ["python", "-c", "import sys; sys.path.insert(0, '/app'); import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=10000, log_level='debug')"]
