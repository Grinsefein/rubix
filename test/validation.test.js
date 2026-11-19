'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { validateSubmission, validateReport, todayIso } = require('../validation');

function validBody(overrides = {}) {
  return {
    solver: 'Felix Weber',
    time: '12.345',
    solvedAt: '2026-01-15',
    videoUrl: '',
    note: '',
    witnesses: ['Mara Klein', 'Jonas Fischer'],
    ...overrides,
  };
}

test('validateSubmission accepts a valid submission', () => {
  const result = validateSubmission(validBody());
  assert.equal(result.fields, undefined);
  assert.equal(result.data.solver, 'Felix Weber');
  assert.equal(result.data.timeMs, 12345);
  assert.deepEqual(result.data.witnesses, ['Mara Klein', 'Jonas Fischer']);
});

test('validateSubmission trims names and removes duplicate witnesses', () => {
  const result = validateSubmission(
    validBody({ solver: '  Felix   Weber ', witnesses: [' Mara Klein ', 'mara  klein'] })
  );
  assert.equal(result.data.solver, 'Felix Weber');
  assert.deepEqual(result.data.witnesses, ['Mara Klein']);
});

test('validateSubmission rejects the solver as their own witness', () => {
  const result = validateSubmission(validBody({ witnesses: ['felix weber'] }));
  assert.match(result.fields.witnesses, /yourself/);
});

test('validateSubmission rejects future and invalid dates', () => {
  assert.ok(validateSubmission(validBody({ solvedAt: '2999-01-01' })).fields.solvedAt);
  assert.ok(validateSubmission(validBody({ solvedAt: '2026-02-31' })).fields.solvedAt);
});

test('validateSubmission rejects bad times and URLs', () => {
  assert.ok(validateSubmission(validBody({ time: '0.5' })).fields.time);
  assert.ok(validateSubmission(validBody({ time: 'hello' })).fields.time);
  assert.ok(
    validateSubmission(validBody({ videoUrl: 'javascript:alert(1)' })).fields.videoUrl
  );
  assert.ok(validateSubmission(validBody({ solvedAt: todayIso() })).data);
});

test('validateReport accepts known reasons and requires other notes', () => {
  const valid = validateReport({ reason: 'fake_time', note: '' });
  assert.equal(valid.data.reason, 'fake_time');

  const invalid = validateReport({ reason: 'other', note: '' });
  assert.ok(invalid.fields.note);

  const unknown = validateReport({ reason: 'whatever' });
  assert.ok(unknown.fields.reason);
});
