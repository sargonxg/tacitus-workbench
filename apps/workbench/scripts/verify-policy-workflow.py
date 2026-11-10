"""Actual local reader checks and screenshots. No model or external action."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'docs/images';checks=[];errors=[]
def check(name,value):
 assert value,name
 checks.append(name)
raw=(ROOT/'public/examples/syria-policy-workflow.json').read_bytes()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1050});page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8767/?mode=workflow');page.get_by_role('button',name='Load recorded Syria briefing').click();page.wait_for_selector('.pw-claim');check('real agent draft loaded',page.locator('.pw-claim').count()==3);check('recorded model usage visible','2055 input' in page.locator('.pw-title').inner_text());page.locator('.pw-claim').nth(1).click();check('citation selects exact source','Requests the Secretary-General' in page.locator('.pw-evidence').inner_text());page.locator('.pw-claim').nth(2).click();check('historical target retained','within a target of six months' in page.locator('.pw-evidence').inner_text());page.get_by_text('Inspect the agent run',exact=False).click();check('two agent steps inspectable',page.locator('.pw-graph').first.locator('li').count()==2);page.get_by_text('Inspect the knowledge graph',exact=False).click();check('actual graph objects',page.locator('.pw-graph svg circle').count()==15);check('actual graph relationships',page.locator('.pw-graph svg line').count()==16)
 with page.expect_download() as info:page.get_by_role('button',name='Export unchanged result').click()
 check('exact bytes preserved',Path(info.value.path()).read_bytes()==raw)
 for width in [320,390,768,1440]:
  page.set_viewport_size({'width':width,'height':1050});check('no overflow '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  if width in [390,1440]:page.screenshot(path=str(out/('policy-workflow-mobile.png' if width==390 else 'policy-workflow-desktop.png')),full_page=True)
 tampered=json.loads(raw);tampered['artifact']['items'][0]['evidence'][0]['quote']='tampered';page.locator('.pw-tools input').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(tampered).encode()});page.wait_for_timeout(200);check('failed import clears previous draft',page.locator('.pw-claim').count()==0);check('failed import explicit','differs from the capsule' in page.locator('[role=status]').inner_text());check('no JS errors',not errors);b.close()
report={'passed':len(checks),'checks':checks,'errors':errors};(ROOT/'docs/POLICY_WORKFLOW_VERIFICATION.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
