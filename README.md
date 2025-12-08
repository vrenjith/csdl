# CSDL — Cross Service Deployment Language (prototype)

This repository contains an initial scaffold for `csdl`, a CLI that helps you author a higher-level YAML definition of a service and generate deployment artifacts for Kubernetes, Nomad, and CI pipelines.

What this scaffold provides:
- `csdl init` — creates `service.yaml` example and copies templates into `.csdl/`
- `csdl generate` — reads `service.yaml` and generates Kubernetes and Nomad manifests, devcontainer.json, and CI templates into a target output directory
- `csdl dev` — best-effort helper that detects local cluster tools and prints instructions
- `csdl ci` — generate CI pipeline files into `.csdl/ci`

This is an initial, executable JavaScript scaffold. It focuses on generating files so you can commit them to your repo and wire them into your CI/CD.

Quick start (local):

1. Install dependencies:

```bash
cd /path/to/repo
npm install
```

2. Make the CLI executable and try init:

```bash
node ./bin/csdl.js init myservice
cd myservice
cat service.yaml

Dev orchestration (safe)

csdl can detect local tooling or (optionally) create a Kind cluster and apply generated manifests. This is intentionally gated behind flags to avoid changing a user's system without consent.

Examples:

```bash
# detect and print guidance
node ./bin/csdl.js dev . -t kubernetes

# create a local kind cluster named `csdl-dev` and apply generated manifests (requires `kind` and `kubectl` in PATH)
node ./bin/csdl.js dev . --auto-kind --confirm --cluster-name csdl-dev
```
node ../bin/csdl.js generate -o .csdl/generated
ls .csdl/generated
```

## Explicit kind and nomad commands

You can also manage kind and nomad directly with explicit commands that make lifecycle operations clearer and safer.

```bash
# kind create (requires kind installed)
node ./bin/csdl.js kind create --name csdl-dev --confirm

# kind delete
node ./bin/csdl.js kind delete --name csdl-dev --confirm

# nomad start (detached)
node ./bin/csdl.js nomad start --confirm

# nomad stop (reads PID from .csdl/nomad.pid)
node ./bin/csdl.js nomad stop --confirm
```

Publishing as an npm package:
- Update `package.json` (name, version, author)
- Run `npm publish --access public` (or set up org/private as needed)

Next steps / roadmap:
- Convert to TypeScript and add tests
- Implement richer templates with CRDs and zero-config runtime decisions
- Implement dev orchestration to start kind/minikube/nomad automatically
- Add AWS Lambda generator

Contributions welcome.
