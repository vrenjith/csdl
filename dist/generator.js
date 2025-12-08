"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initProject = initProject;
exports.generateFromYaml = generateFromYaml;
exports.generateCI = generateCI;
exports.runDevCluster = runDevCluster;
exports.checkCommand = checkCommand;
exports.startKindCluster = startKindCluster;
exports.destroyKindCluster = destroyKindCluster;
exports.startNomadAgentDetached = startNomadAgentDetached;
exports.stopNomadAgent = stopNomadAgent;
exports.deployLambda = deployLambda;
exports.kindStatus = kindStatus;
exports.nomadStatus = nomadStatus;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const mustache_1 = __importDefault(require("mustache"));
const execa_1 = __importDefault(require("execa"));
async function initProject(dir) {
    await fs_extra_1.default.ensureDir(dir);
    const exampleYaml = await fs_extra_1.default.readFile(path_1.default.join(__dirname, '..', 'templates', 'service.example.yaml'), 'utf8');
    const serviceYamlPath = path_1.default.join(dir, 'service.yaml');
    if (await fs_extra_1.default.pathExists(serviceYamlPath)) {
        throw new Error('service.yaml already exists in ' + dir);
    }
    await fs_extra_1.default.writeFile(serviceYamlPath, exampleYaml, 'utf8');
    await fs_extra_1.default.ensureDir(path_1.default.join(dir, '.csdl'));
    await fs_extra_1.default.copy(path_1.default.join(__dirname, '..', 'templates'), path_1.default.join(dir, '.csdl', 'templates'));
}
async function generateFromYaml(serviceYamlPath, outDir) {
    if (!await fs_extra_1.default.pathExists(serviceYamlPath))
        throw new Error('service.yaml not found: ' + serviceYamlPath);
    const content = await fs_extra_1.default.readFile(serviceYamlPath, 'utf8');
    const doc = js_yaml_1.default.load(content);
    await fs_extra_1.default.ensureDir(outDir);
    // generate k8s
    const k8s = renderTemplate('k8s-deployment.yaml.mustache', doc);
    await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'k8s-deployment.yaml'), k8s, 'utf8');
    // generate nomad
    const nomad = renderTemplate('nomad-job.hcl.mustache', doc);
    await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'nomad-job.hcl'), nomad, 'utf8');
    // generate devcontainer
    const devc = renderTemplate('devcontainer.json.mustache', doc);
    await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'devcontainer.json'), devc, 'utf8');
    // generate CI
    const gha = renderTemplate('github-workflow.yml.mustache', doc);
    await fs_extra_1.default.ensureDir(path_1.default.join(outDir, 'ci'));
    await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'ci', 'github-actions.yml'), gha, 'utf8');
    const jenkins = renderTemplate('jenkinsfile.mustache', doc);
    await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'ci', 'Jenkinsfile'), jenkins, 'utf8');
    // generate AWS Lambda serverless template
    try {
        const lambda = renderTemplate('aws-lambda-serverless.yml.mustache', doc);
        await fs_extra_1.default.ensureDir(path_1.default.join(outDir, 'lambda'));
        await fs_extra_1.default.writeFile(path_1.default.join(outDir, 'lambda', 'serverless.yml'), lambda, 'utf8');
    }
    catch (e) {
        // if template missing, ignore
    }
}
function renderTemplate(name, view) {
    const tplPath = path_1.default.join(__dirname, '..', 'templates', name);
    if (!fs_extra_1.default.existsSync(tplPath))
        throw new Error('template not found: ' + name);
    const tpl = fs_extra_1.default.readFileSync(tplPath, 'utf8');
    return mustache_1.default.render(tpl, view || {});
}
async function generateCI(dir) {
    const out = path_1.default.join(dir, '.csdl', 'ci');
    await fs_extra_1.default.ensureDir(out);
    const gha = fs_extra_1.default.readFileSync(path_1.default.join(__dirname, '..', 'templates', 'github-workflow.yml.mustache'), 'utf8');
    await fs_extra_1.default.writeFile(path_1.default.join(out, 'github-actions.yml'), gha, 'utf8');
    const jenkins = fs_extra_1.default.readFileSync(path_1.default.join(__dirname, '..', 'templates', 'jenkinsfile.mustache'), 'utf8');
    await fs_extra_1.default.writeFile(path_1.default.join(out, 'Jenkinsfile'), jenkins, 'utf8');
}
async function runDevCluster(opts) {
    // ...existing code...
}
async function checkCommand(cmd) {
    try {
        await execa_1.default.command(`${cmd} version`, { stdio: 'ignore' });
        return true;
    }
    catch (e) {
        return false;
    }
}
async function startKindCluster(name) {
    try {
        await execa_1.default.command(`kind create cluster --name ${name}`, { stdio: 'inherit' });
    }
    catch (e) {
        throw new Error('kind cluster creation failed: ' + e.message);
    }
}
async function destroyKindCluster(name) {
    try {
        await execa_1.default.command(`kind delete cluster --name ${name}`, { stdio: 'inherit' });
        console.log('Kind cluster', name, 'deleted');
    }
    catch (e) {
        throw new Error('kind cluster delete failed: ' + e.message);
    }
}
async function startNomadAgentDetached() {
    // ...existing code...
}
async function stopNomadAgent(projectDir) {
    // ...existing code...
}
async function deployLambda(opts) {
    // ...existing code...
}
async function kindStatus(name) {
    // ...existing code...
}
async function nomadStatus(projectDir) {
    // ...existing code...
}
