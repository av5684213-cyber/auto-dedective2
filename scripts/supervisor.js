const { spawn } = require('child_process');
const http = require('http');

function startServer() {
  const proc = spawn('node', ['--max-old-space-size=256', 'server.js'], {
    cwd: '/home/z/my-project/.next/standalone',
    env: {
      ...process.env,
      DATABASE_URL: 'file:/home/z/my-project/db/custom.db',
      PORT: '3000',
      HOSTNAME: '0.0.0.0',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: true,
  });
  proc.unref();
  console.log(`[${new Date().toISOString()}] Started server PID ${proc.pid}`);
  
  proc.on('exit', (code, signal) => {
    console.log(`[${new Date().toISOString()}] Server exited code=${code} signal=${signal}`);
    setTimeout(() => {
      startServer();
    }, 2000);
  });
  
  return proc;
}

startServer();

// Keep supervisor alive
setInterval(() => {
  http.get('http://localhost:3000/', (res) => {
    // ignore
  }).on('error', () => {
    // server might be down, will be restarted by exit handler
  });
}, 30000);
