import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { packs } from '../fixtures/packs.js';
import { importBackup, exportEnvelope } from '../shared/backup.js';
import { extractDocxText } from '../shared/docx.js';
import { matchPack } from '../shared/fixture-match.js';
import { checkPlanCatalog, checkProfileAgainstSource } from '../shared/grounding.js';
import { messages } from '../shared/messages.js';
import { onboardingQuestions } from '../shared/onboarding.js';
import { applyAnswers } from '../shared/plan-path.js';
import { parseStore } from '../shared/records.js';
import { validateProfile } from '../shared/schema.js';
import { gradeAnswer } from '../shared/grade-rubric.js';
import { jobIdFromUrl } from '../shared/text.js';

const root = path.resolve(import.meta.dirname, '..');
const trnt = packs.find(pack => pack.id === 'trnt-4cc1eae081ce53ed');
const backend = packs.find(pack => pack.id === 'senior-backend-engineer');
const retail = packs.find(pack => pack.id === 'retail-store-manager');

function tokens(value) {
  return new Set(String(value).toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 4));
}

function jaccard(a, b) {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

describe('reviewed fixture and packs', () => {
  it('accepts the reviewed TRNT role file and keeps the pack aligned with it', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/trnt-4cc1eae081ce53ed.role.json'), 'utf8'));
    assert.deepEqual(validateProfile(fixture), []);
    assert.equal(trnt.profile.company, fixture.company);
    assert.equal(trnt.profile.title, fixture.title);
    assert.deepEqual(trnt.profile.competencies.map(item => item.evidence), fixture.competencies.map(item => item.evidence));
    assert.equal(trnt.profile.seniority, null);
  });

  it('keeps three packs grounded and materially different', () => {
    const blobs = [];
    for (const pack of packs) {
      assert.deepEqual(validateProfile(pack.profile), [], pack.id);
      assert.deepEqual(checkPlanCatalog(pack.catalog, pack.profile), [], pack.id);
      assert.deepEqual(checkProfileAgainstSource(pack.profile, pack.sampleAd), [], pack.id);
      blobs.push(tokens(pack.catalog.lessons.map(lesson => `${lesson.objective}\n${lesson.body}\n${lesson.example}`).join('\n')));
    }
    assert.ok(jaccard(blobs[0], blobs[1]) < 0.2, `trnt/backend overlap ${jaccard(blobs[0], blobs[1])}`);
    assert.ok(jaccard(blobs[0], blobs[2]) < 0.2, `trnt/retail overlap ${jaccard(blobs[0], blobs[2])}`);
    assert.ok(jaccard(blobs[1], blobs[2]) < 0.2, `backend/retail overlap ${jaccard(blobs[1], blobs[2])}`);
    const titles = packs.map(pack => pack.catalog.lessons.map(lesson => lesson.title).join('|'));
    assert.equal(new Set(titles).size, 3);
  });

  it('changes the lesson and practice path when the answers change', () => {
    const focused = applyAnswers(backend.catalog, {
      focus: 'incident-response', weak: 'mentoring', experience: 'experienced', stage: 'skills', time: '15', tool: 'Go'
    }, backend.profile);
    const broad = applyAnswers(backend.catalog, {
      focus: 'posting-service', weak: 'idempotent-consumers', experience: 'career-change', stage: 'screening', time: '60', tool: 'Kafka'
    }, backend.profile);
    assert.equal(focused.lessons[0].competencyId, 'incident-response');
    assert.equal(focused.lessons[0].depth, 'deep');
    assert.equal(focused.lessons.length < broad.lessons.length, true);
    assert.equal(broad.lessons[0].competencyId, 'posting-service');
    assert.equal(broad.lessons[0].body.includes('Draw the states'), true);
    assert.equal(focused.lessons.some(lesson => lesson.kind === 'transfer'), false);
    assert.equal(broad.lessons.some(lesson => lesson.kind === 'transfer'), true);
    assert.equal(broad.lessons.some(lesson => lesson.stage === 'screening'), true);
    assert.equal(focused.lessons.some(lesson => lesson.stage === 'screening'), false);
    assert.equal(broad.assumedTool, 'Kafka');
    assert.equal(broad.scenarios.some(scene => scene.id === 'scene-double-post'), true);
    assert.notEqual(focused.quiz[0].competencyId, broad.quiz[0].competencyId);
  });

  it('asks different multiple-choice questions for different roles', () => {
    const mentor = onboardingQuestions(trnt.profile);
    const store = onboardingQuestions(retail.profile);
    const service = onboardingQuestions(backend.profile);
    assert.ok(mentor.length >= 4 && mentor.length <= 6);
    assert.ok(store.length >= 4 && store.length <= 6);
    assert.equal(service.length, 6);
    assert.equal(service.some(question => question.id === 'tool'), true);
    assert.equal(store.some(question => question.id === 'tool'), false);
    const mentorLabels = mentor.flatMap(question => question.options.map(option => option.label)).join(' ');
    const storeLabels = store.flatMap(question => question.options.map(option => option.label)).join(' ');
    assert.match(mentor[0].prompt, /AI Innovation & Entrepreneurship Mentor/);
    assert.match(store[0].prompt, /Store Manager/);
    assert.match(mentorLabels, /Workshop design/);
    assert.match(storeLabels, /Shrink and inventory/);
    assert.equal(mentorLabels === storeLabels, false);
  });

  it('matches the selected Indeed id and not a different job on the same search URL', () => {
    const selected = 'https://ca.indeed.com/m/jobs?q=AI&l=Vancouver%2C+BC&vjk=4cc1eae081ce53ed';
    const share = 'https://ca.indeed.com/viewjob?jk=4cc1eae081ce53ed&from=appshareandroid';
    const other = 'https://ca.indeed.com/viewjob?jk=aaaaaaaaaaaaaaaa';
    const listing = 'https://ca.indeed.com/jobs?q=TRNT+Educational+Institute';
    assert.equal(jobIdFromUrl(selected), '4cc1eae081ce53ed');
    assert.equal(matchPack(packs, { source: 'url', url: selected })?.id, trnt.id);
    assert.equal(matchPack(packs, { source: 'url', url: share })?.id, trnt.id);
    assert.equal(matchPack(packs, { source: 'url', url: other }), null);
    assert.equal(matchPack(packs, { source: 'url', url: listing }), null);
    assert.equal(matchPack(packs, { source: 'text', text: retail.sampleAd })?.id, retail.id);
    assert.equal(matchPack(packs, { source: 'text', text: 'A generic help desk role with phones and tickets.' }), null);
  });
});

describe('grading and old preparations', () => {
  it('does not treat a long unrelated answer as evidence for the competency', () => {
    const cooking = 'I baked a cake and then I baked another cake and I kept talking about icing sugar butter and candles for a very long time without ever mentioning a ledger transfer or a customer.';
    const specific = 'I designed the posting API so both sides of a transfer committed together. I checked the unique transfer id because a retry could post twice, and the risk was an inconsistent balance if the credit landed without the debit.';
    const competency = backend.profile.competencies[0];
    const weak = gradeAnswer({ answer: cooking, competencies: [competency] }).competencies[0];
    const strong = gradeAnswer({ answer: specific, competencies: [competency] }).competencies[0];
    assert.ok(weak.score <= 2);
    assert.ok(strong.score >= 3);
    assert.equal(weak.feedback.includes(weak.evidenceQuote), true);
    assert.equal(cooking.includes(weak.evidenceQuote.slice(0, 24)), true);
  });

  it('still loads a v2 preparation and does not require it to become v3', async () => {
    await import('../engine.js');
    const created = globalThis.PrepEngine.create({
      company: 'Old Co',
      role: 'Support lead',
      job: 'Answer customer calls, write weekly reports, and coach two new agents on the weekend roster.',
      intake: { experience: 'Experienced', stage: 'Screening', focus: 'Balanced', time: '30 minutes' }
    });
    assert.equal(created.schema, 1);
    created.notes = { 'lesson-0': 'A real note' };
    const v3 = {
      schema: 2,
      engineVersion: 3,
      id: 'role-1',
      profile: trnt.profile,
      plan: applyAnswers(trnt.catalog, { focus: 'workshop-design', weak: 'unsure', experience: 'experienced', stage: 'skills', time: '30' }, trnt.profile),
      notes: {}
    };
    const parsed = parseStore(JSON.stringify([created, v3]));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.records[0].schema, 1);
    assert.equal(parsed.records[1].schema, 2);
    assert.equal(parseStore(JSON.stringify([{ schema: 1, id: 'broken' }])).ok, false);
    const envelope = exportEnvelope([created]);
    assert.equal(envelope.schema, 1);
    const copies = importBackup(envelope, input => globalThis.PrepEngine.create(input));
    assert.equal(copies[0].schema, 1);
    assert.equal(copies[0].notes['lesson-0'], 'A real note');
    assert.notEqual(copies[0].id, created.id);
    const mixed = exportEnvelope([created, v3]);
    assert.equal(mixed.schema, 2);
    const restored = importBackup(mixed, input => globalThis.PrepEngine.create(input));
    assert.equal(restored[0].schema, 1);
    assert.equal(restored[1].schema, 2);
    assert.equal(restored[1].profile.title, trnt.profile.title);
    assert.notEqual(restored[1].id, v3.id);
  });
});

describe('files and release hygiene', () => {
  it('reads DOCX text and refuses a document that claims to be huge', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Store Manager at Harbor &amp; Co. Run the opening checklist.</w:t></w:r></w:p></w:body></w:document>`;
    const text = await extractDocxText(zip([{ name: 'word/document.xml', data: Buffer.from(xml), method: 8 }]));
    assert.match(text, /Harbor & Co\./);
    assert.match(text, /opening checklist/);
    await assert.rejects(() => extractDocxText(zip([{ name: 'word/document.xml', data: Buffer.from(xml), method: 0, uncomp: 9_000_000 }])));
    await assert.rejects(() => extractDocxText(zip([{ name: '../word/document.xml', data: Buffer.from(xml), method: 0 }])));
  });

  it('ships no account id and no em dashes in the interface copy', () => {
    const toml = fs.readFileSync(path.join(root, 'worker/wrangler.toml'), 'utf8');
    assert.doesNotMatch(toml, /account_id/i);
    assert.doesNotMatch(toml, /api_token/i);
    assert.match(toml, /binding = "AI"/);
    const files = ['app.js', 'legacy.js', 'index.html', 'ui.js', 'api.js', 'files.js', 'shared/messages.js', 'shared/onboarding.js', 'README.md'];
    for (const file of files) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      assert.equal(text.includes('\u2014'), false, file);
    }
    for (const value of Object.values(messages)) assert.equal(String(value).includes('\u2014'), false);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(sw, /nextstep-phone-v3/);
    assert.doesNotMatch(sw, /nextstep-phone-v2/);
  });
});

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const stored = file.method === 8 ? deflateRawSync(file.data) : file.data;
    const method = file.method === 8 ? 8 : 0;
    const crc = crc32(file.data);
    const uncomp = file.uncomp || file.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(uncomp, 22);
    local.writeUInt16LE(name.length, 26);
    const localHeaderOffset = offset;
    const localBytes = Buffer.concat([local, name, stored]);
    locals.push(localBytes);
    offset += localBytes.length;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(uncomp, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localHeaderOffset, 42);
    centrals.push(Buffer.concat([central, name]));
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}
