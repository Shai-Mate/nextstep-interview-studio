import { jobIdFromUrl, norm } from './text.js';

export function matchPack(packs, input) {
  if (!input || typeof input !== 'object') return null;
  if (input.source === 'pack') return packs.find(pack => pack.id === input.packId) || null;
  if (input.source === 'url') {
    const id = jobIdFromUrl(input.url);
    if (id) return packs.find(pack => (pack.match?.jobIds || []).includes(id)) || null;
    return null;
  }
  const hay = norm(input.text || '');
  if (!hay) return null;
  return packs.find(pack => (pack.match?.phrases || []).every(phrase => hay.includes(norm(phrase)))) || null;
}
