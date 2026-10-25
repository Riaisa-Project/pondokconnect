FROM node:22-bookworm-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS application
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SERVE_FRONTEND=true
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ /app/backend/
COPY scripts/start_render.py /app/scripts/start_render.py
COPY alembic.ini /app/alembic.ini
COPY --from=frontend-build /frontend/dist /app/frontend/dist
RUN mkdir -p /var/data/uploads /var/data/private /app/storage/uploads /home/appuser/.ssh \
    && chmod 0700 /home/appuser/.ssh \
    && chown -R appuser:appuser /var/data /app/storage /home/appuser/.ssh
USER appuser
EXPOSE 10000
CMD ["python", "scripts/start_render.py"]
