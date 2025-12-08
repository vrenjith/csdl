const { Command } = require('commander');
const path = require('path');
const gen = require('./generator');

module.exports = function () {
  const program = new Command();
  program.name('csdl').description('CSDL — Cross Service Deployment Language CLI').version('0.1.0');

  program
    .command('init [dir]')
    .description('Initialize a new csdl project (creates service.yaml and .csdl/ folder)')
    .action(async (dir = '.') => {
      try {
        await gen.initProject(path.resolve(dir));
        console.log('Initialized csdl project in', dir);
      } catch (err) {
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
      } catch (err) {
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
      } catch (err) {
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
      } catch (err) {
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
          if (!opts.confirm) return console.log('Use --confirm to actually create the cluster');
          await gen.startKindCluster(name);
          console.log('Kind cluster created:', name);
        } else if (action === 'delete') {
          if (!opts.confirm) return console.log('Use --confirm to actually delete the cluster');
          await gen.destroyKindCluster(name);
          console.log('Kind cluster deleted:', name);
        } else {
          console.log('Unknown action', action);
        }
      } catch (err) {
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
      } catch (err) {
        console.error('kind-status failed:', err.message);
        process.exitCode = 2;
      }
    });

  // alias: kind status
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
      } catch (err) {
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
          if (!opts.confirm) return console.log('Use --confirm to actually start the nomad agent');
          const info = await gen.startNomadAgentDetached();
          console.log('Nomad started, pid:', info && info.pid);
        } else if (action === 'stop') {
          if (!opts.confirm) return console.log('Use --confirm to actually stop the nomad agent');
          const stopped = await gen.stopNomadAgent(process.cwd());
          console.log('Nomad stop result:', stopped);
        } else {
          console.log('Unknown action', action);
        }
      } catch (err) {
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
      } catch (err) {
        console.error('nomad-status failed:', err.message);
        process.exitCode = 2;
      }
    });

  // alias: nomad status
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
      } catch (err) {
        console.error('nomad status failed:', err.message);
        process.exitCode = 2;
      }
    });

  program
    .command('ci [dir]')
    .description('Generate CI pipeline files (GitHub Actions and Jenkinsfile)')
    .action(async (dir = '.') => {
      try {
        await gen.generateCI(path.resolve(dir));
        console.log('CI pipeline files generated (./.csdl/ci)');
      } catch (err) {
        console.error('ci failed:', err.message);
        process.exitCode = 2;
      }
    });

  program.parse(process.argv);
};
