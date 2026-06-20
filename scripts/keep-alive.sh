#!/bin/bash
# Keep-alive script for Next.js production server
while true; do
  if ! pgrep -f "next start" > /dev/null; then
    echo "[$(date)] Starting Next.js server..." >> /tmp/next-keepalive.log
    cd /home/z/my-project
    npx next start -p 3000 -H 0.0.0.0 >> /tmp/next-prod.log 2>&1 &
    sleep 5
    if pgrep -f "next start" > /dev/null; then
      echo "[$(date)] Server started successfully" >> /tmp/next-keepalive.log
    else
      echo "[$(date)] Server failed to start" >> /tmp/next-keepalive.log
    fi
  fi
  sleep 3
done
