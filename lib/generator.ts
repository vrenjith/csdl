import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import mustache from 'mustache';
import execa from 'execa';

export async function initProject(dir: string) {
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

export async function generateFromYaml(serviceYamlPath: string, outDir: string) {
  if (!await fs.pathExists(serviceYamlPath)) throw new Error('service.yaml not found: ' + serviceYamlPath);
  const content = await fs.readFile(serviceYamlPath, 'utf8');
  const doc = yaml.load(content) as any;
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

function renderTemplate(name: string, view: any) {
  const tplPath = path.join(__dirname, '..', 'templates', name);
  if (!fs.existsSync(tplPath)) throw new Error('template not found: ' + name);
  const tpl = fs.readFileSync(tplPath, 'utf8');
  return mustache.render(tpl, view || {});
}

export async function generateCI(dir: string) {
  const out = path.join(dir, '.csdl', 'ci');
  await fs.ensureDir(out);
  const gha = fs.readFileSync(path.join(__dirname, '..', 'templates', 'github-workflow.yml.mustache'), 'utf8');
  await fs.writeFile(path.join(out, 'github-actions.yml'), gha, 'utf8');
  const jenkins = fs.readFileSync(path.join(__dirname, '..', 'templates', 'jenkinsfile.mustache'), 'utf8');
  await fs.writeFile(path.join(out, 'Jenkinsfile'), jenkins, 'utf8');
}

export async function runDevCluster(opts: any) {
  // ...existing code...
}

export async function checkCommand(cmd: string) {
  try {
    await execa.command(`${cmd} version`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

export async function startKindCluster(name: string) {
  try {
    await execa.command(`kind create cluster --name ${name}`, { stdio: 'inherit' });
  } catch (e: any) {
    throw new Error('kind cluster creation failed: ' + e.message);
  }
}

export async function destroyKindCluster(name: string) {
  try {
    await execa.command(`kind delete cluster --name ${name}`, { stdio: 'inherit' });
    console.log('Kind cluster', name, 'deleted');
  } catch (e: any) {
    throw new Error('kind cluster delete failed: ' + e.message);
  }
}

export async function startNomadAgentDetached() {
  // ...existing code...
}

export async function stopNomadAgent(projectDir: string) {
  // ...existing code...
}

export async function deployLambda(opts: any) {
  // ...existing code...
}

export async function kindStatus(name: string) {
  // ...existing code...
}

export async function nomadStatus(projectDir: string) {
  // ...existing code...
}
