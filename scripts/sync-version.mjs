import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

const tag =
  process.argv[2] ??
  (process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? '');
const version = tag.startsWith('v') ? tag.slice(1) : tag;

if (!version || version.includes('/')) {
  console.error('Usage: node scripts/sync-version.mjs <tag>');
  process.exit(1);
}

const targets = [
  resolve('package.json'),
  resolve('packages/app/package.json'),
  resolve('packages/core/package.json')
];

const updateVersion = async (filePath) => {
  const raw = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(raw);
  json.version = version;
  await fs.writeFile(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
};

await Promise.all(targets.map(updateVersion));
console.log(`Synced version to ${version}`);
