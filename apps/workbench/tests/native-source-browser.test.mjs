import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
test('native evidence links and visible omission-only status preserve exact exports on desktop/mobile',async()=>{
 const origin='http://127.0.0.1:4340',server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'4340'},stdio:'ignore'});let browser;
 try{
  let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch(origin+'/api/status')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
  browser=await chromium.launch({headless:true,...(process.env.TACITUS_TEST_BROWSER?{executablePath:process.env.TACITUS_TEST_BROWSER}:{})});
  const recorded=await readFile('public/examples/peace.context.json','utf8'),context=JSON.parse(recorded),layer=Object.values(context.context.claims)[0];
  for(const width of[1440,390]){
   const session=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true}),page=await session.newPage();await page.goto(origin);await page.getByRole('button',{name:'Start recorded demo',exact:true}).click();const result=page.getByRole('region',{name:'Returned Context'});await result.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
   await result.locator('li button').filter({hasText:layer.assertion.proposition.slice(0,90)}).first().click();const inspector=result.locator('aside');assert.deepEqual(await inspector.locator('blockquote').allTextContents(),layer.citations.map(c=>c.text));
   for(const link of await inspector.getByRole('link',{name:/Open original source/}).all()){assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener noreferrer');}
   assert.ok(await inspector.getByRole('link',{name:/Open original source/}).count()>0);await result.getByRole('status').filter({hasText:'selected assertions'}).getByText(`${Object.keys(context.context.claims).length} selected assertions; ${Object.keys(context.context.omissions).length} omitted assertions.`,{exact:false}).waitFor();
   if(process.env.TACITUS_LOCAL_INSPECTOR==='1'){
    await page.getByLabel('Execution mode').selectOption('live');await page.getByLabel('Native ZIP').setInputFiles('public/examples/expanded-cases.native-v2.zip');await page.getByLabel('Question',{exact:true}).fill('relief assurance');await page.getByLabel('Known as of').fill('1792332960');await page.getByLabel('Valid at').fill('1792332960');await page.getByLabel('Maximum output bytes').fill('20000');await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();
    const response=page.waitForResponse(r=>r.url()===origin+'/api/inspect'&&r.request().postDataJSON().operation==='reuse');await page.getByRole('button',{name:'Query core',exact:true}).click();const raw=await(await response).text(),out=JSON.parse(raw);assert.equal(Object.keys(out.context.claims).length,0);assert.ok(Object.keys(out.context.omissions).length>0);await result.getByText('Insufficient context: no assertions were selected.',{exact:false}).waitFor();assert.ok((await result.getByRole('status').filter({hasText:'selected assertions'}).textContent()).includes(`${Object.keys(out.context.omissions).length} omitted assertions`));
    const downloaded=page.waitForEvent('download');await result.getByRole('button',{name:'Export exact Context JSON'}).click();assert.equal(await readFile(await(await downloaded).path(),'utf8'),raw);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await session.close();
  }
 }finally{await browser?.close();server.kill();if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
});
