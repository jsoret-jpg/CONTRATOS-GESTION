FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# ... (resto de tu Dockerfile igual) ...

COPY . .

RUN mkdir -p /app/storage

EXPOSE 10000

CMD ["sh", "-c", "uvicorn main:app --app-dir /app --host 0.0.0.0 --port ${PORT:-10000}"]
