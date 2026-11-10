FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY index.html workflow.js ./
COPY assets ./assets
RUN mkdir -p /app/uploads && useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.bootstrap_admin && uvicorn app.main:app --host 0.0.0.0 --port 8000"]