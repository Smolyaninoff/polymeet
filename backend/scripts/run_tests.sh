#!/usr/bin/env bash
set -uo pipefail
mkdir -p /reports
pytest tests/unit tests/integration --cov=app --cov-report=term-missing \
  --cov-report=xml:/reports/coverage.xml --cov-report=html:/reports/htmlcov \
  --junitxml=/reports/junit-unit-integration.xml
unit_rc=$?
pytest tests/e2e --junitxml=/reports/junit-e2e.xml
e2e_rc=$?
python - <<'PY'
import xml.etree.ElementTree as ET
print('\nИТОГ')
for label, path in [('Модульные и интеграционные', '/reports/junit-unit-integration.xml'),
                    ('Сквозные', '/reports/junit-e2e.xml')]:
    try:
        root = ET.parse(path).getroot()
        suites = list(root) if root.tag == 'testsuites' else [root]
        totals = {key: sum(int(s.get(key, 0)) for s in suites)
                  for key in ('tests', 'failures', 'errors', 'skipped')}
        print(f"{label}: {totals}")
    except (OSError, ET.ParseError):
        print(f'{label}: отчёт не создан')
try:
    root = ET.parse('/reports/coverage.xml').getroot()
    print(f"Покрытие строк: {float(root.get('line-rate', '0')) * 100:.1f}%")
except (OSError, ET.ParseError):
    print('Покрытие строк: отчёт не создан')
PY
if (( unit_rc != 0 || e2e_rc != 0 )); then exit 1; fi
