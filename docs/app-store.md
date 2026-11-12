# Momentum App Store submission draft

Use this copy only after the implemented features, native release build and production privacy policy have been verified. The store's final answers and legal identity belong to Prism's owner. Do not submit placeholders.

## Listing fields

| Field | Draft |
| --- | --- |
| App name | Momentum: Career & Interviews |
| Subtitle | Apply. Prepare. Move forward. |
| Primary category | Productivity |
| Secondary category | Education |
| Keywords | interview,career,jobs,resume,practice,application,offer,negotiation,preparation |
| Promotional text | Turn a job opportunity into your next clear step. Organize your evidence, prepare thoughtful applications, practise the interview and plan your offer conversation. |
| Support URL | Published HTTPS URL of `support.html` |
| Privacy Policy URL | Published HTTPS URL of `privacy.html` |

Confirm name availability and trademark rights before reserving the name. The app name and subtitle are each within Apple's 30-character limits; the keyword draft is within the 100-character limit.

The support and privacy URL cells are required owner inputs, not publishable URLs. Follow [deployment.md](deployment.md) to publish the completed pages with a real operator identity and contact. Keep screenshots and description aligned with the capabilities enabled in the submitted build; a local-only build should not advertise connected AI or public web research.

## Description

Your next career move starts with one clear step.

Momentum helps you turn a job opportunity into a practical plan: understand the role, find your strongest evidence, prepare your application, practise the interview and think through the offer.

START WITH THE OPPORTUNITY
Paste a job description or import a text-based PDF, Word document or text file. Create a focused workspace for each role so your preparation stays connected to the opportunity in front of you.

TELL YOUR STORY CLEARLY
Build your candidate profile and collect real examples of your work. Prepare editable application materials that connect your experience to the role. Review every claim and keep your own voice.

PREPARE WITH PURPOSE
Work through eight structured lessons, capture useful company and interviewer notes, and build answers from your own experience. Make steady progress in short, manageable sessions.

PRACTISE THE CONVERSATION
Run through interview questions, save your answers and review practical structure feedback. Return to unfinished preparation when you are ready.

PLAN THE NEXT STEP
Keep opportunities organized and prepare for the offer conversation. Compare what matters to you and draft a thoughtful response before you send it.

YOUR WORK, UNDER YOUR CONTROL
Core preparation works on your device without an account. Export a backup and remove your local data when you choose. Optional online features explain what they send before you use them.

Momentum helps you prepare; it does not guarantee an interview, offer or employment outcome. Application materials and interview guidance require your review. LinkedIn and Indeed accounts are not connected, and Momentum does not submit job applications on your behalf.

## Screenshots to capture from the release build

Use the actual final screen labels when creating captions. Show fictional example data, never the developer's resume, employer correspondence or credentials. Do not present polished marketing mockups as screenshots of unimplemented features.

1. **Your next move, made clear.** Home and the next recommended action.
2. **One role. A personal plan.** Job intake and the resulting preparation workspace.
3. **Turn experience into evidence.** Candidate profile or editable application material.
4. **Prepare in small steps.** Course lesson with progress and a practical exercise.
5. **Walk in with practice.** Mock interview question and saved feedback.
6. **An offer worth understanding.** Offer comparison, negotiation draft and signing checklist.

Use [Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) for the device families and display sizes actually selected in App Store Connect. Do not claim iPad support without testing it. Keep text legible at thumbnail size and show a complete usable experience without implying a guaranteed hiring result.

## App Review notes for the default local configuration

These notes describe the checked-in default configuration. If a production online service is enabled before submission, update the service paragraph with its actual capabilities and reviewer access instructions.

> Momentum is a career-preparation workspace by Prism. No sign-in, purchase or demo credentials are required for the core experience. A user can paste a job description or import a document, create a saved opportunity, work through eight preparation lessons, record evidence, draft application materials, complete eight text-based interview questions and compare offers. Progress and candidate content are saved on the device. Export, restore and deletion controls are available in Settings & privacy.
>
> Local preparation uses structured rules and guidance. Local feedback is a writing/practice checklist, not a verified assessment of technical skill or a hiring score. Company and interviewer information comes from the user's supplied sources; we do not present invented personal research as fact. External account connections and automated application submission are not included.
>
> No remote AI service is configured in the default app build. Pasted text and local document import work without a service connection. Public job-link import requires the optional import service and provides a paste-text fallback when it is unavailable. Online coaching controls only appear when a connected service reports that capability; they require explicit consent identifying OpenAI and the data being shared. Optional public professional research has a separate availability flag and consent, and displays source links for verification; it is disabled by default.
>
> To review: choose Add an opportunity from Overview and paste a job description, or use Try a sample for fictional example content. Open My profile to add experience. In Interview studio, open Your learning path, save a lesson note, then use Practice interview to answer a question. Application kit contains editable role-specific drafts. Offer coach contains offer comparison and negotiation tools. Open Settings & privacy to export a backup, restore it or delete local data.

Verify these labels and behavior against the signed release build before copying the notes into App Store Connect. Do not tell reviewers a service is available if it has not been deployed.

## Privacy, rating and compliance answers

The local-only build has no advertising SDK, tracking, third-party sign-in, payments or app account. That does not automatically settle all App Store Connect privacy questions: inspect the actual binary, plugins, hosting/service logs and configured online features. Complete the disclosure using `docs/privacy.md` and [Apple's App Privacy guidance](https://developer.apple.com/app-store/app-privacy-details/).

When no user data leaves the device, Apple's definition may allow a “Data Not Collected” disclosure. Do not choose that answer for a build that sends candidate content, identifiers or diagnostic data to a service without reviewing Apple's exceptions and actual retention. A privacy manifest does not replace the App Store privacy answers or the public privacy policy.

Complete the current age-rating questionnaire based on actual capabilities, including any unrestricted web access or generated content. Do not copy an age rating from another career app. Set content rights, availability, copyright owner and EU trader status accurately. Review encryption/export compliance for the exact native build; do not assert an exemption merely because the UI is JavaScript.

No payment flow is included in the first-release plan. If paid digital features or subscriptions are introduced, implement and review the applicable Apple purchase rules before advertising or enabling them.
