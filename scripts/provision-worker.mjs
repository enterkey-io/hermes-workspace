// Operator-only provisioning helper. Writes a verifier, never the setup code, into SQL.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const directory = resolve(process.argv[2] ?? '.local/owner');
const proof = (await readFile(resolve(directory, 'setup-code.txt'), 'utf8')).trim();
if (!/^[A-Za-z0-9_-]{43}$/.test(proof)) throw new Error('Initialize owner settings first');
const hash = createHash('sha256').update(proof).digest('hex');
await writeFile(
  resolve(directory, 'bootstrap.sql'),
  `INSERT INTO owner_setup(id,value,expires) SELECT 1,'${hash}',${Date.now() + 86400000} WHERE NOT EXISTS(SELECT 1 FROM owner_claim) AND NOT EXISTS(SELECT 1 FROM owner_setup);\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Private Worker bootstrap SQL prepared. Keep settings.json and setup-code.txt private.',
);
