#!/usr/bin/env bash
set -euo pipefail

# 1) Ensure Chrome path for Puppeteer
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# 2) Start Next dev server in background
npm run dev >/dev/null 2>&1 &
DEV_PID=$!

# 3) Wait for server to be ready (adjust if needed)
echo "Waiting for Next.js to start..."
until curl -sSf http://localhost:3000 >/dev/null; do sleep 1; done
echo "Server up."

# 4) Call the API (POST) with all values filled
# Adjust these as you like
KEYWORDS="python developer"
LOCATION="remote"
DATE_SINCE_POSTED="past_week"
LIMIT=50
EXPERIENCE_LEVEL=""
REMOTE_FILTER="remote"
SORT_BY="recent"
PAGE=0

echo "Scraping jobs..."
curl -sS -X POST "http://localhost:3000/api/jobs/scrape" \
  -H "content-type: application/json" \
  -d "{
    \"keywords\": \"${KEYWORDS}\",
    \"location\": \"${LOCATION}\",
    \"dateSincePosted\": \"${DATE_SINCE_POSTED}\",
    \"limit\": ${LIMIT},
    \"experienceLevel\": \"${EXPERIENCE_LEVEL}\",
    \"remoteFilter\": \"${REMOTE_FILTER}\",
    \"sortBy\": \"${SORT_BY}\",
    \"page\": ${PAGE}
  }" | tee jobs.json | jq '.'

# 5) Stop dev server
kill $DEV_PID || true