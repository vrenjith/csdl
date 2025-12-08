const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const gen = require('../lib/generator');

async function run() {
  const tmp = path.resolve(__dirname, 'tmp');
  await fs.remove(tmp);
  await fs.ensureDir(tmp);
  // write minimal service.yaml
  const yaml = `name: testsvc
image: busybox
replicas: 1
ports:\n  - 8080\n`;
  await fs.writeFile(path.join(tmp, 'service.yaml'), yaml, 'utf8');
  await gen.generateFromYaml(path.join(tmp, 'service.yaml'), path.join(tmp, '.csdl', 'generated'));
  const genDir = path.join(tmp, '.csdl', 'generated');
  assert(await fs.pathExists(path.join(genDir, 'k8s-deployment.yaml')),
    'k8s manifest not generated');
  assert(await fs.pathExists(path.join(genDir, 'nomad-job.hcl')),
    'nomad manifest not generated');
  console.log('test-gen: PASS');
}

run().catch(err => {
  console.error('test-gen: FAIL', err);
  process.exit(2);
});
