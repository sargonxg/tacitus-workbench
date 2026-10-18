import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {hash} from '../src/collection/strict-data.mjs';
export async function entries(root){const result=[];async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isDirectory())await walk(file);else{const raw=new Uint8Array(await readFile(file));result.push({path:relative(root,file).split('\\').join('/'),file:{size:raw.length,arrayBuffer:async()=>raw.slice().buffer}});}}}await walk(root);return result;}
export async function expected(root){return hash(new Uint8Array(await readFile(join(root,'manifest.json'))));}
