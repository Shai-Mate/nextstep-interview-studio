#!/usr/bin/env python3
"""UI contract test with an explicitly mocked AI provider; this does NOT verify a live model."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('MOMENTUM_BASE_URL','http://127.0.0.1:4173').rstrip('/')
ARTIFACTS=Path(__file__).resolve().parents[1]/'test-results'
ARTIFACTS.mkdir(exist_ok=True)
requests=[]
RESULT={
    'provider':'openai',
    'result':{
        'title':'Fixture research brief',
        'summary':'This test response exercises citations, consent and saved notes. It is not live research.',
        'sections':[{'title':'A useful question','body':'Ask how the customer team measures successful onboarding.','bullets':['Verify the public team page before using a claim.']}],
        'nextSteps':['Review the cited source.'],
    },
    'sources':[{'title':'Example company team — test fixture','url':'https://example.com/team'},{'title':'Unsafe fixture link','url':'javascript:alert(1)'}],
}

def mock_health(route):
    route.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'capabilities':{'jobImport':True,'aiCoach':True,'webResearch':True}}))

def mock_coach(route):
    payload=route.request.post_data_json
    requests.append(payload)
    route.fulfill(status=200,content_type='application/json',body=json.dumps(RESULT))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block')
    context.route('**/api/health',mock_health)
    context.route('**/api/coach',mock_coach)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE)
    page.get_by_role('button',name='Try a sample',exact=True).click()
    page.get_by_role('tab',name='Know the people').click()
    page.get_by_role('textbox',name='Interviewer’s name',exact=True).fill('Jordan Example')
    page.get_by_role('textbox',name='Company research & sources',exact=True).fill('Original notes supplied by the candidate. Source: fictional sample job.')
    page.get_by_role('button',name='Find connections in my research',exact=True).click()
    dialog=page.get_by_role('dialog',name='An extra perspective')
    expect(dialog.get_by_role('button',name='Get suggestions',exact=True)).to_be_disabled()
    web=dialog.get_by_role('checkbox',name='Research public professional sources on the web.',exact=True)
    consent=dialog.get_by_role('checkbox',name='I agree to send these details to OpenAI for this request.',exact=True)
    expect(web).not_to_be_checked()
    expect(consent).not_to_be_checked()
    assert requests==[], 'Opening the dialog must not send candidate information.'
    consent.check()
    expect(dialog.get_by_role('button',name='Get suggestions',exact=True)).to_be_enabled()
    web.check()
    expect(consent).not_to_be_checked()
    expect(dialog.get_by_role('button',name='Get suggestions',exact=True)).to_be_disabled()
    assert requests==[], 'Changing the research option must not submit a request.'
    consent.check()
    dialog.get_by_role('button',name='Get suggestions',exact=True).click()
    expect(dialog.get_by_role('heading',name='Fixture research brief')).to_be_visible()
    assert len(requests)==1
    request=requests[0]
    assert request['action']=='research' and request['consent'] is True and request['webResearch'] is True
    assert 'profile' not in request and 'answer' not in request
    assert request['context']['interviewer']['name']=='Jordan Example'
    source=dialog.get_by_role('link',name='Example company team — test fixture',exact=False)
    expect(source).to_have_attribute('href','https://example.com/team')
    assert dialog.locator('a[href^="javascript:"]').count()==0
    page.screenshot(path=str(ARTIFACTS/'mobile-ai-fixture-result.png'),full_page=True)
    dialog.get_by_role('button',name='Save to my notes',exact=False).click()
    expect(dialog).not_to_be_visible()
    notes=page.get_by_role('textbox',name='Company research & sources',exact=True)
    expect(notes).to_have_value(__import__('re').compile('Original notes supplied by the candidate'))
    expect(notes).to_have_value(__import__('re').compile('Fixture research brief'))
    expect(notes).to_have_value(__import__('re').compile('https://example.com/team'))
    page.reload()
    page.get_by_role('tab',name='Know the people').click()
    expect(page.get_by_role('textbox',name='Company research & sources',exact=True)).to_have_value(__import__('re').compile('Fixture research brief'))
    assert not errors, errors
    browser.close()
print('PASS: mocked AI flow; explicit consent, research opt-in/reset, no profile sharing, safe citations, saved notes and reload persistence. No live AI provider call was made.')
