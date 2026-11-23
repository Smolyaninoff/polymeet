#!/usr/bin/env bash
# Запуск PolyMeet одной командой. Нужны только Docker (с Compose v2) и bash.
set -euo pipefail

cd "$(dirname "$0")"

usage() {
    cat <<'EOF'
Использование: ./run.sh [команда]

  up      собрать и запустить систему, дождаться готовности (по умолчанию)
  down    остановить и удалить контейнеры (данные в томах сохраняются)
  logs    смотреть логи всех сервисов
  test-unit  запустить только модульные тесты без БД и Redis
  test    запустить тесты в изолированном стенде
EOF
}

command="${1:-up}"

case "$command" in
    up)
        docker compose up --build -d --wait
        port="${WEB_PORT:-80}"
        base="http://localhost"
        [ "$port" = "80" ] || base="$base:$port"
        echo
        echo "PolyMeet запущен: $base"
        echo "Документация API: $base/api/docs"
        ;;
    test-unit)
        mkdir -p reports/unit
        rm -f reports/unit/backend.xml reports/unit/frontend.xml reports/unit/coverage.xml
        unit_compose=(docker compose -p polymeet-unit -f docker-compose.test.yml)
        cleanup_unit() { "${unit_compose[@]}" down --remove-orphans; }
        trap cleanup_unit EXIT
        backend_rc=0
        frontend_rc=0
        "${unit_compose[@]}" run --build --rm --no-deps tests \
            pytest tests/unit \
            --cov=app.services.meeting_rules \
            --cov=app.services.application_rules \
            --cov=app.services.chat_service \
            --cov=app.core.pagination \
            --cov-report=term-missing \
            --cov-report=xml:/reports/unit/coverage.xml \
            --cov-report=html:/reports/unit/htmlcov \
            --junitxml=/reports/unit/backend.xml || backend_rc=$?
        "${unit_compose[@]}" run --build --rm --no-deps frontend-tests \
            npm test -- --reporter=default --reporter=junit \
            --outputFile.junit=/reports/unit/frontend.xml || frontend_rc=$?
        echo "Отчёты модульных тестов: reports/unit/"
        if (( backend_rc != 0 || frontend_rc != 0 )); then exit 1; fi
        ;;
    test)
        mkdir -p reports
        test_compose=(docker compose -p polymeet-tests -f docker-compose.test.yml)
        cleanup() { "${test_compose[@]}" down -v --remove-orphans; }
        trap cleanup EXIT
        "${test_compose[@]}" up --build -d api worker fake-nominatim
        backend_rc=0
        frontend_rc=0
        "${test_compose[@]}" run --build --rm tests || backend_rc=$?
        "${test_compose[@]}" run --build --rm frontend-tests || frontend_rc=$?
        echo "Отчёты находятся в каталоге reports/"
        if (( backend_rc != 0 || frontend_rc != 0 )); then exit 1; fi
        ;;
    down)
        docker compose down
        ;;
    logs)
        docker compose logs -f
        ;;
    -h | --help | help)
        usage
        ;;
    *)
        echo "Неизвестная команда: $command" >&2
        usage >&2
        exit 1
        ;;
esac
