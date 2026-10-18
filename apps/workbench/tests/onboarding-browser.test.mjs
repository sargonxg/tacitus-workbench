import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

test('onboarding guides desktop/mobile users through verified examples, downloads and local reuse',async()=>{
 const origin='http://127.0.0.1:4324';
 const env={...process.env,PORT:'4324'};let child,browser,output='';
 try{
  child=spawn(process.execPath,['server/index.mjs'],{env,stdio:'pipe'});child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch(origin+'/api/status')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready,output);
  browser=await chromium.launch({headless:true,...(process.env.TACITUS_TEST_BROWSER?{executablePath:process.env.TACITUS_TEST_BROWSER}:{})});
  const facts=JSON.parse(await readFile('public/examples/onboarding-facts.json','utf8'));const expected=await readFile('public/examples/peace.context.json','utf8');
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);const guide=page.getByRole('region',{name:'Build context you can trace back to evidence'});await guide.getByRole('heading',{name:`${facts.collection.records} source records`,exact:true}).waitFor();
   const content=await guide.innerText();assert.ok(content.includes(`${facts.collection.publisher_records} FRUS publisher records and ${facts.collection.retrospective_sections} retrospective memoir sections`));
   for(const key of ['july','expanded'])assert.ok(content.includes(`${facts.capsules[key].sources} sources and ${facts.capsules[key].unreviewed_assertions} unreviewed authored assertions`));
   assert.ok(content.includes('Neither export is a generated answer'));assert.ok(content.includes('no model-account connection'));assert.ok(content.includes('conditions, exceptions and unknown dates'));
   await guide.getByRole('link',{name:'Explore the full-source index'}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'collection-search');
   for(const link of await guide.getByRole('link').all()){
    const href=await link.getAttribute('href');if(href.startsWith('/')){const response=await page.request.get(origin+href);assert.equal(response.status(),200,href);}
   }
   const runGuide=await guide.getByRole('link',{name:'Local installation and core run guide'}).getAttribute('href');assert.equal(runGuide,'https://github.com/sargonxg/tacitus-workbench/blob/d08756d059c4ff8dfcf2efc099cf318f9f14f0c8/README.md');assert.match(await readFile('../../README.md','utf8'),/npm ci --ignore-scripts/);
   const nativeDownload=page.waitForEvent('download');await guide.getByRole('link',{name:'Download July native sample'}).click();const downloaded=await nativeDownload;assert.deepEqual(await readFile(await downloaded.path()),await readFile('public'+facts.capsules.july.href));
   await guide.getByRole('button',{name:'Start recorded demo',exact:true}).click();assert.equal(await page.getByLabel('Execution mode').inputValue(),'recorded');assert.equal(await page.evaluate(()=>document.activeElement.id),'execution');await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
   const exportDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();assert.equal(await readFile(await(await exportDownload).path(),'utf8'),expected);
   await page.screenshot({path:`output/onboarding-recorded-${width}.png`,fullPage:true});
   await guide.getByRole('button',{name:'Open live-core controls',exact:true}).click();assert.equal(await page.getByLabel('Execution mode').inputValue(),'live');assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
   if(process.env.TACITUS_ACCEPTANCE==='1'){
    await page.getByLabel('Native ZIP').setInputFiles(await downloaded.path());await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
    const liveDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();assert.equal(await readFile(await(await liveDownload).path(),'utf8'),expected);
    await page.screenshot({path:`output/onboarding-live-${width}.png`,fullPage:true});
   }else assert.equal(await page.getByLabel('Native ZIP').isDisabled(),true);
   await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
   assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
  }
 }finally{await browser?.close();child?.kill();if(child&&child.exitCode===null)await new Promise(r=>child.once('exit',r));}
});
