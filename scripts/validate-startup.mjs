import net from 'node:net';

const REQUIRED_PORTS = [5001, 5174];

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  const inUse = [];
  for (const port of REQUIRED_PORTS) {
    if (await isPortInUse(port)) inUse.push(port);
  }

  if (inUse.length > 0) {
    console.error(`[startup-check] Ports already in use: ${inUse.join(', ')}.`);
    console.error('[startup-check] Stop conflicting processes or change dev ports before starting.');
    process.exit(1);
  }

  console.log('[startup-check] Port validation passed.');
}

main();
