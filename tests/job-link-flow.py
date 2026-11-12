#!/usr/bin/env python3
"""Job-link recovery and success journeys at an iPhone-sized viewport.

Run with MOMENTUM_BASE_URL pointing to the current preview. Services are mocked
so blocked job sites and a missing backend are deterministic regressions.
"""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("MOMENTUM_BASE_URL", "http://127.0.0.1:4173").rstrip("/")
ARTIFACTS = Path(__file__).resolve().parents[1] / "test-results/job-link"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
JOB_URL = "https://ca.indeed.com/viewjob?jk=fictional-test-job"
JOB_TEXT = "Customer Success Specialist at Example Company. Help customers get started, manage onboarding, document progress, communicate clearly and collaborate with the support team. Customer service experience required."


def open_intake(browser, response):
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, service_workers="block")
    context.route("**/api/health", lambda route: route.fulfill(json={"capabilities": {"jobImport": True, "aiCoach": False}}))
    context.route("**/api/import-job", response)
    page = context.new_page()
    page.goto(BASE)
    page.get_by_role("button", name="Add an opportunity", exact=True).click()
    dialog = page.get_by_role("dialog", name="Your next opportunity")
    return context, page, dialog


def import_link(dialog):
    dialog.get_by_role("tab", name="Job link", exact=True).click()
    dialog.get_by_role("textbox", name="Link to the job ad", exact=True).fill(JOB_URL)
    dialog.get_by_role("button", name="Import job description", exact=True).click()


def check_layout(page):
    widths = page.evaluate("({viewport:innerWidth,content:document.documentElement.scrollWidth})")
    assert widths["content"] <= widths["viewport"], widths


def missing_service(browser):
    context, page, dialog = open_intake(browser, lambda route: route.fulfill(status=404, content_type="text/html", body="<html>Not found</html>"))
    dialog.get_by_role("textbox", name=re.compile("^Job description")).fill(JOB_TEXT)
    import_link(dialog)
    expect(dialog.get_by_role("alert")).to_contain_text("Link importing is temporarily unavailable")
    expect(dialog.get_by_role("alert")).not_to_contain_text("This site needs you")
    expect(dialog.get_by_role("link", name="Open job page")).to_have_attribute("href", JOB_URL)
    dialog.get_by_role("button", name="Paste description instead").click()
    description = dialog.get_by_role("textbox", name=re.compile("^Job description"))
    expect(description).to_have_value(JOB_TEXT)
    expect(description).to_be_focused()
    dialog.get_by_role("tab", name="Job link", exact=True).click()
    expect(dialog.get_by_role("textbox", name="Link to the job ad", exact=True)).to_have_value(JOB_URL)
    check_layout(page)
    context.close()
    print("PASS missing service: recovery preserves draft and source link", flush=True)


def blocked_site(browser):
    context, page, dialog = open_intake(browser, lambda route: route.fulfill(status=422, json={"error": {"code": "SITE_BLOCKED", "message": "This job site requires a browser or sign-in to view the description."}}))
    import_link(dialog)
    expect(dialog.get_by_role("alert")).to_contain_text("This site needs you to open the job page")
    expect(dialog.get_by_role("alert")).not_to_contain_text("Link importing is temporarily unavailable")
    check_layout(page)
    page.screenshot(path=str(ARTIFACTS / "blocked-site-iphone.png"), full_page=True)
    dialog.get_by_role("button", name="Paste description instead").click()
    dialog.get_by_role("textbox", name=re.compile("^Job description")).fill(JOB_TEXT)
    dialog.get_by_role("button", name="Continue", exact=False).click()
    dialog.get_by_role("textbox", name="Job title", exact=True).fill("Customer Success Specialist")
    dialog.get_by_role("textbox", name="Company", exact=True).fill("Example Company")
    dialog.get_by_role("button", name="Create my plan", exact=False).click()
    expect(dialog).not_to_be_visible()
    stored = page.evaluate("JSON.parse(localStorage.getItem('prism.workspace.v1'))")
    serialized = json.dumps(stored)
    assert JOB_URL in serialized, "Source link was lost when creating from pasted text"
    assert JOB_TEXT in serialized, "Pasted description was lost"
    context.close()
    print("PASS blocked site: clear recovery creates a plan with the original source", flush=True)


def imported_job(browser):
    context, page, dialog = open_intake(browser, lambda route: route.fulfill(json={"job": {"text": JOB_TEXT, "role": "Customer Success Specialist", "company": "Example Company", "url": JOB_URL}, "warnings": ["Review the imported text before continuing."]}))
    import_link(dialog)
    expect(dialog.get_by_role("textbox", name=re.compile("^Job description"))).to_have_value(JOB_TEXT)
    expect(dialog.get_by_role("alert")).not_to_be_visible()
    dialog.get_by_role("button", name="Continue", exact=False).click()
    expect(dialog.get_by_role("textbox", name="Job title", exact=True)).to_have_value("Customer Success Specialist")
    expect(dialog.get_by_role("textbox", name="Company", exact=True)).to_have_value("Example Company")
    check_layout(page)
    context.close()
    print("PASS supported job link: imported text and role details remain reviewable", flush=True)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    missing_service(browser)
    blocked_site(browser)
    imported_job(browser)
    browser.close()
