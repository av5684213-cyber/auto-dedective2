#!/bin/bash
cd /home/z/my-project/.next/standalone
export DATABASE_URL="file:/home/z/my-project/db/custom.db"
export PORT=3000
export HOSTNAME=0.0.0.0
exec node server.js
