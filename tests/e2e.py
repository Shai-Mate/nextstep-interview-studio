#!/usr/bin/env python3
"""Momentum browser journeys. Run against a built app: MOMENTUM_BASE_URL=http://127.0.0.1:4173 python tests/e2e.py.

Uses the managed environment's Python Playwright and system Chromium. Test data is fictional.
"""
import json
import io
import zipfile
from xml.sax.saxutils import escape
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('MOMENTUM_BASE_URL', 'http://127.0.0.1:4173').rstrip('/')
ARTIFACTS = Path(os.environ.get('MOMENTUM_ARTIFACT_DIR', str(ROOT / 'test-results')))
ARTIFACTS.mkdir(exist_ok=True)
PROFILE_TEXT = (ROOT / 'tests/fixtures/resume.txt').read_text()
JOB_TEXT = (ROOT / 'tests/fixtures/job.txt').read_text()
STORAGE_KEY = 'prism.workspace.v1'


def wait_for_initial_save(page):
    expect(page.get_by_role('heading',level=1)).to_be_visible()
    saved=page.evaluate("""async key=>{for(let i=0;i<100;i++){if(localStorage.getItem(key)!==null)return true;await new Promise(resolve=>setTimeout(resolve,20));}return false;}""",STORAGE_KEY)
    assert saved, 'Initial workspace save did not settle before seeding the fixture.'


def check_no_overflow(page, label):
    widths = page.evaluate('({viewport:document.documentElement.clientWidth, body:document.documentElement.scrollWidth})')
    assert widths['body'] <= widths['viewport'] + 1, f'{label}: horizontal overflow {widths}'


def route(page, name):
    page.goto(f'{BASE}/#{name}')
    expect(page.locator('#main-content')).to_be_visible()


def pdf_document(text):
    """A minimal text-based PDF, generated without a binary fixture dependency."""
    text = text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
    text = text.encode('ascii', errors='replace').decode()
    stream = f'BT /F1 12 Tf 40 740 Td ({text}) Tj ET'.encode()
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
    ]
    result = b'%PDF-1.4\n'
    offsets=[0]
    for index, obj in enumerate(objects,1):
        offsets.append(len(result))
        result += f'{index} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start=len(result)
    result += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    for offset in offsets[1:]: result += f'{offset:010} 00000 n \n'.encode()
    result += f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()
    return result


def word_document(text):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as document:
        document.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        document.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        paragraphs=''.join(f'<w:p><w:r><w:t>{escape(line)}</w:t></w:r></w:p>' for line in text.splitlines())
        document.writestr('word/document.xml',f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraphs}</w:body></w:document>')
    return output.getvalue()


def add_opportunity_journey(page):
    print("Testing PDF job import and opportunity creation",flush=True)
    route(page,'home')
    trigger=page.get_by_role('button',name='Add an opportunity',exact=True)
    trigger.click()
    dialog=page.get_by_role('dialog',name='Your next opportunity')
    expect(dialog).to_be_visible()
    expect(dialog.get_by_role('textbox',name=re.compile('^Job description'))).to_be_focused()
    page.keyboard.press('Escape')
    expect(dialog).not_to_be_visible()
    expect(trigger).to_be_focused()
    trigger.click()
    dialog.get_by_role('tab',name='Upload a file').click()
    text='Customer Success Specialist at Example Company. Communicate clearly with customers, coordinate onboarding, maintain accurate records and collaborate on customer support improvements. Experience in customer service and strong written communication required.'
    fixture={'name':'job-description.txt','mimeType':'text/plain','buffer':text.encode()} if os.environ.get('MOMENTUM_SKIP_PDF') else {'name':'job-description.pdf','mimeType':'application/pdf','buffer':pdf_document(text)}
    dialog.locator('input[type=file]').set_input_files(fixture)
    expect(dialog.get_by_role('textbox',name=re.compile('^Job description'))).to_have_value(re.compile('Customer Success Specialist'),timeout=30000)
    dialog.get_by_role('button',name='Continue',exact=False).click()
    dialog.get_by_label('Job title',exact=True).fill('Customer Success Specialist')
    dialog.get_by_label('Company',exact=True).fill('Example Company')
    dialog.get_by_label('Interview stage').select_option('Screening')
    dialog.get_by_role('button',name='Create my plan',exact=False).click()
    expect(dialog).not_to_be_visible()
    expect(page.locator('#active-opportunity')).to_contain_text('Customer Success Specialist')
    state=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert len(state['opportunities'])==1
    assert len(state['opportunities'][0]['course'])>=6
    assert state['opportunities'][0]['sample'] is False
    check_no_overflow(page,'preparation')


def profile_journey(page):
    print("Testing profile, Word import and draft persistence",flush=True)
    route(page, 'profile')
    page.get_by_label('Your name', exact=False).fill('Avery Morgan')
    page.get_by_label('Role you’re looking for').fill('Customer Success Specialist')
    page.get_by_label('Where are you in your career?').select_option(label='3–7 years of experience')
    page.get_by_label('Import résumé document').set_input_files({'name':'resume.docx','mimeType':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','buffer':word_document(PROFILE_TEXT)})
    expect(page.get_by_role('textbox',name='Résumé or career notes',exact=True)).to_have_value(re.compile('Avery Morgan'),timeout=30000)
    page.get_by_label('Skills you can confidently explain').fill('Customer support, communication, Excel, project coordination')
    page.get_by_label('Achievements and examples').fill('I created a shared response guide and reduced repeat questions for a team of five colleagues.')
    page.get_by_label('Preferred work arrangement').select_option(label='Remote')
    page.get_by_label('What matters most right now?').select_option(label='Learning and growth')
    page.get_by_role('tab', name='Profile kit').click()
    page.get_by_label('Edit professional headline').fill('Customer success specialist | Clear communication and practical problem solving')
    page.reload()
    page.get_by_role('tab', name='Profile kit').click()
    expect(page.get_by_label('Edit professional headline')).to_have_value('Customer success specialist | Clear communication and practical problem solving')
    page.get_by_role('tab', name='Your story').click()
    expect(page.get_by_label('Preferred work arrangement')).to_have_value('Remote')
    check_no_overflow(page, 'profile')
    page.screenshot(path=str(ARTIFACTS / 'desktop-profile.png'), full_page=True)


def offer_journey(page):
    print("Testing offer normalization, negotiation and persistence",flush=True)
    route(page, 'offers')
    page.get_by_role('button', name='Add an offer', exact=True).click()
    page.get_by_label('Company', exact=True).fill('Example Company')
    page.get_by_label('Role', exact=True).fill('Customer Success Specialist')
    page.get_by_role('combobox',name='Currency',exact=True).select_option('CAD')
    page.get_by_label('Base salary is quoted').select_option('month')
    page.get_by_label(re.compile('^Base salary CAD')).fill('6000')
    page.get_by_label('Your target salary', exact=False).fill('6500')
    page.get_by_label('Target annual bonus', exact=False).fill('4000')
    page.get_by_label('Estimated annual equity', exact=False).fill('10000')
    page.get_by_role('button', name='Save offer', exact=True).click()
    expect(page.locator('.offer-total')).to_contain_text('72,000')
    expect(page.locator('.offer-breakdown')).to_contain_text('76,000')
    # Equity is shown separately, never silently added to annual cash.
    expect(page.locator('.offer-breakdown')).not_to_contain_text('86,000')
    page.get_by_label('Edit your negotiation message').fill('Thank you for the offer. Could we discuss a base salary of CAD 6,500 per month?')
    page.get_by_label('I have the full offer in writing.').check()
    page.get_by_label('Where does this offer stand?').select_option('Negotiating')
    page.reload()
    expect(page.get_by_label('Edit your negotiation message')).to_have_value('Thank you for the offer. Could we discuss a base salary of CAD 6,500 per month?')
    expect(page.get_by_label('I have the full offer in writing.')).to_be_checked()
    expect(page.get_by_label('Where does this offer stand?')).to_have_value('Negotiating')
    check_no_overflow(page, 'offers')
    page.screenshot(path=str(ARTIFACTS / 'desktop-offer.png'), full_page=True)


def preparation_journey(page):
    print("Testing lessons, stories, research and full practice session",flush=True)
    route(page,'prepare')
    notes=page.get_by_label('Your working notes',exact=False)
    notes.fill('I can explain the role through customer outcomes and clear handovers.')
    expect(notes).to_be_focused()
    page.locator('.quiz-options button').first.click()
    expect(page.locator('.quiz-feedback')).to_be_visible()
    page.get_by_role('button',name='Complete this lesson').click()
    page.reload()
    page.locator('.lesson-list button').first.click()
    expect(page.get_by_label('Your working notes',exact=False)).to_have_value('I can explain the role through customer outcomes and clear handovers.')
    expect(page.get_by_role('button',name='Mark as unfinished')).to_be_visible()
    page.get_by_role('tab',name='Story bank').click()
    page.get_by_role('textbox',name='Your story',exact=True).fill('I noticed repeat support questions, wrote a shared guide, and improved it using real customer feedback.')
    page.get_by_role('tab',name='Know the people').click()
    page.get_by_label('Interviewer’s name',exact=True).fill('Jordan Example')
    page.get_by_label('Their role').fill('Customer Success Manager')
    page.get_by_label('Professional background & conversation notes').fill('Public company bio says Jordan leads customer onboarding. Ask about the team’s priorities. Source: example.com/team.')
    page.get_by_label('Company research & sources').fill('The company provides small business software. Source: the supplied job ad. Ask which customer problems the team is prioritizing.')
    page.get_by_role('tab',name='Practice interview').click()
    page.get_by_role('button',name='Start practice interview').click()
    draft='I helped our team improve handovers by writing a shared guide and checking the process with five colleagues.'
    page.get_by_role('textbox',name='Your answer',exact=True).fill(draft)
    page.reload()
    page.get_by_role('tab',name='Practice interview').click()
    expect(page.get_by_role('textbox',name='Your answer',exact=True)).to_have_value(draft)
    page.get_by_role('button',name='Reflect on my answer').click()
    expect(page.locator('.feedback-card')).to_contain_text('Answer 1 saved')
    for index in range(1,8):
        page.get_by_role('button',name='Next question',exact=False).click()
        page.get_by_role('textbox',name='Your answer',exact=True).fill(f'In example {index+1}, I gathered the relevant context, worked with my colleagues, and checked the outcome with the customer. I learned to communicate early and verify the next step.')
        page.get_by_role('button',name='Reflect on my answer').click()
    page.get_by_role('button',name='See your session summary').click()
    expect(page.locator('.practice-complete')).to_contain_text('You practised 8 answers')
    page.screenshot(path=str(ARTIFACTS/'desktop-practice-complete.png'),full_page=True)
    page.get_by_role('button',name='Practise again').click()
    page.get_by_role('dialog').get_by_role('button',name='Start a new round',exact=False).click()
    expect(page.get_by_role('textbox',name='Your answer',exact=True)).to_have_value('')
    expect(page.get_by_text('Previous practice rounds (1)',exact=True)).to_be_visible()
    state=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert len(state['opportunities'][0]['mockHistory'][0]['answers'])==8
    page.get_by_role('textbox',name='Your answer',exact=True).fill('A draft for my next practice round that should survive export and restore.')


def application_journey(page):
    print("Testing application editing and tracking",flush=True)
    route(page,'applications')
    page.get_by_role('button',name='Cover letter',exact=True).click()
    draft=page.get_by_role('textbox',name='Edit a letter with a reason to read on.',exact=True)
    draft.fill('')
    draft.press_sequentially('My own honest introduction.',delay=20)
    expect(draft).to_have_value('My own honest introduction.')
    expect(draft).to_be_focused()
    page.reload()
    page.get_by_role('button',name='Cover letter',exact=True).click()
    expect(page.get_by_role('textbox',name='Edit a letter with a reason to read on.',exact=True)).to_have_value('My own honest introduction.')
    page.get_by_role('button',name='Ready to apply',exact=True).click()
    page.get_by_label('Every claim, date, title and qualification is accurate.').check()
    page.get_by_role('textbox',name='Application notes',exact=True).fill('Prepared my résumé and application. I will submit on the employer’s own site.')
    page.get_by_role('button',name='I’ve submitted my application').click()
    state=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert state['opportunities'][0]['status']=='Applying'


def backup_journey(page):
    print("Testing workspace export, delete and restore",flush=True)
    route(page,'settings')
    with page.expect_download() as info:
        page.get_by_role('button',name='Export my workspace').click()
    backup=info.value
    backup_path=ARTIFACTS/'workspace-backup.json'
    backup.save_as(backup_path)
    state=json.loads(backup_path.read_text())
    assert len(state['opportunities'])==1 and len(state['offers'])==1
    assert state['profile']['name']=='Avery Morgan'
    page.get_by_label('Restore workspace backup').set_input_files(str(backup_path))
    dialog=page.get_by_role('dialog',name='Restore this workspace?')
    expect(dialog).to_contain_text('1 opportunities')
    dialog.get_by_role('button',name='Cancel',exact=True).click()
    assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).profile.name',STORAGE_KEY)=='Avery Morgan'
    page.get_by_role('button',name='Delete all my data',exact=True).click()
    dialog=page.get_by_role('dialog')
    expect(dialog.get_by_role('button',name='Delete all my data',exact=True)).to_be_disabled()
    dialog.get_by_label('Type DELETE to confirm').fill('DELETE')
    dialog.get_by_role('button',name='Delete all my data',exact=True).click()
    state=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert state['opportunities']==[] and state['offers']==[] and state['profile']['name']==''
    route(page,'settings')
    page.get_by_label('Restore workspace backup').set_input_files(str(backup_path))
    page.get_by_role('dialog').get_by_role('button',name='Replace & restore').click()
    restored=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert restored['profile']['name']=='Avery Morgan'
    assert len(restored['opportunities'][0]['mockHistory'])==1
    assert restored['opportunities'][0]['mock']['draft'].startswith('A draft for my next')


def static_pages(browser):
    context=browser.new_context()
    page=context.new_page()
    for width in [320,390,1440]:
        page.set_viewport_size({'width':width,'height':900})
        for name in ['privacy','support']:
            response=page.goto(f'{BASE}/{name}.html')
            assert response.status in (200,304), f'Unexpected document status: {response.status}'
            expect(page.get_by_role('heading',level=1)).to_be_visible()
            check_no_overflow(page,f'{name} {width}px')
            if width==390: page.screenshot(path=str(ARTIFACTS/f'mobile-{name}.png'),full_page=True)
    response=page.goto(f'{BASE}/third-party-notices.txt')
    assert response.status in (200,304), f'Unexpected document status: {response.status}'
    assert 'React' in page.locator('body').inner_text() or 'react' in page.locator('body').inner_text()
    context.close()


def offline_journey(page,context):
    controlled=page.evaluate('''async()=>{if(!navigator.serviceWorker)return false;if(navigator.serviceWorker.controller)return true;return await Promise.race([new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(true),{once:true})),new Promise(resolve=>setTimeout(()=>resolve(false),20000))]);}''')
    assert controlled, 'The production service worker did not take control.'
    route(page,'prepare')
    page.get_by_role('tab',name='Practice interview').click()
    expected=page.get_by_role('textbox',name='Your answer',exact=True).input_value()
    context.set_offline(True)
    page.reload()
    page.get_by_role('tab',name='Practice interview').click()
    expect(page.get_by_role('textbox',name='Your answer',exact=True)).to_have_value(expected)
    expect(page.locator('.save-indicator')).to_contain_text('Offline')
    page.goto(f'{BASE}/privacy.html')
    expect(page.get_by_role('heading',level=1)).to_be_visible()
    page.goto(f'{BASE}/support.html')
    expect(page.get_by_role('heading',level=1)).to_be_visible()
    context.set_offline(False)
    route(page,'home')


def mobile_layout(browser, saved):
    context = browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE)
    wait_for_initial_save(page)
    page.evaluate('([key,value])=>localStorage.setItem(key,value)', [STORAGE_KEY,saved])
    page.reload()
    expect(page.locator('.dashboard-role').first).to_be_visible()
    for name in ['home','opportunities','profile','applications','prepare','offers','settings']:
        route(page,name)
        check_no_overflow(page,f'mobile {name}')
        page.screenshot(path=str(ARTIFACTS/f'mobile-{name}.png'),full_page=True)
    assert not errors, f'Mobile runtime errors: {errors}'
    context.close()


def sample_journey(browser):
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    page=context.new_page()
    page.goto(BASE)
    page.get_by_role('button',name='Try a sample',exact=True).click()
    expect(page.get_by_text('Sample role',exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_text('Sample role',exact=True)).to_be_visible()
    state=json.loads(page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY))
    assert len(state['opportunities'])==1 and state['opportunities'][0]['sample'] is True
    assert state['profile']['name']==''
    check_no_overflow(page,'mobile sample preparation')
    context.close()


def startup_failure_check(browser):
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page()
    page.goto(BASE)
    wait_for_initial_save(page)
    original='{this is a damaged workspace'
    page.evaluate('([key,value])=>localStorage.setItem(key,value)', [STORAGE_KEY,original])
    page.reload()
    expect(page.get_by_role('alert')).to_contain_text('saved workspace')
    assert page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY)==original
    context.close()


def main():
    with sync_playwright() as playwright:
        browser=playwright.webkit.launch(headless=True,**({'executable_path':os.environ['MOMENTUM_WEBKIT_EXECUTABLE']} if os.environ.get('MOMENTUM_WEBKIT_EXECUTABLE') else {})) if os.environ.get('MOMENTUM_BROWSER')=='webkit' else playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(BASE)
        expect(page.get_by_role('heading',level=1)).to_be_visible()
        check_no_overflow(page,'desktop home')
        page.screenshot(path=str(ARTIFACTS/'desktop-home.png'),full_page=True)
        add_opportunity_journey(page)
        profile_journey(page)
        preparation_journey(page)
        application_journey(page)
        offer_journey(page)
        backup_journey(page)
        if not os.environ.get('MOMENTUM_SKIP_OFFLINE'): offline_journey(page,context)
        saved=page.evaluate('(key)=>localStorage.getItem(key)',STORAGE_KEY)
        state=json.loads(saved)
        assert len(state['offers'])==1
        assert state['profile']['name']=='Avery Morgan'
        mobile_layout(browser,saved)
        startup_failure_check(browser)
        sample_journey(browser)
        static_pages(browser)
        assert not errors, f'Desktop runtime errors: {errors}'
        context.close()
        browser.close()
    skipped=[name for name,flag in [('offline','MOMENTUM_SKIP_OFFLINE'),('PDF','MOMENTUM_SKIP_PDF')] if os.environ.get(flag)]
    print('PASS: enabled document, course, mock, application, profile, offer, backup, responsive and recovery checks' + ('; explicitly skipped: '+', '.join(skipped) if skipped else '; offline and PDF included'))

if __name__=='__main__':
    main()
