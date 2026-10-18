import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
test('modern live comparison: matched evidence, refusal, immutable exports and keyboard lifecycle',async()=>{
 const origin='http://127.0.0.1:4337',enabled=process.env.TACITUS_LOCAL_INSPECTOR==='1'&&!!process.env.TACITUS_TEST_ARCHIVE;
 if(process.env.TACITUS_ACCEPTANCE==='1'){assert.equal(enabled,true,'Comparison live acceptance requires configured core/archive');for(const key of ['TACITUS_KNOWLEDGE_CAPTURE_BIN','TACITUS_KNOWLEDGE_CAPTURE_SHA256'])assert.ok(process.env[key],key);}
 const child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'4337'},stdio:['ignore','pipe','pipe']});let browser,serverOutput='';child.stdout.on('data',d=>serverOutput+=d);child.stderr.on('data',d=>serverOutput+=d);
 try{
  let ready=false;for(let i=0;i<100;i++){assert.equal(child.exitCode,null,serverOutput);if(serverOutput.includes('Local evidence inspector: '+origin+';'))try{const response=await fetch(origin+'/api/status');ready=response.ok&&(await response.json()).origin===origin;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready,serverOutput);assert.equal(child.exitCode,null,serverOutput);
  browser=await chromium.launch({headless:true,...(process.env.TACITUS_TEST_BROWSER?{executablePath:process.env.TACITUS_TEST_BROWSER}:{})});
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
   const panel=page.getByRole('region',{name:'Live checkpoint comparison'}),save=panel.getByRole('button',{name:'Save current live run as A'});assert.equal(await save.isDisabled(),true);
   if(enabled){
    await page.getByLabel('Native ZIP').setInputFiles(process.env.TACITUS_TEST_ARCHIVE);await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();
    const returned=page.waitForResponse(r=>r.url()===origin+'/api/inspect'&&r.request().postDataJSON().operation==='reuse');await page.getByRole('button',{name:'Query core',exact:true}).click();const response=await returned;assert.equal(response.headers()['x-tacitus-core-sha256'],process.env.TACITUS_KNOWLEDGE_CAPTURE_SHA256);const raw=await response.text();
    await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Save current live run as A').disabled);await save.focus();await page.keyboard.press('Enter');await panel.getByText('Run A saved.',{exact:false}).waitFor();assert.equal(await panel.getByRole('heading',{name:'Selected sources'}).count(),0);assert.equal(await panel.getByText('Run B request and core identity',{exact:true}).count(),0);const savedDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'Export saved run A exact Context JSON'}).click();assert.equal(await readFile(await(await savedDownload).path(),'utf8'),raw);
    await page.getByLabel('Known as of').fill('1792328101');await page.getByRole('button',{name:'Query core',exact:true}).click();await panel.getByRole('heading',{name:'Selected claims and exact evidence'}).waitFor();
    const claim=panel.locator('details').filter({has:page.locator('summary').filter({hasText:/bryan-july28-inquiry:/})}).first();await claim.locator('summary').first().focus();await page.keyboard.press('Enter');assert.match(await claim.innerText(),/Interrogative and hypothetical/);assert.match(await claim.innerText(),/UNKNOWN world validity/);assert.ok(await claim.getByRole('link',{name:'Open cited source'}).count()>0);
    await page.getByLabel('Known as of').fill('1792328100');await page.getByRole('button',{name:'Query core',exact:true}).click();await panel.getByRole('heading',{name:'Selected sources'}).waitFor();
    const dl=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();assert.equal(await readFile(await(await dl).path(),'utf8'),raw);
    await page.getByLabel('Maximum output bytes').fill('65535');await page.getByRole('button',{name:'Query core',exact:true}).click();await panel.getByText(/Comparison unavailable: Unmatched max_bytes/).waitFor();
    await page.getByLabel('Maximum output bytes').fill('65536');await page.getByLabel('Known as of').fill('1');const refused=page.waitForResponse(r=>r.url()===origin+'/api/inspect');await page.getByRole('button',{name:'Query core',exact:true}).click();const refusal=await refused;assert.equal(refusal.status(),422);assert.equal(refusal.headers()['x-tacitus-core-sha256'],process.env.TACITUS_KNOWLEDGE_CAPTURE_SHA256);await panel.getByText(/No evidence-set difference is inferred/).waitFor();assert.equal(await panel.getByRole('heading',{name:'Selected sources'}).count(),0);assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
    for(const staleError of [false,true]){
     await page.getByLabel('Known as of').fill('1792328100');
     await page.evaluate(({raw,core,staleError})=>{const original=window.fetch;window.restoreFetch=()=>{window.fetch=original;};window.fetch=(url,options)=>String(url)==='/api/inspect'&&JSON.parse(options.body).operation==='reuse'?new Promise(resolve=>{window.releaseLate=()=>resolve(new Response(staleError?JSON.stringify({error:'unknown_validity'}):raw,{status:staleError?422:200,headers:{'Content-Type':'application/json','X-Tacitus-Core-SHA256':core}}));}):original(url,options);},{raw,core:process.env.TACITUS_KNOWLEDGE_CAPTURE_SHA256,staleError});
     await page.getByRole('button',{name:'Query core',exact:true}).click();await page.waitForFunction(()=>typeof window.releaseLate==='function');await page.getByRole('button',{name:'Cancel',exact:true}).focus();await page.keyboard.press('Enter');if(staleError)await page.getByLabel('Known as of').fill('1792328102');
     await page.evaluate(()=>{window.releaseLate();window.restoreFetch();delete window.releaseLate;});await page.waitForTimeout(60);assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);assert.equal(await panel.getByRole('heading',{name:'Selected sources'}).count(),0);assert.equal(await panel.getByText(/Run B refused:/).count(),0);
    }
    await page.getByRole('button',{name:'Reset',exact:true}).focus();await page.keyboard.press('Enter');await panel.getByText('No run A saved.',{exact:false}).waitFor();
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.getByLabel('Execution mode').selectOption('recorded');assert.equal(await panel.count(),0);await context.close();
  }
 }finally{await browser?.close();child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
});
