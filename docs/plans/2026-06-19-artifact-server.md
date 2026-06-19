# Artifact Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a private local artifact server to store and serve Hermes-generated files from the VPS without depending on Supabase Storage.

**Architecture:** A new `services/artifact-server` Node service stores uploaded bytes in a local Docker-mounted data directory, with a `5368709120` byte (5 GiB) ceiling per individual artifact upload and no app-level total storage quota. Bridge will later upload generated outputs with an internal bearer key and request short-lived signed access links for authenticated users. Public browser access is only allowed through those signed links.

**Tech Stack:** Node 20 ESM, built-in `node:http`, `node:fs/promises`, `node:crypto`, Docker Compose, Traefik labels.

---

### Task 1: Artifact Server Contract Tests

**Files:**
- Create: `services/artifact-server/test/artifact-server.test.js`

**Steps:**
1. Write tests for health, internal raw upload, signed access links, owner mismatch, missing token, and persisted bytes.
2. Run `node --test services/artifact-server/test/artifact-server.test.js`.
3. Expected RED: test runner fails because `services/artifact-server/src/server.js` does not exist yet.

### Task 2: Minimal Server Implementation

**Files:**
- Create: `services/artifact-server/src/server.js`
- Create: `services/artifact-server/package.json`
- Create: `services/artifact-server/.dockerignore`

**Steps:**
1. Implement `createArtifactServer(config)` and executable startup.
2. Store object bytes under `objects/<sha-prefix>/<sha256>`.
3. Store metadata JSON under `metadata/<artifact-id>.json`.
4. Generate and verify HMAC access tokens.
5. Run the artifact server tests until green.

### Task 3: Container And Compose

**Files:**
- Create: `services/artifact-server/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`

**Steps:**
1. Add artifact-server Dockerfile.
2. Add `artifact-server` service to the unified compose file using `./data/artifacts:/app/data`.
3. Add Traefik route for `arquivos.solucoes-nexus.tech`.
4. Add environment variables for internal key, token secret, public base URL, and upload limit.

### Task 4: Documentation And Verification

**Files:**
- Modify: `docs/vps-deploy.md`
- Modify: `docs/env-map.md`

**Steps:**
1. Document the local artifact server and security model.
2. Run `node --test services/artifact-server/test/artifact-server.test.js`.
3. Run `npm test` inside `services/artifact-server`.
