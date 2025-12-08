"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const gen = __importStar(require("./generator"));
function main() {
    const program = new commander_1.Command();
    program.name('csdl').description('CSDL — Cross Service Deployment Language CLI').version('0.1.0');
    program
        .command('init [dir]')
        .description('Initialize a new csdl project (creates service.yaml and .csdl/ folder)')
        .action(async (dir = '.') => {
        try {
            await gen.initProject(path.resolve(dir));
            console.log('Initialized csdl project in', dir);
        }
        catch (err) {
            console.error('init failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('generate [dir]')
        .description('Generate deployment artifacts (k8s, nomad, ci) from service.yaml')
        .option('-o, --out <outdir>', 'output directory for generated files', '.csdl/generated')
        .action(async (dir = '.', opts) => {
        try {
            const out = path.resolve(opts.out);
            await gen.generateFromYaml(path.resolve(dir, 'service.yaml'), out);
            console.log('Generated artifacts in', out);
        }
        catch (err) {
            console.error('generate failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('dev [dir]')
        .description('Bring up development environment (detect or optionally start a local cluster)')
        .option('-t, --target <target>', 'target runtime: kubernetes|nomad', 'kubernetes')
        .option('--auto-kind', 'If set, attempt to create a local kind cluster (requires kind installed)')
        .option('--cluster-name <name>', 'Cluster name to create/use for kind', 'csdl-dev')
        .option('--confirm', 'Confirm any destructive or system-changing operations (required to auto-create/delete clusters)')
        .option('--destroy', 'If set with --auto-kind and --confirm, destroy the kind cluster named --cluster-name')
        .option('--auto-nomad', 'If set, attempt to start a local nomad agent (requires nomad installed)')
        .action(async (dir = '.', opts) => {
        try {
            await gen.runDevCluster({ target: opts.target, dir: path.resolve(dir), autoKind: !!opts.autoKind, clusterName: opts.clusterName, confirm: !!opts.confirm, destroy: !!opts.destroy, autoNomad: !!opts.autoNomad });
        }
        catch (err) {
            console.error('dev failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('deploy-lambda [dir]')
        .description('Generate lambda serverless.yml and optionally deploy using Serverless framework')
        .option('--deploy', 'If set, attempt to run `sls deploy` (serverless CLI)')
        .option('--confirm', 'Confirm any cloud-deploying operations')
        .action(async (dir = '.', opts) => {
        try {
            await gen.generateFromYaml(path.resolve(dir, 'service.yaml'), path.resolve(dir, '.csdl', 'generated'));
            await gen.deployLambda({ dir: path.resolve(dir), deploy: !!opts.deploy, confirm: !!opts.confirm });
        }
        catch (err) {
            console.error('deploy-lambda failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('kind <action>')
        .description('Manage local kind clusters: create|delete')
        .option('--name <name>', 'Cluster name', 'csdl-dev')
        .option('--confirm', 'Confirm destructive/cluster-changing operations')
        .action(async (action, opts) => {
        try {
            const name = opts.name || 'csdl-dev';
            if (action === 'create') {
                if (!opts.confirm)
                    return console.log('Use --confirm to actually create the cluster');
                await gen.startKindCluster(name);
                console.log('Kind cluster created:', name);
            }
            else if (action === 'delete') {
                if (!opts.confirm)
                    return console.log('Use --confirm to actually delete the cluster');
                await gen.destroyKindCluster(name);
                console.log('Kind cluster deleted:', name);
            }
            else {
                console.log('Unknown action', action);
            }
        }
        catch (err) {
            console.error('kind command failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('kind-status [name]')
        .description('Check status of kind clusters (if name provided, checks existence)')
        .action(async (name = 'csdl-dev') => {
        try {
            const s = await gen.kindStatus(name);
            console.log(`Kind installed: ${s.installed}`);
            console.log(`Clusters: ${s.clusters.join(', ') || '(none)'}`);
            console.log(`Cluster '${name}' exists: ${s.exists}`);
            if (s.exists) {
                console.log(`Nodes: ${s.nodes.join(', ') || '(none)'}`);
                console.log(`Images: ${s.images.join(', ') || '(none)'}`);
            }
        }
        catch (err) {
            console.error('kind-status failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('kind status [name]')
        .description('Alias for kind-status')
        .action(async (name = 'csdl-dev') => {
        try {
            const s = await gen.kindStatus(name);
            console.log(`Kind installed: ${s.installed}`);
            console.log(`Clusters: ${s.clusters.join(', ') || '(none)'}`);
            console.log(`Cluster '${name}' exists: ${s.exists}`);
            if (s.exists) {
                console.log(`Nodes: ${s.nodes.join(', ') || '(none)'}`);
                console.log(`Images: ${s.images.join(', ') || '(none)'}`);
            }
        }
        catch (err) {
            console.error('kind status failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('nomad <action>')
        .description('Manage local nomad dev agent: start|stop')
        .option('--confirm', 'Confirm actions')
        .action(async (action, opts) => {
        try {
            if (action === 'start') {
                if (!opts.confirm)
                    return console.log('Use --confirm to actually start the nomad agent');
                const info = await gen.startNomadAgentDetached();
                console.log('Nomad started, pid:', info && info.pid);
            }
            else if (action === 'stop') {
                if (!opts.confirm)
                    return console.log('Use --confirm to actually stop the nomad agent');
                const stopped = await gen.stopNomadAgent(process.cwd());
                console.log('Nomad stop result:', stopped);
            }
            else {
                console.log('Unknown action', action);
            }
        }
        catch (err) {
            console.error('nomad command failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('nomad-status')
        .description('Check status of nomad agent based on .csdl/nomad.pid')
        .action(async () => {
        try {
            const s = await gen.nomadStatus(process.cwd());
            console.log(`Nomad pid file present: ${s.pidFileExists}`);
            if (s.pidFileExists) {
                console.log(`PID: ${s.pid}`);
                console.log(`Command: ${s.command || '(unknown)'}`);
                console.log(`Running and appears to be nomad: ${s.running}`);
            }
        }
        catch (err) {
            console.error('nomad-status failed:', err.message);
            process.exitCode = 2;
        }
    });
    program
        .command('nomad status')
        .description('Alias for nomad-status')
        .action(async () => {
        try {
            const s = await gen.nomadStatus(process.cwd());
            console.log(`Nomad pid file present: ${s.pidFileExists}`);
            if (s.pidFileExists) {
                console.log(`PID: ${s.pid}`);
                console.log(`Command: ${s.command || '(unknown)'}`);
                console.log(`Running and appears to be nomad: ${s.running}`);
            }
        }
        catch (err) {
            console.error('nomad status failed:', err.message);
            process.exitCode = 2;
        }
    });
    program.parse(process.argv);
}
if (require.main === module) {
    main();
}
exports.default = main;
