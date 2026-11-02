/* v2 structure checklist. Kept so restored v2 mock logs stay on the same rules. */

export function v2Feedback(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return `Structure checklist: ${words} words. ${words < 50 ? 'Try adding context, your specific action and an outcome.' : words > 250 ? 'Try a shorter first pass, then offer detail if asked.' : 'A useful length for a first pass.'} ${/\bI\b/i.test(text) ? 'Make sure your personal contribution is specific.' : 'Clarify what you personally did.'} ${/\d|result|outcome|improv|learn|reduc|increas/i.test(text) ? 'Check that your result is truthful and relevant.' : 'Add an observable result or lesson if you have one.'}`;
}
