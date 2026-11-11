#!/usr/bin/env python3
"""Focused failure-path regressions, using fictional data and intercepted services."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

BASE=os.environ.get('MOMENTUM_BASE_URL','http://127.0.0.1:4173').rstrip('/')
KEY='prism.workspace.v1'
ART=Path(__file__).resolve().parents[1]/'test-results/audit'
ART.mkdir(parents=True,exist_ok=True)

def settle(page):
    expect(page.get_by_role('heading',level=1)).to_be_visible()
    assert page.evaluate('''async key=>{for(let i=0;i<100;i++){if(localStorage.getItem(key))return true;await new Promise(r=>setTimeout(r,20));}return false;}''',KEY)

def cross_tab(browser):
    c=browser.new_context(viewport={'width':1200,'height':900})
    a=c.new_page();a.goto(BASE+'/#profile');settle(a)
    a.get_by_role('textbox',name='Your name Optional',exact=True).fill('Avery Example')
    b=c.new_page();b.goto(BASE+'/#profile');settle(b)
    expect(b.get_by_role('textbox',name='Your name Optional',exact=True)).to_have_value('Avery Example')
    a.get_by_role('textbox',name='Achievements and examples',exact=True).fill('A meaningful new achievement saved in the first window.')
    b.get_by_role('textbox',name='Location Optional',exact=True).fill('Vancouver')
    a.reload();settle(a)
    observed={'achievementAfterReload':a.get_by_role('textbox',name='Achievements and examples',exact=True).input_value(),'locationAfterReload':a.get_by_role('textbox',name='Location Optional',exact=True).input_value(),'status':a.locator('.save-indicator').inner_text()}
    a.get_by_role('textbox',name='Achievements and examples',exact=True).scroll_into_view_if_needed()
    a.screenshot(path=str(ART/'cross-tab-lost-achievement.png'))
    assert observed['achievementAfterReload']=='A meaningful new achievement saved in the first window.',observed
    assert observed['locationAfterReload']=='Vancouver',observed
    print('PASS CROSS_TAB',json.dumps(observed),flush=True)
    c.close()

def delayed_research(browser):
    c=browser.new_context(viewport={'width':1200,'height':900})
    c.add_init_script('''(()=>{const original=window.fetch;window.fetch=(input,options)=>{if(String(input).includes('/api/import-job'))return new Promise(resolve=>{window.resolveResearch=()=>resolve(new Response(JSON.stringify({job:{text:'Imported public company overview describing customer service and onboarding priorities.',role:'',company:'',url:'https://example.com/about'},warnings:[]}),{status:200,headers:{'Content-Type':'application/json'}}));});return original(input,options);};})();''')
    page=c.new_page();page.goto(BASE);settle(page)
    page.get_by_role('button',name='Try a sample',exact=True).click()
    page.get_by_role('tab',name='Know the people').click()
    page.get_by_text('Import a public company page',exact=True).click()
    page.get_by_role('textbox',name='Public page URL',exact=True).fill('https://example.com/about')
    page.get_by_role('button',name='Add page to notes',exact=True).click()
    page.get_by_role('textbox',name='Interviewer’s name',exact=True).fill('Jordan Newly Added')
    page.get_by_role('textbox',name='Company research & sources',exact=True).fill('A manual note entered while the public page is loading.')
    page.evaluate('window.resolveResearch()')
    expect(page.get_by_role('button',name='Add page to notes',exact=True)).to_be_visible()
    expect(page.get_by_role('textbox',name='Company research & sources',exact=True)).to_have_value(__import__('re').compile('Imported public company'))
    observed={'interviewerAfterImport':page.get_by_role('textbox',name='Interviewer’s name',exact=True).input_value(),'notesAfterImport':page.get_by_role('textbox',name='Company research & sources',exact=True).input_value()}
    page.screenshot(path=str(ART/'research-import-overwrites-edits.png'),full_page=True)
    assert observed['interviewerAfterImport']=='Jordan Newly Added',observed
    assert 'A manual note entered while' in observed['notesAfterImport'],observed
    print('PASS DELAYED_RESEARCH',json.dumps(observed),flush=True)
    c.close()

def cancelled_export(browser):
    c=browser.new_context(viewport={'width':1200,'height':900})
    c.add_init_script('''Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('User cancelled sharing','AbortError');}});''')
    page=c.new_page();page.goto(BASE);settle(page)
    page.get_by_role('button',name='Try a sample',exact=True).click()
    page.get_by_role('button',name='Dismiss notification',exact=True).click()
    page.get_by_role('tab',name='Story bank',exact=True).click()
    downloads=[];page.on('download',lambda download:downloads.append(download.suggested_filename))
    page.get_by_role('button',name='Export stories',exact=True).click()
    page.wait_for_timeout(200)
    expect(page.locator('.toast')).not_to_be_visible()
    observed={'toastAfterCancellation':None,'downloads':downloads}
    page.screenshot(path=str(ART/'cancelled-export-success-toast.png'))
    assert downloads==[],observed
    page.evaluate('key=>localStorage.setItem(key,"{damaged original data")',KEY)
    page.reload();expect(page.get_by_role('alert')).to_be_visible()
    page.goto(BASE+'/#settings')
    page.get_by_role('button',name='Export original data for recovery',exact=True).click()
    page.wait_for_timeout(200)
    expect(page.locator('.toast')).not_to_be_visible()
    assert page.evaluate('key=>localStorage.getItem(key)',KEY)=='{damaged original data'
    page.screenshot(path=str(ART/'cancelled-recovery-preserved.png'))
    print('PASS CANCELLED_EXPORT_AND_RECOVERY',json.dumps(observed),flush=True)
    c.close()

def conflict_and_delete(browser):
    c=browser.new_context(viewport={'width':1200,'height':900},accept_downloads=True)
    a=c.new_page();a.goto(BASE+'/#profile');settle(a)
    a.get_by_role('textbox',name='Your name Optional',exact=True).fill('Original person')
    b=c.new_page();b.goto(BASE+'/#profile');settle(b)
    a.get_by_role('textbox',name='Achievements and examples',exact=True).focus()
    b.get_by_role('textbox',name='Location Optional',exact=True).fill('A change from window B')
    expect(a.get_by_role('alert')).to_contain_text('Saving is paused')
    a.get_by_role('textbox',name='Achievements and examples',exact=True).fill('A newer local draft retained for backup, never silently written over B.')
    assert a.evaluate('key=>JSON.parse(localStorage.getItem(key)).profile.achievements',KEY)==''
    a.goto(BASE+'/#settings')
    with a.expect_download() as download:
        a.get_by_role('button',name='Export my workspace',exact=True).click()
    path=ART/'conflicted-window-backup.json';download.value.save_as(path)
    assert json.loads(path.read_text())['profile']['achievements'].startswith('A newer local draft')
    b.goto(BASE+'/#settings')
    b.get_by_role('button',name='Delete all my data',exact=True).click()
    dialog=b.get_by_role('dialog')
    dialog.get_by_role('textbox',name='Type DELETE to confirm',exact=True).fill('DELETE')
    dialog.get_by_role('button',name='Delete all my data',exact=True).click()
    expect(b.get_by_role('heading',level=1)).to_contain_text('Big possibilities')
    a.goto(BASE+'/#profile')
    a.get_by_role('textbox',name='Your name Optional',exact=True).fill('Still stale after deletion')
    assert a.evaluate('key=>JSON.parse(localStorage.getItem(key)).profile.name',KEY)==''
    expect(a.locator('.save-indicator')).to_contain_text('Unsaved changes')
    a.screenshot(path=str(ART/'stale-window-paused-after-delete.png'))
    a.on('dialog',lambda dialog:dialog.accept())
    a.get_by_role('button',name='Reload latest workspace',exact=True).click()
    expect(a.get_by_role('textbox',name='Your name Optional',exact=True)).to_have_value('')
    expect(a.get_by_role('alert')).not_to_be_visible()
    print('PASS CONFLICT_EXPORT_DELETE_RELOAD',flush=True)
    c.close()


def inline_offer_conflict(browser):
    c=browser.new_context(viewport={'width':1200,'height':900},accept_downloads=True)
    a=c.new_page();a.goto(BASE+'/#offers');settle(a)
    fixture=json.loads((Path(__file__).resolve().parents[1]/'test-results/workspace-backup.json').read_text())
    a.evaluate('([key,value])=>localStorage.setItem(key,value)',[KEY,json.dumps(fixture)])
    a.reload();expect(a.locator('.offer-summary')).to_be_visible()
    b=c.new_page();b.goto(BASE+'/#offers');settle(b)
    a.get_by_role('button',name='Edit offer',exact=True).click()
    a.get_by_role('spinbutton',name=__import__('re').compile('^Base salary')).fill('6500')
    a.get_by_role('textbox',name='Private notes',exact=True).fill('Unsaved inline offer decision notes that must survive an external deletion.')
    a.get_by_role('button',name='Save changes',exact=False).focus()
    b.get_by_role('button',name='Delete this offer',exact=True).click()
    b.get_by_role('button',name='Delete offer',exact=True).click()
    expect(b.locator('.save-indicator')).to_have_text('Saved on this device')
    expect(a.get_by_role('alert')).to_contain_text('Saving is paused')
    expect(a.get_by_role('spinbutton',name=__import__('re').compile('^Base salary'))).to_have_value('6500')
    expect(a.get_by_role('textbox',name='Private notes',exact=True)).to_have_value('Unsaved inline offer decision notes that must survive an external deletion.')
    a.screenshot(path=str(ART/'inline-offer-conflict-preserves-draft.png'),full_page=True)
    a.get_by_role('button',name='Save changes',exact=False).click()
    expect(a.locator('.save-indicator')).to_have_text('Unsaved changes')
    assert a.evaluate('key=>JSON.parse(localStorage.getItem(key)).offers.length',KEY)==0
    a.goto(BASE+'/#settings')
    with a.expect_download() as download:
        a.get_by_role('button',name='Export my workspace',exact=True).click()
    path=ART/'inline-offer-conflict-backup.json';download.value.save_as(path)
    exported=json.loads(path.read_text())
    assert exported['offers'][0]['base']==6500
    assert exported['offers'][0]['notes'].startswith('Unsaved inline offer decision notes')
    print('PASS INLINE_OFFER_FORM_EXTERNAL_DELETE_PRESERVES_EXPORT',flush=True)
    c.close()


with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    cross_tab(browser)
    conflict_and_delete(browser)
    inline_offer_conflict(browser)
    delayed_research(browser)
    cancelled_export(browser)
    browser.close()
