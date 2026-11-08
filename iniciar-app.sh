#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
PORT="${1:-8080}"
printf '\nAplicación disponible en http://127.0.0.1:%s/\nPulsa Ctrl+C para detenerla.\n\n' "$PORT"
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; command -v xdg-open >/dev/null 2>&1 && xdg-open "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || true) &
  python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT" --bind 127.0.0.1
else
  echo 'Necesitas Python 3 o cualquier servidor web estático.' >&2
  exit 1
fi
