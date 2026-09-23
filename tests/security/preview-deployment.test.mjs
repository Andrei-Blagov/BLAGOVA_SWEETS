import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const compose = readFileSync('docker-compose.preview.yml', 'utf8');
const nginx = readFileSync('deploy/nginx.conf', 'utf8');
const caddy = readFileSync('deploy/Caddyfile.preview', 'utf8');
const config = readFileSync('nuxt.config.ts', 'utf8');
const robots = readFileSync('public/robots.txt', 'utf8');

test('preview deployment is gated by verified branch CI and GitHub Environment', () => {
  assert.match(workflow, /deploy-preview:[\s\S]*needs: verify/);
  assert.match(workflow, /vars\.PREVIEW_DEPLOY_ENABLED == 'true'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/prototype\/pattaya-atelier'/);
  assert.match(workflow, /github\.event_name == 'push'.*github\.event_name == 'workflow_dispatch'.*inputs\.preview_operation == 'deploy'/s);
  assert.match(workflow, /environment:[\s\S]*name: preview/);
  assert.doesNotMatch(workflow, /if:[^\n]*pull_request/);
});

test('preview audit is read-only, branch-scoped and follows verification', () => {
  assert.match(workflow, /preview_operation:[\s\S]*- deploy[\s\S]*- audit/);
  assert.match(workflow, /audit-preview:[\s\S]*needs: verify/);
  assert.match(workflow, /audit-preview:[\s\S]*inputs\.preview_operation == 'audit'/);
  assert.match(workflow, /audit-preview:[\s\S]*github\.event\.head_commit\.message, '\[preview-audit\]'/);
  assert.match(workflow, /audit-preview:[\s\S]*github\.ref == 'refs\/heads\/prototype\/pattaya-atelier'/);
  const auditStart = workflow.indexOf('  audit-preview:');
  const deployStart = workflow.indexOf('  deploy-preview:');
  const auditJob = workflow.slice(auditStart, deployStart);
  assert.match(auditJob, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(auditJob, /docker (?:compose )?(?:up|down|restart|stop|rm)|caddy reload|\brm\s+-/);
});

test('preview SSH verifies known_hosts and keeps credentials out of checkout', () => {
  const deployStart = workflow.indexOf('  deploy-preview:');
  const deploySteps = workflow.indexOf('    steps:', deployStart);
  assert.doesNotMatch(workflow.slice(deployStart, deploySteps), /secrets\./, 'secrets must be scoped to the steps that need them');
  assert.match(workflow, /PREVIEW_SSH_KNOWN_HOSTS: \$\{\{ secrets\.PREVIEW_SSH_KNOWN_HOSTS \}\}/);
  assert.match(workflow, /StrictHostKeyChecking=yes/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /ssh-keyscan/);
});

test('preview container is isolated, read-only and has no public host port', () => {
  assert.match(compose, /^name:/m);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(compose, /^\s*ports:/m);
  assert.match(compose, /external: true/);
});

test('all three anti-indexing layers are present', () => {
  assert.match(robots, /Disallow: \//);
  assert.match(config, /noindex, nofollow/);
  assert.match(nginx, /X-Robots-Tag "noindex, nofollow, noarchive, nosnippet"/);
  assert.match(caddy, /X-Robots-Tag "noindex, nofollow, noarchive, nosnippet"/);
});

test('every browser-facing Edge Function allows preview with a bodyless 204 preflight', () => {
  for (const name of ['storefront-order', 'storefront-chat', 'storefront-availability', 'confirm-order', 'order-change']) {
    const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
    assert.match(source, /https:\/\/preview\.blagovasweets\.com/, `${name} misses preview origin`);
    assert.match(source, /new Response\(null,[\s\S]{0,180}status:\s*204|status:\s*204[\s\S]{0,180}new Response\(null/, `${name} preflight must be bodyless`);
  }
});
