import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

// Never print or silently rotate a signing key. Keep all existing env values.
const path = existsSync('.env.local') ? '.env.local' : existsSync('.env') ? '.env' : '.env.local';
const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (parse(content).JWT_SECRET) {
  console.log('JWT_SECRET is already configured; no values changed.');
} else {
  const withoutEmptyKey = content.replace(/^\s*JWT_SECRET\s*=.*(?:\r?\n|$)/gm, '');
  writeFileSync(path, `${withoutEmptyKey.trimEnd()}\nJWT_SECRET=${randomBytes(48).toString('base64url')}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(`Generated JWT_SECRET in ignored ${path}; secret value was not printed.`);
}
