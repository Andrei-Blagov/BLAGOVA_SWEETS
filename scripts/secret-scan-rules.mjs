export const secretRules = [
  ['private key', /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['OpenAI secret key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['Resend API key', /\bre_[A-Za-z0-9]{20,}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['Stripe secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['SendGrid API key', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
];

export function blockedCredentialFile(file) {
  if (/(^|\/)\.env(?:\.[^/]+)?$/.test(file) && !file.endsWith('.env.example')) return 'tracked environment file';
  if (/(^|\/)\.dev\.vars$/.test(file)) return 'tracked Edge Function secrets file';
  if (/(^|\/)(?:\.npmrc|\.pypirc|\.netrc)$/.test(file)) return 'tracked credential configuration file';
  if (/(^|\/)(?:credentials|service-account(?:-[^/]+)?)\.json$/i.test(file)) return 'tracked credential JSON file';
  return '';
}

export function scanText(text) {
  return secretRules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}
