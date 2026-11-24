#!/bin/sh
set -e
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Applying database migrations…"
  ./node_modules/.bin/prisma migrate deploy
fi
exec "$@"
