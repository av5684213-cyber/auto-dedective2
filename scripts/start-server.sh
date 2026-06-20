#!/bin/bash
# Start the Next.js standalone server, fully detached
cd /home/z/my-project/.next/standalone
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PORT=3000
export HOSTNAME=0.0.0.0

# Kill any existing server
pkill -f "node server.js" 2>/dev/null
sleep 1

# Start fully detached via setsid in its own session
setsid bash -c 'exec node server.js' > /tmp/next-server.log 2>&1 < /dev/null &
PID=$!
disown $PID
echo $PID > /tmp/next-server.pid
echo "Server PID: $PID"
sleep 4
if kill -0 $PID 2>/dev/null; then
  echo "Server is running"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
else
  echo "Server died"
fi
