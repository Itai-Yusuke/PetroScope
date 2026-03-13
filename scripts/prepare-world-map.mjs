import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('node_modules', 'sane-topojson', 'dist', 'world_110m.json');
const targetDir = path.resolve('public', 'map');
const target = path.join(targetDir, 'world-countries.topo.json');

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);

const copied = JSON.parse(await readFile(target, 'utf8'));
if (!copied.objects?.countries) {
  throw new Error('コピーした TopoJSON に countries レイヤーがありません。');
}

console.log(`Prepared ${target}`);
