FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# ... (resto de tu Dockerfile igual) ...

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir uvicorn fastapi gunicorn && \
    pip install --no-cache-dir -r requirements.txt
EXPOSE 10000

CMD ["sh", "-c", "python -m uvicorn main:app --app-dir /app --host 0.0.0.0 --port ${PORT:-10000}"]
