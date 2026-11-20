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
  // 3×3
  {
    event: '333',
    solver: 'Felix Weber',
    timeMs: 7842,
    solvedAt: '2026-10-14',
    note: 'PB at the local cube meetup.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Jonas Fischer', 'Aylin Demir'],
  },
  {
    event: '333',
    solver: 'Aylin Demir',
    timeMs: 8311,
    solvedAt: '2026-09-02',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Mara Klein'],
  },
  {
    event: '333',
    solver: 'Jonas Fischer',
    timeMs: 9104,
    solvedAt: '2026-08-21',
    note: 'Great scramble, smooth look-ahead.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Noah Brandt'],
  },
  {
    event: '333',
    solver: 'Mara Klein',
    timeMs: 9560,
    solvedAt: '2026-10-01',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Jonas Fischer', 'Aylin Demir', 'Noah Brandt'],
  },
  {
    event: '333',
    solver: 'Noah Brandt',
    timeMs: 10227,
    solvedAt: '2026-07-18',
    note: null,
    videoUrl: null,
    witnesses: ['Jonas Fischer'],
  },
  {
    event: '333',
    solver: 'Sofia Rossi',
    timeMs: 11489,
    solvedAt: '2026-06-30',
    note: 'Solo practice solve — no witnesses this time.',
    videoUrl: null,
    witnesses: ['Felix Weber', 'Jonas Fischer'],
  },
  {
    event: '333',
    solver: "Liam O'Connor",
    timeMs: 12003,
    solvedAt: '2026-09-19',
    note: null,
    videoUrl: null,
    witnesses: ['Sofia Rossi', 'Noah Brandt'],
  },
  {
    event: '333',
    solver: 'Priya Nair',
    timeMs: 13670,
    solvedAt: '2026-10-25',
    note: null,
    videoUrl: null,
    witnesses: ['Aylin Demir'],
  },
  {
    event: '333',
    solver: 'Tobias Neumann',
    timeMs: 15218,
    solvedAt: '2026-05-11',
    note: null,
    videoUrl: null,
    witnesses: ['Mara Klein', 'Felix Weber'],
  },
  {
    event: '333',
    solver: 'Hana Sato',
    timeMs: 16742,
    solvedAt: '2026-08-08',
    note: null,
    videoUrl: null,
    witnesses: ['Priya Nair'],
  },

  // 2×2
  {
    event: '222',
    solver: 'Felix Weber',
    timeMs: 2134,
    solvedAt: '2026-11-02',
    note: 'Two-look last layer finally paid off.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Jonas Fischer'],
  },
  {
    event: '222',
    solver: 'Hana Sato',
    timeMs: 2876,
    solvedAt: '2026-10-28',
    note: null,
    videoUrl: null,
    witnesses: ['Priya Nair', 'Aylin Demir'],
  },
  {
    event: '222',
    solver: 'Aylin Demir',
    timeMs: 3412,
    solvedAt: '2026-09-15',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber'],
  },

  // 4×4
  {
    event: '444',
    solver: 'Jonas Fischer',
    timeMs: 34120,
    solvedAt: '2026-10-19',
    note: 'Clean centers, no parity.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Noah Brandt'],
  },
  {
    event: '444',
    solver: 'Mara Klein',
    timeMs: 38754,
    solvedAt: '2026-11-01',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Jonas Fischer'],
  },
  {
    event: '444',
    solver: 'Noah Brandt',
    timeMs: 41003,
    solvedAt: '2026-08-30',
    note: null,
    videoUrl: null,
    witnesses: ['Jonas Fischer'],
  },

  // 5×5
  {
    event: '555',
    solver: 'Felix Weber',
    timeMs: 68200,
    solvedAt: '2026-10-05',
    note: 'First sub-70 on camera.',
    videoUrl: null,
    witnesses: ['Mara Klein', 'Aylin Demir', 'Hana Sato'],
  },
  {
    event: '555',
    solver: 'Sofia Rossi',
    timeMs: 75432,
    solvedAt: '2026-09-22',
    note: null,
    videoUrl: null,
    witnesses: ['Noah Brandt', 'Priya Nair'],
  },
  {
    event: '555',
    solver: 'Tobias Neumann',
    timeMs: 82111,
    solvedAt: '2026-07-27',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber'],
  },

  // 6×6
  {
    event: '666',
    solver: 'Aylin Demir',
    timeMs: 132500,
    solvedAt: '2026-11-08',
    note: null,
    videoUrl: null,
    witnesses: ['Felix Weber', 'Mara Klein'],
  },
  {
    event: '666',
    solver: 'Priya Nair',
    timeMs: 145300,
    solvedAt: '2026-10-12',
    note: null,
    videoUrl: null,
    witnesses: ['Hana Sato'],
  },

  // 7×7
  {
    event: '777',
    solver: 'Felix Weber',
    timeMs: 210400,
    solvedAt: '2026-11-12',
    note: 'Endurance solve — worth the wait.',
    videoUrl: null,
    witnesses: ['Aylin Demir', 'Mara Klein', 'Hana Sato'],
  },
  {
    event: '777',
    solver: 'Jonas Fischer',
    timeMs: 225750,
    solvedAt: '2026-09-28',
    note: null,
    videoUrl: null,
    witnesses: ['Noah Brandt'],
  },
];

for (const entry of demoEntries) {
  store.createEntry(entry);
}

console.log(`Seeded ${demoEntries.length} demo entries across six cube events.`);
console.log('Start the app with `npm run dev` and open http://localhost:5565');
