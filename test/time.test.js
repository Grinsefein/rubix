'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTimeToMs, formatTimeMs } = require('../time');

test('parseTimeToMs accepts common WCA formats', () => {
  assert.equal(parseTimeToMs('12.345'), 12345);
  assert.equal(parseTimeToMs('12,345'), 12345);
  assert.equal(parseTimeToMs('12.34'), 12340);
  assert.equal(parseTimeToMs('12'), 12000);
  assert.equal(parseTimeToMs('62.4'), 62400);
  assert.equal(parseTimeToMs('1:02.345'), 62345);
  assert.equal(parseTimeToMs('1:2.3'), 62300);
  assert.equal(parseTimeToMs('0:59.999'), 59999);
  assert.equal(parseTimeToMs(' 1:00,5 '), 60500);
  assert.equal(parseTimeToMs('12.345s'), 12345);
});

test('parseTimeToMs rejects invalid values', () => {
  assert.equal(parseTimeToMs(''), null);
  assert.equal(parseTimeToMs('abc'), null);
  assert.equal(parseTimeToMs('12.3456'), null);
  assert.equal(parseTimeToMs('1:75.000'), null);
  assert.equal(parseTimeToMs('0.999'), null);
  assert.equal(parseTimeToMs('100.000'), null);
  assert.equal(parseTimeToMs('1:02:03'), null);
  assert.equal(parseTimeToMs(-12345), null);
});

test('formatTimeMs renders WCA-style times', () => {
  assert.equal(formatTimeMs(12345), '12.345');
  assert.equal(formatTimeMs(9999), '9.999');
  assert.equal(formatTimeMs(59999), '59.999');
  assert.equal(formatTimeMs(60000), '1:00.000');
  assert.equal(formatTimeMs(62345), '1:02.345');
  assert.equal(formatTimeMs(3600000), '60:00.000');
});
