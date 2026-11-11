import {build} from 'vite';import{rename,mkdir,copyFile}from'node:fs/promises';
await build({configFile:'vite.policy.config.mjs',configLoader:'native'});
await rename('policy-dist/policy.html','policy-dist/index.html');
await mkdir('policy-dist/examples',{recursive:true});
await mkdir('policy-dist/icons',{recursive:true});
for(const name of ['github','linkedin'])await copyFile('public/icons/'+name+'.svg','policy-dist/icons/'+name+'.svg');
await copyFile('public/examples/syria-policy-workflow.json','policy-dist/examples/syria-policy-workflow.json');

await copyFile('public/examples/diplomatic-language-review.json','policy-dist/examples/diplomatic-language-review.json');
await mkdir('policy-dist/notices',{recursive:true});
for(const name of ['react','react-dom'])await copyFile('notices/dependencies/'+name+'-LICENSE.txt','policy-dist/notices/'+name+'-LICENSE.txt');
await copyFile('../../RIGHTS.md','policy-dist/notices/RIGHTS.md');
