import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

test('standalone HTTP boundary and desktop/mobile recorded and live flows',async()=>{
  const origin='http://127.0.0.1:4318';
  const enabled=process.env.TACITUS_LOCAL_INSPECTOR==='1';
  const child=spawn(process.execPath,['server/index.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:'4318'},stdio:'pipe',windowsHide:true});
  let browser;let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  try{
    let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch(origin+'/api/status')).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}assert.ok(ready,output);
    const denied=await fetch(origin+'/api/inspect',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:'{}'});assert.equal(denied.status,enabled?403:404);
    const escape=await fetch(origin+'/%2e%2e%2fpackage.json');assert.equal(escape.status,404);
    browser=await chromium.launch({headless:true,...(process.env.TACITUS_TEST_BROWSER?{executablePath:process.env.TACITUS_TEST_BROWSER}:{})});
    const expected=await readFile('public/examples/peace.context.json','utf8');
    for(const width of [1440,390]){
      const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin);await page.getByLabel('Execution mode').selectOption('recorded');await page.getByRole('button',{name:'Load recorded peace Context',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();const downloaded=await downloadPromise;assert.equal(await readFile(await downloaded.path(),'utf8'),expected);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.getByRole('button',{name:'Load optional recorded walkthrough'}).click();await page.getByLabel('Historical clock').waitFor();
      await page.getByLabel('Historical clock').selectOption('recipient-received');await page.getByLabel('Historical clock').selectOption('explicit-hindsight-comparison');
      await page.getByRole('button',{name:'3. Actual retrieval evidence',exact:true}).click();await page.getByText('serialized bytes',{exact:false}).first().waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:`output/interface-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);
      if(enabled&&process.env.TACITUS_TEST_ARCHIVE){
        await page.getByLabel('Execution mode').selectOption('live');await page.getByLabel('Native ZIP').setInputFiles(process.env.TACITUS_TEST_ARCHIVE);await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();assert.equal((await page.locator('body').innerText()).includes('Live Context'),true);
        const liveDownloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();
        assert.equal(await readFile(await (await liveDownloadPromise).path(),'utf8'),expected);
        const results=page.getByRole('heading',{name:'Accessible results',exact:true}).locator('..').locator('..');
        assert.ok(await results.getByRole('button',{pressed:false}).count()>0);
        await results.locator('li button').first().click();assert.equal(await results.getByRole('button',{pressed:true}).count(),1);
        await page.getByLabel('Search text, actors or evidence').fill('zzzz-no-match');await page.getByText('No nodes match these filters.',{exact:true}).waitFor();
        await page.getByLabel('Search text, actors or evidence').fill('');
        await page.screenshot({path:`output/live-interface-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);

        await page.getByLabel('Known as of').fill('1');await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByText(/Live operation failed:/).waitFor();assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
        await page.getByLabel('Known as of').fill('1792328100');
        let releaseRequest;const held=new Promise(resolve=>releaseRequest=resolve);let sawRequest;const entered=new Promise(resolve=>sawRequest=resolve);
        await page.route('**/api/inspect',async route=>{sawRequest();await held;await route.continue();});
        await page.getByRole('button',{name:'Query core',exact:true}).click();await entered;
        for(const name of ['Question','Known as of','Valid at','Maximum output bytes','Validity policy'])assert.equal(await page.getByLabel(name,{exact:name==='Question'}).isDisabled(),true);
        releaseRequest();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();await page.unrouteAll({behavior:'wait'});
        assert.notEqual(await page.getByLabel('Native ZIP').inputValue(),'');
        await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await page.getByLabel('Native ZIP').inputValue(),'');
        await page.getByLabel('Native ZIP').setInputFiles(process.env.TACITUS_TEST_ARCHIVE);await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
        for(const [name,value] of [['Question','mediation'],['Known as of','1792328101'],['Valid at','1792328101'],['Maximum output bytes','65535']]){
          await page.getByLabel(name,{exact:name==='Question'}).fill(value);assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
          await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
        }
        await page.getByLabel('Validity policy').selectOption('require_declared_interval');assert.equal(await page.getByRole('button',{name:'Export exact Context JSON'}).count(),0);
      }
      if(enabled&&process.env.TACITUS_TEST_COLLECTION==='1'){
        const lexical=page.getByRole('region',{name:'Expanded lexical collection'});
        const responsePromise=page.waitForResponse(r=>r.url()===origin+'/api/collection');
        await lexical.getByRole('button',{name:'Search all 622 sources',exact:true}).click();const response=await responsePromise;assert.equal(response.status(),200);
        const sourceRaw=await response.text();const selected=JSON.parse(sourceRaw);assert.equal(selected.receipt.indexed_sources,622);assert.equal(selected.receipt.visited_shards,32);assert.ok(selected.excerpts.length>0);assert.ok(Buffer.byteLength(sourceRaw)<=32768);
        const cli=spawnSync('/usr/bin/python3',['../../examples/diplomacy-1914-v2/.data/collection-adapter/collection.py','query','../../examples/diplomacy-1914-v2/.data/lexical-index'],{input:JSON.stringify({question:'relief assurance permission',max_bytes:32768}),env:{},encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);assert.equal(sourceRaw,cli.stdout);
        await lexical.getByRole('button',{name:'Export exact lexical source JSON'}).waitFor();const lexicalDownload=page.waitForEvent('download');await lexical.getByRole('button',{name:'Export exact lexical source JSON'}).click();assert.equal(await readFile(await(await lexicalDownload).path(),'utf8'),sourceRaw);
        await lexical.getByLabel('Lexical question').fill('zzzz-no-match');assert.equal(await lexical.getByRole('button',{name:'Export exact lexical source JSON'}).count(),0);
        await lexical.getByRole('button',{name:'Search all 622 sources',exact:true}).click();await lexical.locator('p').filter({hasText:/^omission_only/}).waitFor();
        await page.getByRole('button',{name:'Reset',exact:true}).click();
        await page.getByLabel('Native ZIP').setInputFiles('../../examples/diplomacy-1914-v2/expanded-cases.native-v2.zip');
        await page.getByRole('button',{name:'Inspect archive',exact:true}).click();await page.getByText('Exact archive inspection',{exact:true}).waitFor();
        await page.getByLabel('Question',{exact:true}).fill('relief assurance');await page.getByLabel('Known as of').fill('1792332960');await page.getByLabel('Valid at').fill('1792332960');await page.getByLabel('Maximum output bytes').fill('65536');await page.getByLabel('Validity policy').selectOption('disclose_unknown');
        await page.getByRole('button',{name:'Query core',exact:true}).click();await page.getByRole('button',{name:'Export exact Context JSON'}).waitFor();
        const expandedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export exact Context JSON'}).click();assert.equal(await readFile(await(await expandedDownload).path(),'utf8'),await readFile('../../examples/diplomacy-1914-v2/.data/validation/expanded-native/relief.context.json','utf8'));
        await page.screenshot({path:`output/expanded-interface-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      await context.close();
    }
  }finally{await browser?.close();child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});}
});
