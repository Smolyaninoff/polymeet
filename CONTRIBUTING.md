# Как работать с репозиторием

## Запуск

Вся система одной командой (нужны только Docker с Compose v2 и bash):

```bash
./run.sh up      # собрать, запустить и дождаться готовности
./run.sh logs    # логи всех сервисов
./run.sh down    # остановить (данные в томах сохраняются)
```

После запуска: приложение — http://localhost, документация API — http://localhost/api/docs. Порт меняется переменной `WEB_PORT`, остальные настройки — в `.env.example`.

### Бэкенд

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
ruff check . && ruff format --check . && mypy app/services app/core && mypy app
pytest
```

Интеграционные тесты сами поднимают PostgreSQL и Redis через testcontainers — нужен запущенный Docker. Вместо этого можно указать готовые сервисы в `TEST_DATABASE_URL` и `TEST_REDIS_URL`.

Если менялся API — обновить контракт: `python scripts/export_openapi.py` (тест-снимок не даст об этом забыть).

### Фронтенд

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173
npm run lint && npm run build
```

## Задачи и ветки

- Каждый этап или задача — Issue с исполнителем (шаблон «Задача»). ТЗ этапов лежат в `docs/stages/`.
- Ветка от свежего `main`: `feature/<номер-issue>-<код-этапа>-<описание>`, например `feature/21-s07-feed`.
- Прямые пуши в `main` запрещены, всё через Pull Request.

## Коммиты

Формат: `тип(область): что сделано` на русском, в повелительном или назывном виде.

- типы: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `build`, `chore`;
- области: `core`, `db`, `auth`, `meetings`, `feed`, `geo`, `applications`, `infra`, `frontend` и т. п.;
- примеры: `feat(feed): лента с фильтрами и курсором`, `fix(auth): 401 при отозванном refresh-токене`.

Этап — от двух до пяти осмысленных коммитов; каждый проходит линтеры и тесты сам по себе.

## Pull Request

- Описание по шаблону, в первой строке `Closes #<номер>`.
- Нужны зелёный CI и одно одобряющее ревью.
- Изменение контракта API (схемы, коды ответов, новые эндпоинты) — только с обновлённым `backend/openapi.json` и меткой `api-change`, чтобы фронтенд узнал о нём из ревью. Добавлять необязательные поля можно; менять или удалять существующие — только по договорённости.
- Миграции Alembic идут одной цепочкой: номер ревизии задаётся вручную (`alembic revision --rev-id 0004 -m "..."`), `down_revision` — последняя ревизия в `main`. Если `main` ушёл вперёд с новой ревизией, перенумеровать свою перед слиянием.
