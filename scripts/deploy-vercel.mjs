/**
 * Deploy to Vercel via the REST API (no CLI login required).
 *
 * Uploads the tracked source files as an inline-fileset deployment; Vercel
 * then runs the project's own build (npm run build -> dist) in its build
 * container, exactly like the GitLab-triggered deploys do. Production env
 * vars already live on the project, so the new build picks them up.
 *
 * Usage: VERCEL_TOKEN=... node scripts/deploy-vercel.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const TOKEN = process.env.VERCEL_TOKEN || '';
if (!TOKEN) {
  console.error('VERCEL_TOKEN env var required.');
  process.exit(1);
}

const TEAM_ID = 'team_zmMGzdIwBrpip12H3oQfMlvq';
const PROJECT_NAME = 'factory-copilot-r6xy';

// 1. Collect tracked files (git gives us the authoritative, ignore-clean set)
const files = execSync('git ls-files -z', { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter(f => fs.existsSync(f) && fs.statSync(f).isFile());

const payload = files.map(f => {
  const data = fs.readFileSync(f).toString('base64');
  return { file: f.replace(/\\/g, '/'), data, encoding: 'base64' };
});

console.log(`Uploading ${payload.length} files...`);

// 2. Create the deployment (inline fileset, production target)
const res = await fetch(
  `https://api.vercel.com/v13/deployments?teamId=${TEAM_ID}&skipAutoDetectionConfirmation=1`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: PROJECT_NAME,
      target: 'production',
      files: payload
    })
  }
);

const created = await res.json();
if (!res.ok) {
  console.error('Deploy creation failed:', JSON.stringify(created).slice(0, 600));
  process.exit(1);
}

const deploymentId = created.id;
console.log(`Deployment created: ${deploymentId} (${created.url})`);

// 3. Poll until the build finishes
const DEADLINE = Date.now() + 6 * 60 * 1000;
let final = null;
while (Date.now() < DEADLINE) {
  await new Promise(r => setTimeout(r, 8000));
  const poll = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}?teamId=${TEAM_ID}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  final = await poll.json();
  process.stdout.write(`  state: ${final.readyState}\r`);
  if (['READY', 'ERROR', 'CANCELED'].includes(final.readyState)) break;
}

console.log('');
if (final?.readyState === 'READY') {
  console.log(`READY: https://${final.url}`);
  console.log(`Inspect: ${final.inspectorUrl || `https://vercel.com/adiis-team/${PROJECT_NAME}/deployments/${deploymentId}`}`);
} else {
  console.error(`Deploy ended as ${final?.readyState || 'TIMEOUT'}`);
  const logs = final?.builds?.[0]?.logs || '';
  if (logs) console.error(String(logs).slice(-800));
  process.exit(1);
}
