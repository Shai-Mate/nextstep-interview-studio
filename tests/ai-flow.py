#!/usr/bin/env python3
"""UI contracts with an explicitly mocked AI provider; never verifies a live model."""
import copy
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('MOMENTUM_BASE_URL', 'http://127.0.0.1:4173').rstrip('/')
ARTIFACTS = Path(__file__).resolve().parents[1] / 'test-results'
ARTIFACTS.mkdir(exist_ok=True)
requests = []
capabilities = {'jobImport': True, 'aiCoach': True, 'webResearch': True}
TITLES = {
    'research': 'Fixture research brief',
    'course': 'Fixture lesson advice',
    'application': 'Fixture application advice',
    'negotiation': 'Fixture negotiation advice',
}
RESULT = {
    'provider': 'openai',
    'result': {
        'title': 'Fixture research brief',
        'summary': 'This test response exercises consent and saved coaching. It is not live advice.',
        'sections': [{'title': 'A useful question', 'body': 'Ask how the customer team measures successful onboarding.', 'bullets': ['Verify the supplied evidence before using a claim.']}],
        'nextSteps': ['Review the details.'],
    },
    'sources': [{'title': 'Example company team — test fixture', 'url': 'https://example.com/team'}, {'title': 'Unsafe fixture link', 'url': 'javascript:alert(1)'}],
}


def mock_health(route):
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'capabilities': capabilities}))


def mock_coach(route):
    payload = route.request.post_data_json
    requests.append(payload)
    response = copy.deepcopy(RESULT)
    response['result']['title'] = TITLES.get(payload['action'], 'Fixture coaching advice')
    if payload['action'] != 'research':
        response['sources'] = []
    route.fulfill(status=200, content_type='application/json', body=json.dumps(response))


def generate(page, label, expected_title):
    page.get_by_role('button', name=label, exact=True).click()
    dialog = page.get_by_role('dialog', name='An extra perspective')
    consent = dialog.get_by_role('checkbox', name='I agree to send these details to OpenAI for this request.', exact=True)
    expect(consent).not_to_be_checked()
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_disabled()
    consent.check()
    dialog.get_by_role('button', name='Get suggestions', exact=True).click()
    expect(dialog.get_by_role('heading', name=expected_title, exact=True)).to_be_visible()
    return dialog


def save_note(page, dialog, title):
    dialog.get_by_role('button', name='Save coaching note', exact=False).click()
    expect(dialog).not_to_be_visible()
    expect(page.get_by_role('heading', name='Saved coaching notes', exact=True)).to_be_visible()
    expect(page.get_by_text(title, exact=True)).to_be_visible()


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    context.route('**/api/health', mock_health)
    context.route('**/api/coach', mock_coach)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.get_by_role('button', name='Try a sample', exact=True).click()

    # Research is opt-in twice: network coaching and public web research.
    page.get_by_role('tab', name='Know the people').click()
    page.get_by_role('textbox', name='Interviewer’s name', exact=True).fill('Jordan Example')
    page.get_by_role('textbox', name='Company research & sources', exact=True).fill('Original notes supplied by the candidate. Source: fictional sample job.')
    page.get_by_role('button', name='Find connections in my research', exact=True).click()
    dialog = page.get_by_role('dialog', name='An extra perspective')
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_disabled()
    web = dialog.get_by_role('checkbox', name='Research public professional sources on the web.', exact=True)
    consent = dialog.get_by_role('checkbox', name='I agree to send these details to OpenAI for this request.', exact=True)
    expect(web).not_to_be_checked()
    expect(consent).not_to_be_checked()
    assert requests == [], 'Opening the dialog must not send candidate information.'
    consent.check()
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_enabled()
    web.check()
    expect(consent).not_to_be_checked()
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_disabled()
    assert requests == [], 'Changing the research option must not submit a request.'
    consent.check()
    dialog.get_by_role('button', name='Get suggestions', exact=True).click()
    expect(dialog.get_by_role('heading', name=TITLES['research'])).to_be_visible()
    assert len(requests) == 1
    request = requests[-1]
    assert request['action'] == 'research' and request['consent'] is True and request['webResearch'] is True
    assert 'profile' not in request and 'answer' not in request
    assert request['context']['interviewer']['name'] == 'Jordan Example'
    source = dialog.get_by_role('link', name='Example company team — test fixture', exact=False)
    expect(source).to_have_attribute('href', 'https://example.com/team')
    assert dialog.locator('a[href^="javascript:"]').count() == 0
    page.screenshot(path=str(ARTIFACTS / 'mobile-ai-fixture-result.png'), full_page=True)
    dialog.get_by_role('button', name='Save to my notes', exact=False).click()
    expect(dialog).not_to_be_visible()
    notes = page.get_by_role('textbox', name='Company research & sources', exact=True)
    expect(notes).to_have_value(re.compile('Original notes supplied by the candidate'))
    expect(notes).to_have_value(re.compile(TITLES['research']))
    expect(notes).to_have_value(re.compile('https://example.com/team'))
    page.reload()
    page.get_by_role('tab', name='Know the people').click()
    expect(page.get_by_role('textbox', name='Company research & sources', exact=True)).to_have_value(re.compile(TITLES['research']))

    # The actual selected lesson and learner notes are sent, and saved coaching persists.
    page.get_by_role('tab', name='Your learning path', exact=True).click()
    lesson_title = page.locator('.lesson-content h2').inner_text()
    lesson_notes = 'My real example: I documented a recurring handover issue and tested a checklist with my team.'
    page.get_by_role('textbox', name=re.compile('Your working notes')).fill(lesson_notes)
    dialog = generate(page, 'Personalize with AI', TITLES['course'])
    request = requests[-1]
    assert request['action'] == 'course'
    assert request['context']['lesson']['title'] == lesson_title
    assert request['context']['lesson']['content'] and request['context']['lesson']['exercise']
    assert request['context']['lessonNotes'] == lesson_notes
    save_note(page, dialog, TITLES['course'])
    page.reload()
    expect(page.get_by_text(TITLES['course'], exact=True)).to_be_visible()

    # Changing the lesson invalidates the preceding response and requires fresh consent.
    page.locator('.lesson-list button').nth(1).click()
    next_lesson = page.locator('.lesson-content h2').inner_text()
    assert next_lesson != lesson_title
    page.get_by_role('button', name='Personalize with AI', exact=True).click()
    dialog = page.get_by_role('dialog', name='An extra perspective')
    expect(dialog.get_by_role('heading', name=TITLES['course'], exact=True)).to_have_count(0)
    expect(dialog.get_by_role('checkbox', name='I agree to send these details to OpenAI for this request.', exact=True)).not_to_be_checked()
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_disabled()
    dialog.get_by_role('checkbox', name='I agree to send these details to OpenAI for this request.', exact=True).check()
    dialog.get_by_role('button', name='Get suggestions', exact=True).click()
    expect(dialog.get_by_role('heading', name=TITLES['course'], exact=True)).to_be_visible()
    assert requests[-1]['context']['lesson']['title'] == next_lesson
    request_count = len(requests)
    dialog.get_by_role('button', name='Start a new request', exact=True).click()
    expect(dialog.get_by_role('checkbox', name='I agree to send these details to OpenAI for this request.', exact=True)).not_to_be_checked()
    expect(dialog.get_by_role('button', name='Get suggestions', exact=True)).to_be_disabled()
    assert len(requests) == request_count
    dialog.get_by_role('button', name='Close dialog', exact=True).click()

    # Application coaching includes the current edited draft, not unrelated profile drafts.
    page.goto(f'{BASE}/#applications')
    page.get_by_role('button', name='Cover letter', exact=True).click()
    current_letter = 'My existing cover letter contains a real project achievement that should be preserved.'
    page.get_by_role('textbox', name='Edit a letter with a reason to read on.', exact=True).fill(current_letter)
    dialog = generate(page, 'Refine with AI', TITLES['application'])
    request = requests[-1]
    assert request['action'] == 'application'
    assert request['context']['focus'] == 'letter'
    assert request['context']['currentDrafts']['coverLetter'] == current_letter
    assert 'kitDrafts' not in request['profile'] and 'coaching' not in request['profile']
    assert 'offers' not in request and 'opportunities' not in request
    save_note(page, dialog, TITLES['application'])
    page.reload()
    expect(page.get_by_text(TITLES['application'], exact=True)).to_be_visible()
    expect(page.get_by_text(TITLES['course'], exact=True)).to_be_visible()

    # Negotiation coaching sends only this offer, with an unambiguous annual basis.
    page.goto(f'{BASE}/#offers')
    page.get_by_role('button', name='Add an offer', exact=True).click()
    page.get_by_role('textbox', name='Company', exact=True).fill('Fixture Company')
    page.get_by_role('textbox', name='Role', exact=True).fill('Customer success manager')
    page.get_by_role('combobox', name='Base salary is quoted', exact=True).select_option('month')
    page.get_by_role('spinbutton', name=re.compile('^Base salary')).fill('5000')
    page.get_by_role('spinbutton', name=re.compile('^Your target salary')).fill('5500')
    page.get_by_role('spinbutton', name=re.compile('^Target annual bonus')).fill('5000')
    page.get_by_role('spinbutton', name=re.compile('^Estimated annual equity')).fill('10000')
    page.get_by_role('textbox', name='What would make this offer work for you?', exact=True).fill('A flexible schedule and a clearer progression path.')
    page.get_by_role('button', name='Save offer', exact=True).click()
    counter_draft = 'Thank you for the offer. Could we discuss a monthly base salary of $5,500 and a flexible schedule?'
    page.get_by_role('textbox', name='Edit your negotiation message', exact=True).fill(counter_draft)
    dialog = generate(page, 'Prepare my negotiation with AI', TITLES['negotiation'])
    request = requests[-1]
    assert request['action'] == 'negotiation'
    assert 'profile' not in request and 'job' not in request
    offer_context = request['context']['offer']
    assert offer_context['company'] == 'Fixture Company'
    assert offer_context['annualBase'] == 60000 and offer_context['targetAnnualSalary'] == 66000
    assert offer_context['targetAnnualBonus'] == 5000 and offer_context['estimatedAnnualEquity'] == 10000
    assert request['context']['currentNegotiationDraft'] == counter_draft
    assert 'offers' not in request['context'] and 'opportunities' not in request['context']
    save_note(page, dialog, TITLES['negotiation'])
    page.reload()
    expect(page.get_by_text(TITLES['negotiation'], exact=True)).to_be_visible()

    # Saved notes stay readable when the optional service is unavailable, including offline navigation.
    capabilities['aiCoach'] = False
    page.reload()
    expect(page.get_by_role('button', name='Prepare my negotiation with AI', exact=True)).to_have_count(0)
    expect(page.get_by_text(TITLES['negotiation'], exact=True)).to_be_visible()
    context.set_offline(True)
    page.evaluate("location.hash='applications'")
    expect(page.get_by_text(TITLES['application'], exact=True)).to_be_visible()
    expect(page.get_by_text(TITLES['course'], exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Refine with AI', exact=True)).to_have_count(0)
    page.evaluate("location.hash='offers'")
    expect(page.get_by_text(TITLES['negotiation'], exact=True)).to_be_visible()
    saved_note = page.locator('.coaching-note').filter(has_text=TITLES['negotiation'])
    saved_note.locator('summary').click()
    page.locator('.coaching-library').evaluate('(node) => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 20)')
    page.screenshot(path=str(ARTIFACTS / 'mobile-saved-coaching-note.png'), full_page=False)
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.locator('.coaching-library').evaluate('(node) => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 20)')
    page.screenshot(path=str(ARTIFACTS / 'desktop-saved-coaching-note.png'), full_page=False)
    assert not errors, errors
    browser.close()
print('PASS: mocked AI consent, public research, safe citations, lesson context and reset, saved lesson/application/offer notes, scoped requests, annual offer terms, reload persistence and offline availability. No live provider call was made.')
