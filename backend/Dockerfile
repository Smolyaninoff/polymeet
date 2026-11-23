# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --no-create-home app
WORKDIR /app
COPY pyproject.toml ./
# Зависимости ставятся отдельным слоем, чтобы правка кода не сбрасывала кэш сборки
RUN python -c "import tomllib; d = tomllib.load(open('pyproject.toml', 'rb')); \
print('\n'.join(d['project']['dependencies']))" > /tmp/requirements.txt \
    && pip install -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

FROM base AS dev
RUN python -c "import tomllib; d = tomllib.load(open('pyproject.toml', 'rb')); \
print('\n'.join(d['project']['optional-dependencies']['dev']))" > /tmp/requirements-dev.txt \
    && pip install -r /tmp/requirements-dev.txt \
    && rm /tmp/requirements-dev.txt
COPY --chown=app:app alembic.ini gunicorn.conf.py openapi.json ./
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app app ./app
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app tests ./tests
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS prod
COPY --chown=app:app alembic.ini gunicorn.conf.py ./
COPY --chown=app:app migrations ./migrations
COPY --chown=app:app app ./app
USER app
EXPOSE 8000
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]
