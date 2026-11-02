export function parseModelJson(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (text.length > 100000) return { ok: false };
  const start = text.indexOf('{');
  if (start < 0) return { ok: false };
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return { ok: true, value: JSON.parse(text.slice(start, index + 1)) };
        } catch {
          return { ok: false };
        }
      }
    }
  }
  return { ok: false };
}

export async function generateValidated({ adapter, system, user, validate }) {
  let errors = ['Response was not JSON'];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = attempt === 0
      ? user
      : `${user}\n\nThe previous JSON failed independent checks:\n${errors.map(error => `- ${error}`).join('\n')}\nReturn corrected JSON only. Do not claim the checks passed.`;
    let raw = '';
    try {
      raw = await adapter.complete({ system, user: prompt });
    } catch {
      const error = new Error('model-unavailable');
      error.code = 'model-unavailable';
      error.status = 503;
      throw error;
    }
    const parsed = parseModelJson(raw);
    if (!parsed.ok) {
      errors = ['Response was not JSON'];
      continue;
    }
    errors = validate(parsed.value) || [];
    if (!errors.length) return parsed.value;
  }
  const error = new Error('check-failed');
  error.code = 'check-failed';
  error.status = 422;
  throw error;
}
