/* User-facing sentences. No em dashes. */

export const messages = {
  badUrl: 'That link is not a public web address. Try a different link.',
  blockedAddress: 'That link points to a private or blocked address. Try the public job link.',
  dnsFailed: 'That link could not be resolved. Try a different link.',
  timeout: 'The job page took too long. Try again.',
  tooLarge: 'That page or text is too large. Use a shorter excerpt or a direct link to one job.',
  badStatus: 'The job page refused the request. Try a different link, or paste the ad text.',
  tooManyRedirects: 'That link redirected too many times. Try the final job link, or paste the ad text.',
  unsupportedType: 'That page is not a readable job post. Paste the ad text instead.',
  loginRequired: 'That page asks you to log in, so the job was not read. Try the public link for the full ad, or paste the ad text.',
  listingOnly: 'That page is a list of jobs, not one vacancy. Open the single job and paste that link.',
  selectionNotFound: 'The selected job was not on that page. Check the link and try again.',
  ambiguous: 'That page does not show one clear vacancy. Open the single job and try again.',
  unreadable: 'No job description was found on that page. Try a different link, or paste the ad text.',
  checkFailed: 'That result did not match the job ad, so it was discarded. Nothing was invented. Try again.',
  modelUnavailable: 'The preparation service could not complete that step. Nothing was saved. Try again.',
  tooLargeRequest: 'That request is too large.',
  badJson: 'Send a JSON object with the job link, the job text, or the file text.',
  rateLimited: 'Too many requests from this network. Wait a few minutes and try again.',
  method: 'Use POST for this step.',
  notFound: 'That step is not available.',
  origin: 'This preparation service does not accept requests from that site.',
  shortText: 'Paste more of the job ad. A short fragment is not enough to build an honest practice.',
  noPack: 'No preparation service is connected, and this job is not one of the saved practice packs. Try a saved pack, or add a service address under Storage & privacy.',
  fileType: 'Use a PDF, DOCX, or TXT file.',
  fileLarge: 'That file is over 5 MB. Paste the text instead.',
  fileEmpty: 'No text was found in that file. Paste the ad text instead.',
  docxUnsupported: 'That Word file could not be read here. Paste the ad text instead.',
  practiceDisclaimer: 'Practice feedback, not a hiring decision.',
  packBanner: 'Saved practice pack on this device. This did not read a live job page.',
  serviceBanner: 'Built from the job text by the preparation service you connected.'
};

const byCode = {
  'bad-url': messages.badUrl,
  'blocked-address': messages.blockedAddress,
  'dns-failed': messages.dnsFailed,
  timeout: messages.timeout,
  'too-large': messages.tooLarge,
  'bad-status': messages.badStatus,
  'too-many-redirects': messages.tooManyRedirects,
  'unsupported-type': messages.unsupportedType,
  'login-required': messages.loginRequired,
  'listing-only': messages.listingOnly,
  'selection-not-found': messages.selectionNotFound,
  ambiguous: messages.ambiguous,
  unreadable: messages.unreadable,
  'check-failed': messages.checkFailed,
  'model-unavailable': messages.modelUnavailable,
  'too-large-request': messages.tooLargeRequest,
  'bad-json': messages.badJson,
  'rate-limited': messages.rateLimited,
  method: messages.method,
  'not-found': messages.notFound,
  origin: messages.origin,
  'short-text': messages.shortText,
  'no-pack': messages.noPack
};

export function messageFor(code) {
  return byCode[code] || messages.checkFailed;
}
