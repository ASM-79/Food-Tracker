#!/bin/bash
cd "$(dirname "$0")/app" || exit 1

# Build only if the production bundle doesn't exist yet
if [ ! -f "dist-electron/main.js" ] || [ ! -f "dist/index.html" ]; then
  echo "First run: building app..."
  npm run build
fi

unset ELECTRON_RUN_AS_NODE
npm run start
