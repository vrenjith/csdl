const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const mustache = require('mustache');
const execa = require('execa');

async function initProject(dir) {
  await fs.ensureDir(dir);
  const exampleYaml = await fs.readFile(path.join(__dirname, '..', 'templates', 'service.example.yaml'), 'utf8');
  const serviceYamlPath = path.join(dir, 'service.yaml');
  if (await fs.pathExists(serviceYamlPath)) {
    throw new Error('service.yaml already exists in ' + dir);
  }
  await fs.writeFile(serviceYamlPath, exampleYaml, 'utf8');
  await fs.ensureDir(path.join(dir, '.csdl'));
  await fs.copy(path.join(__dirname, '..', 'templates'), path.join(dir, '.csdl', 'templates'));
}

async function generateFromYaml(serviceYamlPath, outDir) {
  if (!await fs.pathExists(serviceYamlPath)) throw new Error('service.yaml not found: ' + serviceYamlPath);
  const content = await fs.readFile(serviceYamlPath, 'utf8');
  const doc = yaml.load(content);
  await fs.ensureDir(outDir);

  // generate k8s
  const k8s = renderTemplate('k8s-deployment.yaml.mustache', doc);
  await fs.writeFile(path.join(outDir, 'k8s-deployment.yaml'), k8s, 'utf8');

  // generate nomad
  const nomad = renderTemplate('nomad-job.hcl.mustache', doc);
  await fs.writeFile(path.join(outDir, 'nomad-job.hcl'), nomad, 'utf8');

  // generate devcontainer
  const devc = renderTemplate('devcontainer.json.mustache', doc);
  await fs.writeFile(path.join(outDir, 'devcontainer.json'), devc, 'utf8');

  // generate CI
  const gha = renderTemplate('github-workflow.yml.mustache', doc);
  await fs.ensureDir(path.join(outDir, 'ci'));
  await fs.writeFile(path.join(outDir, 'ci', 'github-actions.yml'), gha, 'utf8');

  const jenkins = renderTemplate('jenkinsfile.mustache', doc);
  await fs.writeFile(path.join(outDir, 'ci', 'Jenkinsfile'), jenkins, 'utf8');

  // generate AWS Lambda serverless template
  try {
    const lambda = renderTemplate('aws-lambda-serverless.yml.mustache', doc);
    await fs.ensureDir(path.join(outDir, 'lambda'));
    await fs.writeFile(path.join(outDir, 'lambda', 'serverless.yml'), lambda, 'utf8');
  } catch (e) {
    // if template missing, ignore
  }
}

function renderTemplate(name, view) {
  const tplPath = path.join(__dirname, '..', 'templates', name);
  if (!fs.existsSync(tplPath)) throw new Error('template not found: ' + name);
  const tpl = fs.readFileSync(tplPath, 'utf8');
  return mustache.render(tpl, view || {});
}

async function generateCI(dir) {
  const out = path.join(dir, '.csdl', 'ci');
  await fs.ensureDir(out);
  const gha = fs.readFileSync(path.join(__dirname, '..', 'templates', 'github-workflow.yml.mustache'), 'utf8');
  await fs.writeFile(path.join(out, 'github-actions.yml'), gha, 'utf8');
  const jenkins = fs.readFileSync(path.join(__dirname, '..', 'templates', 'jenkinsfile.mustache'), 'utf8');
  await fs.writeFile(path.join(out, 'Jenkinsfile'), jenkins, 'utf8');
}

async function runDevCluster(opts = {}) {
  // opts: { target, dir, autoKind, clusterName, confirm }
  const target = opts.target || 'kubernetes';
  const dir = opts.dir || process.cwd();
  console.log(`Preparing development environment for target=${target} in dir=${dir}`);

  if (target === 'kubernetes') {
    // detection
    const hasKind = await checkCommand('kind');
    const hasMinikube = await checkCommand('minikube');
    const hasKubectl = await checkCommand('kubectl');

    if (opts.autoKind) {
      if (!hasKind) {
        console.log('`--auto-kind` requested but `kind` binary not found in PATH. Install kind first: https://kind.sigs.k8s.io/');
        return;
      }
      if (!opts.confirm) {
        console.log('`--auto-kind` requires `--confirm` to be set. This prevents accidental cluster creation.');
        return;
      }
      // create cluster
      const name = opts.clusterName || 'csdl-dev';
      console.log(`Creating kind cluster named ${name}...`);
      await startKindCluster(name);
      console.log('Applying generated manifests (if present) to cluster...');
      try {
        await applyManifests(dir);
      } catch (e) {
        console.error('Failed to apply manifests:', e.message);
      }
      console.log('Kind cluster created and manifests applied. To delete run: csdl dev --auto-kind --cluster-name', name, '--confirm-delete (not implemented) or use `kind delete cluster --name', name, '`');
      return;
    }

    // If not autoKind, just show detection and guidance
    if (hasKind) console.log('Detected `kind`. You can use `csdl dev --auto-kind --confirm` to create a cluser named `csdl-dev`.');
    else if (hasMinikube) console.log('Detected `minikube`. Start minikube and then use generated manifests.');
    else if (hasKubectl) console.log('Detected `kubectl`. Connect to your cluster and use generated manifests.');
    else console.log('No local kubernetes tooling detected. Install kind (https://kind.sigs.k8s.io/) or minikube.');
    return;
  } else if (target === 'nomad') {
    const hasNomad = await checkCommand('nomad');
    if (opts.autoNomad) {
      console.log('Automated nomad startup not implemented yet.');
      return;
    }
    if (hasNomad) console.log('Detected nomad. You can run `nomad agent -dev` to start a local dev agent.');
    else console.log('Nomad not detected. Install Nomad (https://www.nomadproject.io/) or run via Docker.');
    return;
  }
  console.log('Unknown target', target);
}

async function checkCommand(cmd) {
  try {
    await execa.command(`${cmd} version`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function kindStatus(name) {
  // return { installed: bool, exists: bool, clusters: string[] }
  const res = { installed: false, exists: false, clusters: [] };
  try {
    const out = await execa.command('kind get clusters', { stdio: 'pipe' });
    res.installed = true;
    const text = out.stdout || out.stderr || '';
    const clusters = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    res.clusters = clusters;
    res.exists = clusters.includes(name);
  } catch (e) {
    // kind not installed or no clusters
    res.installed = false;
  }
  return res;
}

async function nomadStatus(projectDir) {
  // check .csdl/nomad.pid and validate process is nomad
  const pidFile = path.join(projectDir || process.cwd(), '.csdl', 'nomad.pid');
  const out = { pidFileExists: false, running: false, pid: null, command: null };
  if (!await fs.pathExists(pidFile)) return out;
  out.pidFileExists = true;
  try {
    const pidRaw = await fs.readFile(pidFile, 'utf8');
    const pid = parseInt(pidRaw.trim(), 10);
    out.pid = pid;
    if (Number.isNaN(pid)) return out;
    // use ps to get command name (works on macOS/linux)
    try {
      const ps = await execa.command(`ps -p ${pid} -o comm=`, { stdio: 'pipe' });
      const cmd = (ps.stdout || '').trim();
      out.command = cmd;
      if (cmd && cmd.toLowerCase().includes('nomad')) out.running = true;
    } catch (e) {
      // ps failed / process not running
    }
  } catch (e) {
    // read error
  }
  return out;
}

async function startKindCluster(name) {
  try {
    await execa.command(`kind create cluster --name ${name}`, { stdio: 'inherit' });
  } catch (e) {
    throw new Error('kind cluster creation failed: ' + e.message);
  }
}

async function applyManifests(projectDir) {
  // look for generated manifests at <projectDir>/.csdl/generated or ./manifests
  const guess = [
    path.join(projectDir, '.csdl', 'generated'),
    path.join(projectDir, 'manifests'),
    path.join(projectDir, '.k8s')
  ];
  for (const p of guess) {
    if (await fs.pathExists(p)) {
      console.log('Applying manifests from', p);
      // kubectl apply -f <p>
      try {
        await execa.command(`kubectl apply -f ${p}`, { stdio: 'inherit' });
        return;
      } catch (e) {
        throw new Error('kubectl apply failed: ' + e.message);
      }
    }
  }
  console.log('No generated manifests found in expected locations; nothing to apply.');
}

async function destroyKindCluster(name) {
  try {
    await execa.command(`kind delete cluster --name ${name}`, { stdio: 'inherit' });
    console.log('Kind cluster', name, 'deleted');
  } catch (e) {
    throw new Error('kind cluster delete failed: ' + e.message);
  }
}

async function startNomadAgentDetached() {
  // Start nomad agent -dev in detached mode and return PID info. This will spawn a child process that continues.
  try {
    const subprocess = execa('nomad', ['agent', '-dev'], { detached: true, stdio: 'ignore' });
    // unref so the process stays after this process exits
    subprocess.unref();
    const pid = subprocess.pid;
    console.log('Started nomad agent -dev in background (detached). pid=', pid);
    // write PID to .csdl/nomad.pid in current project dir if possible
    try {
      const pidFileDir = path.join(process.cwd(), '.csdl');
      await fs.ensureDir(pidFileDir);
      await fs.writeFile(path.join(pidFileDir, 'nomad.pid'), String(pid), 'utf8');
      console.log('Wrote PID to', path.join(pidFileDir, 'nomad.pid'));
    } catch (e) {
      console.warn('Failed to write nomad.pid file:', e.message);
    }
    return { pid };
  } catch (e) {
    throw new Error('Failed to start nomad agent: ' + e.message);
  }
}

async function stopNomadAgent(projectDir) {
  const pidFile = path.join(projectDir || process.cwd(), '.csdl', 'nomad.pid');
  if (!await fs.pathExists(pidFile)) {
    return { ok: false, reason: 'pid file not found' };
  }
  try {
    const pidRaw = await fs.readFile(pidFile, 'utf8');
    const pid = parseInt(pidRaw.trim(), 10);
    if (Number.isNaN(pid)) return { ok: false, reason: 'invalid pid in pidfile' };
    // verify the pid belongs to nomad before killing
    try {
      // Check both comm and args for 'nomad'
      const psComm = await execa.command(`ps -p ${pid} -o comm=`, { stdio: 'pipe' });
      const comm = (psComm.stdout || '').trim();
      const psArgs = await execa.command(`ps -p ${pid} -o args=`, { stdio: 'pipe' });
      const args = (psArgs.stdout || '').trim();
      if (!comm.toLowerCase().includes('nomad') && !args.toLowerCase().includes('nomad')) {
        return { ok: false, reason: `process ${pid} command is '${comm}', args '${args}', not nomad` };
      }
    } catch (e) {
      return { ok: false, reason: 'process not running' };
    }
    process.kill(pid, 'SIGTERM');
    await fs.remove(pidFile);
    return { ok: true, pid };
async function kindStatus(name) {
  // return { installed: bool, exists: bool, clusters: string[], nodes: [], images: [] }
  const res = { installed: false, exists: false, clusters: [], nodes: [], images: [] };
  try {
    const out = await execa.command('kind get clusters', { stdio: 'pipe' });
    res.installed = true;
    const text = out.stdout || out.stderr || '';
    const clusters = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    res.clusters = clusters;
    res.exists = clusters.includes(name);
    if (res.exists) {
      // Try to get nodes and images for this cluster
      try {
        const nodesOut = await execa.command(`kind get nodes --name ${name}`, { stdio: 'pipe' });
        res.nodes = (nodesOut.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      } catch {}
      try {
        // Try to get images from one node (if kubectl available)
        const kubectlOk = await checkCommand('kubectl');
        if (kubectlOk) {
          const imgOut = await execa.command(`kubectl get pods -A -o jsonpath='{.items[*].spec.containers[*].image}'`, { stdio: 'pipe' });
          res.images = (imgOut.stdout || '').replace(/'/g, '').split(/\s+/).filter(Boolean);
        }
      } catch {}
    }
  } catch (e) {
    res.installed = false;
  }
  return res;
}
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function deployLambda(opts = {}) {
  // opts: { dir, deploy, confirm }
  const dir = opts.dir || process.cwd();
  const generated = path.join(dir, '.csdl', 'generated', 'lambda');
  if (!await fs.pathExists(generated)) {
    console.log('Lambda artifacts not found at', generated, '; run `csdl generate` first.');
    return;
  }
  if (!opts.deploy) {
    console.log('Lambda serverless.yml generated at', path.join(generated, 'serverless.yml'));
    console.log('To deploy, install serverless framework (`npm i -g serverless`) and run:');
    console.log(`  sls deploy --stage dev`);
    return;
  }
  if (!opts.confirm) {
    console.log('`--deploy` requires `--confirm` to run cloud-deploying actions.');
    return;
  }
  // run sls deploy if available
  try {
    await execa.command('sls --version', { stdio: 'inherit' });
  } catch (e) {
    throw new Error('serverless (sls) CLI not found in PATH; install it to deploy');
  }
  try {
    await execa.command('sls deploy', { cwd: generated, stdio: 'inherit' });
    console.log('Lambda deployed (serverless CLI finished)');
  } catch (e) {
    throw new Error('sls deploy failed: ' + e.message);
  }
}

module.exports = { initProject, generateFromYaml, generateCI, runDevCluster };
module.exports.deployLambda = deployLambda;
module.exports.startNomadAgentDetached = startNomadAgentDetached;
module.exports.stopNomadAgent = stopNomadAgent;
module.exports.destroyKindCluster = destroyKindCluster;
module.exports.startKindCluster = startKindCluster;
module.exports.kindStatus = kindStatus;
module.exports.nomadStatus = nomadStatus;
