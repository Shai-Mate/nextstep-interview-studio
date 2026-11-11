#!/usr/bin/env python3
"""Regression checks for résumé import races; uses a controlled local file-read delay."""
import os
import re
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('MOMENTUM_BASE_URL', 'http://127.0.0.1:4173').rstrip('/')
IMPORTED = 'Imported résumé: I coordinated customer onboarding and documented our team handover process.'
CURRENT = 'My latest handwritten résumé notes must not be silently replaced by an older upload.'


def start_import(page, suffix):
    page.get_by_label('Import résumé document').set_input_files({
        'name': f'delayed-resume-{suffix}.txt',
        'mimeType': 'text/plain',
        'buffer': IMPORTED.encode(),
    })
    page.wait_for_function('window.pendingFileReads.length === 1')
    expect(page.get_by_role('button', name='Reading your document…', exact=True)).to_be_disabled()


def release_import(page):
    page.evaluate('async () => { await window.pendingFileReads.shift()(); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }')


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, service_workers='block')
    context.add_init_script('''
      window.pendingFileReads = [];
      const originalText = File.prototype.text;
      File.prototype.text = function(...args) {
        const result = originalText.apply(this, args);
        if (!this.name.startsWith('delayed-resume-')) return result;
        return new Promise((resolve, reject) => {
          window.pendingFileReads.push(() => result.then(resolve, reject));
        });
      };
    ''')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'{BASE}/#profile')
    resume = page.get_by_role('textbox', name='Résumé or career notes', exact=True)
    name = page.get_by_role('textbox', name=re.compile('^Your name'))
    resume.fill('Initial career notes with enough detail for a meaningful résumé import test.')
    name.fill('Original name')

    # Keep new résumé edits; the parser result requires an explicit choice.
    start_import(page, 'keep')
    resume.fill(CURRENT)
    name.fill('Updated while parsing')
    release_import(page)
    review = page.get_by_role('group', name='Review imported résumé', exact=True)
    expect(review).to_be_visible()
    expect(resume).to_have_value(CURRENT)
    expect(name).to_have_value('Updated while parsing')
    review.get_by_text('Review imported text', exact=True).click()
    expect(review.get_by_role('textbox', name='Imported résumé preview', exact=True)).to_have_value(IMPORTED)
    review.get_by_role('button', name='Keep my current résumé', exact=True).click()
    expect(review).not_to_be_visible()
    expect(resume).to_have_value(CURRENT)

    # Explicitly applying a staged import preserves other newer profile details.
    start_import(page, 'apply')
    resume.fill(CURRENT + ' More recent edits.')
    name.fill('Newest profile name')
    release_import(page)
    review.get_by_role('button', name='Use imported résumé', exact=True).click()
    expect(resume).to_have_value(IMPORTED)
    expect(name).to_have_value('Newest profile name')

    # A detached screen cannot write stale results over a newly mounted profile.
    start_import(page, 'unmount')
    page.evaluate("location.hash='home'")
    expect(page.get_by_role('button', name='Add an opportunity', exact=True)).to_be_visible()
    page.evaluate("location.hash='profile'")
    resume.fill(CURRENT + ' After navigating back.')
    name.fill('After navigation')
    release_import(page)
    expect(resume).to_have_value(CURRENT + ' After navigating back.')
    expect(name).to_have_value('After navigation')
    expect(review).to_have_count(0)

    # Clearing the workspace during a pending read must not resurrect private data.
    start_import(page, 'delete')
    page.evaluate("location.hash='settings'")
    page.get_by_role('button', name='Delete all my data', exact=True).click()
    dialog = page.get_by_role('dialog', name='Delete your Momentum workspace?', exact=True)
    dialog.get_by_role('textbox', name='Type DELETE to confirm', exact=True).fill('DELETE')
    dialog.get_by_role('button', name='Delete all my data', exact=True).click()
    expect(dialog).not_to_be_visible()
    release_import(page)
    page.evaluate("location.hash='profile'")
    expect(resume).to_have_value('')
    expect(name).to_have_value('')
    saved = page.evaluate("JSON.parse(localStorage.getItem('prism.workspace.v1')).profile")
    assert saved['resume'] == '' and saved['name'] == ''
    assert not errors, errors
    browser.close()
print('PASS: delayed résumé imports preserve edits, require review on conflict, retain other profile changes, ignore unmounted results and cannot restore deleted data.')
