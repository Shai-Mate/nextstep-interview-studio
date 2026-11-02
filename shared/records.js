import { validateProfile } from './schema.js';

export function isV1Record(record) {
  return !!record && record.schema === 1 && typeof record.id === 'string' && typeof record.job === 'string' && Array.isArray(record.course) && record.mock && typeof record.mock === 'object';
}

export function isV2Record(record) {
  return !!record
    && record.schema === 2
    && record.engineVersion === 3
    && typeof record.id === 'string'
    && record.profile
    && record.profile.schema === 'nextstep.role-profile.v1'
    && validateProfile(record.profile).length === 0;
}

export function isRecord(record) {
  return isV1Record(record) || isV2Record(record);
}

export function parseStore(raw) {
  if (raw == null || raw === '') return { ok: true, records: [] };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, records: [] };
  }
  if (!Array.isArray(data) || data.some(record => !isRecord(record))) return { ok: false, records: [] };
  return { ok: true, records: data };
}
