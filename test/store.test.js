'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbPath = path.join(
  os.tmpdir(),
  `rubix-store-test-${process.pid}-${Date.now()}.db`
);
process.env.RUBIX_DB_PATH = dbPath;

const { db } = require('../db');
const store = require('../store');

function entry(overrides = {}) {
  return {
    event: '333',
    solver: 'Event Tester',
    timeMs: 12500,
    solvedAt: '2026-01-15',
    videoUrl: null,
    note: null,
    witnesses: [],
    ...overrides,
  };
}

test.after(() => {
  db.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    } catch {
      // The temporary database is best-effort cleanup only.
    }
  }
});

test('personal bests and leaderboard rows are scoped by event', () => {
  const first = store.createEntry(entry({ timeMs: 12500 }));
  const second = store.createEntry(entry({ timeMs: 11000 }));
  const fourByFour = store.createEntry(entry({ event: '444', timeMs: 30000 }));

  assert.equal(first.event, '333');
  assert.equal(first.isPB, true);
  assert.equal(second.isPB, true);
  assert.equal(second.previousBestMs, 12500);
  assert.equal(fourByFour.event, '444');
  assert.equal(fourByFour.isPB, true);
  assert.equal(fourByFour.previousBestMs, null);

  const threeByThree = store.getLeaderboard({ event: '333' });
  const threeByThreeAll = store.getLeaderboard({ event: '333', all: true });
  const fourByFourBoard = store.getLeaderboard({ event: '444' });

  assert.equal(threeByThree.length, 1);
  assert.equal(threeByThree[0].timeMs, 11000);
  assert.equal(threeByThree[0].personBestMs, 11000);

  assert.equal(threeByThreeAll.length, 2);
  assert.equal(threeByThreeAll[0].personBestMs, 11000);
  assert.equal(threeByThreeAll[1].personBestMs, 11000);

  assert.equal(fourByFourBoard.length, 1);
  assert.equal(fourByFourBoard[0].timeMs, 30000);
  assert.equal(fourByFourBoard[0].personBestMs, 30000);
});

test('stats and admin entries expose and filter the event', () => {
  assert.deepEqual(store.getStats('333'), {
    event: '333',
    solvers: 1,
    entries: 2,
    witnessTags: 0,
    fastestMs: 11000,
  });

  assert.equal(store.getStats().entries, 3);

  const adminEntries = store.getAdminEntries();
  const fourByFour = adminEntries.find((item) => item.event === '444');
  assert.ok(fourByFour);
  assert.equal(fourByFour.name, 'Event Tester');
});
