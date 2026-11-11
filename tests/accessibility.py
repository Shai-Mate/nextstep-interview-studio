#!/usr/bin/env python3
"""Automated WCAG AA checks. CSP bypass is limited to this audit for axe injection.
Ordinary E2E tests keep production CSP enabled; physical VoiceOver remains a release gate.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.getenv('MOMENTUM_BASE_URL','http://127.0.0.1:5173')
reports=[]
def audit(page,label,width):
 page.wait_for_timeout(300)
 assert page.locator('vite-error-overlay').count()==0,'Development server compilation failed'
 assert page.locator('#main-content').is_visible(),'App did not mount'
 page.add_script_tag(path=str(ROOT/'node_modules/axe-core/axe.min.js'))
 result=page.evaluate("async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})")
 violations=[{'id':v['id'],'impact':v['impact'],'nodes':[{'target':n['target'],'summary':n.get('failureSummary','')} for n in v['nodes']]} for v in result['violations']]
 reports.append({'width':width,'view':label,'violations':violations})
 print(width,label,[(v['id'],len(v['nodes'])) for v in violations],flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [1440,390]:
  context=browser.new_context(viewport={'width':width,'height':900},bypass_csp=True)
  page=context.new_page()
  page.goto(BASE,wait_until='networkidle')
  audit(page,'empty home',width)
  page.get_by_role('button',name='Add an opportunity',exact=True).click()
  audit(page,'job import dialog',width)
  page.keyboard.press('Escape')
  fixture=ROOT/'test-results/workspace-backup.json'
  if fixture.exists():
   seeded=json.loads(fixture.read_text())
   seeded['opportunities'][0]['coaching']=[{'id':'accessibility-fixture-note','action':'course','title':'A clear next step — accessibility fixture','created':'2026-11-11T10:00:00Z','text':'Use a real example, describe your own action, and explain the outcome. This is fictional test content.','sources':[{'title':'Example professional source','url':'https://example.com/team'}],'contextKey':'course'}]
   page.evaluate('(data)=>localStorage.setItem("prism.workspace.v1",data)',json.dumps(seeded));page.reload()
  else:page.get_by_role('button',name='Try a sample',exact=True).click()
  for route in ['home','opportunities','profile','applications','offers','settings','prepare']:
   page.goto(BASE+'/#'+route);audit(page,route,width)
  for section in ['Story bank','Know the people','Practice interview','Interview day']:
   page.get_by_role('tab',name=section,exact=True).click()
   if section=='Practice interview' and page.get_by_role('button',name='Start practice interview',exact=True).count():page.get_by_role('button',name='Start practice interview',exact=True).click()
   audit(page,section,width)
  page.goto(BASE+'/#prepare')
  note=page.locator('.coaching-note').first
  assert note.count(), 'Coaching fixture was not rendered; accessibility coverage is incomplete'
  if note.count():
   note.locator('summary').click();audit(page,'saved coaching note expanded',width)
   note.get_by_role('button',name='Remove note',exact=True).click();audit(page,'coaching note removal confirmation',width)
   note.get_by_role('button',name='Keep note',exact=True).click()
  if width==390:
   page.get_by_role('button',name='Open navigation',exact=True).click();audit(page,'mobile navigation',width);page.keyboard.press('Escape')
  context.close()
 browser.close()
(ROOT/'test-results').mkdir(exist_ok=True)
(ROOT/'test-results/accessibility.json').write_text(json.dumps(reports,indent=2))
assert not any(r['violations'] for r in reports),'Accessibility violations found; see test-results/accessibility.json'
print('PASS: empty/populated views, preparation, expanded/removal coaching states, modal and navigation have no automated WCAG AA violations. CSP bypass was used only for axe injection.')
