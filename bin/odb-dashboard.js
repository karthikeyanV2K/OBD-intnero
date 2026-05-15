#!/usr/bin/env node
/**
 * bin/odb-dashboard.js
 * Run: odb-dashboard   (or: npx odb-echograph dashboard)
 *
 * - Scans for a free port from 3742
 * - Starts the lightweight dashboard server
 * - Opens the browser automatically
 * - Exits cleanly on Ctrl+C
 */

const { exec }    = require('child_process');
const { startServer } = require('../server');

async function main() {
  const port = await startServer();
  const url  = `http://localhost:${port}`;

  // Open browser cross-platform
  const cmd = process.platform === 'win32'  ? `start ""  "${url}"` :
              process.platform === 'darwin' ? `open "${url}"` :
              `xdg-open "${url}"`;

  exec(cmd, err => {
    if (err) console.error('[dashboard] Could not auto-open browser. Visit:', url);
    else     console.log('[dashboard] Browser opened →', url);
  });

  console.log('[dashboard] Press Ctrl+C to stop.\n');
}

process.on('SIGINT',  () => { console.log('\n[dashboard] Stopped.'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));

main().catch(err => {
  console.error('[dashboard] Fatal:', err.message);
  process.exit(1);
});
