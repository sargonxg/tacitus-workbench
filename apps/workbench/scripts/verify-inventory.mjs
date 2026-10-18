import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,relative,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(join(root,'FILE_INVENTORY.json'),'utf8'));
const expected=new Set(manifest.files.map(file=>file.path));
for(const entry of manifest.files){
  if(entry.path.startsWith('/')||entry.path.split('/').includes('..'))throw new Error('Unsafe inventory path');
  const file=join(root,entry.path);if((await lstat(file)).isSymbolicLink())throw new Error(`Unexpected link: ${entry.path}`);
  const raw=await readFile(file);if(raw.length!==entry.bytes||createHash('sha256').update(raw).digest('hex')!==entry.sha256)throw new Error(`Inventory mismatch: ${entry.path}`);
}
async function scan(directory){for(const item of await readdir(directory,{withFileTypes:true})){
  if(['node_modules','dist','output','.git'].includes(item.name))continue;
  const path=join(directory,item.name);if(item.isSymbolicLink())throw new Error('Unexpected deliverable link');
  if(item.isDirectory())await scan(path);else{const name=relative(root,path).split(sep).join('/');if(name!=='FILE_INVENTORY.json'&&!expected.has(name))throw new Error(`Uninventoried file: ${name}`);}
}}
await scan(root);console.log(`${expected.size} deliverable files verified; inventory manifest excluded from its own hash.`);
