const gen = require('../lib/generator');

async function run() {
  const ks = await gen.kindStatus('csdl-dev');
  if (typeof ks.installed !== 'boolean') throw new Error('kindStatus.installed missing');
  if (!Array.isArray(ks.clusters)) throw new Error('kindStatus.clusters missing');
  console.log('test-status: kindStatus OK ->', { installed: ks.installed, clusters: ks.clusters.length });

  const ns = await gen.nomadStatus(process.cwd());
  if (typeof ns.pidFileExists !== 'boolean') throw new Error('nomadStatus.pidFileExists missing');
  if (typeof ns.running !== 'boolean') throw new Error('nomadStatus.running missing');
  console.log('test-status: nomadStatus OK ->', { pidFileExists: ns.pidFileExists, running: ns.running, command: ns.command });

  console.log('test-status: PASS');
}

run().catch(err => { console.error('test-status: FAIL', err); process.exit(2); });
