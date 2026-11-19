'use strict';

const store = require('../store');

const force = process.argv.includes('--force');
const stats = store.getStats();

if (stats.entries > 0 && !force) {
  console.log(
    `The database already contains ${stats.entries} active entries. ` +
      'Run `npm run seed -- --force` to add the demo entries anyway.'
  );
  process.exit(0);
}

const demoEntries = [
  {
    solver: 'Felix Weber',
    timeMs: 7842,
    solvedAt: '2026-10-14',
    note: 'PB at the local cube meetup.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Jonas Fischer', 'Aylin Demir'],
  },
  {
    solver: 'Aylin Demir',
    timeMs: 8311,
    solvedAt: '2026-09-02',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Mara Klein'],
  },
  {
    solver: 'Jonas Fischer',
    timeMs: 9104,
    solvedAt: '2026-08-21',
    note: 'Great scramble, smooth look-ahead.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Noah Brandt'],
  },
  {
    solver: 'Mara Klein',
    timeMs: 9560,
    solvedAt: '2026-10-01',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Jonas Fischer', 'Aylin Demir', 'Noah Brandt'],
  },
  {
    solver: 'Noah Brandt',
    timeMs: 10227,
    solvedAt: '2026-07-18',
    note: null,
    videoUrl: null,
    witnesses: ['Jonas Fischer'],
  },
  {
    solver: 'Sofia Rossi',
    timeMs: 11489,
    solvedAt: '2026-06-30',
    note: 'Solo practice solve — no witnesses this time.',
    videoUrl: null,
    witnesses: [],
  },
  {
    solver: "Liam O'Connor",
    timeMs: 12003,
    solvedAt: '2026-09-19',
    note: null,
    videoUrl: null,
    witnesses: ['Sofia Rossi', 'Noah Brandt'],
  },
  {
    solver: 'Priya Nair',
    timeMs: 13670,
    solvedAt: '2026-10-25',
    note: null,
    videoUrl: null,
    witnesses: ['Aylin Demir'],
  },
  {
    solver: 'Tobias Neumann',
    timeMs: 15218,
    solvedAt: '2026-05-11',
    note: null,
    videoUrl: null,
    witnesses: ['Mara Klein', 'Felix Weber'],
  },
  {
    solver: 'Hana Sato',
    timeMs: 16742,
    solvedAt: '2026-08-08',
    note: null,
    videoUrl: null,
    witnesses: ['Priya Nair'],
  },
];

for (const entry of demoEntries) {
  store.createEntry(entry);
}

console.log(`Seeded ${demoEntries.length} demo entries.`);
console.log('Start the app with `npm run dev` and open http://localhost:5565');
