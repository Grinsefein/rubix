'use strict';

const { db, transaction } = require('./db');
const { nameKey } = require('./validation');

function getOrCreatePerson(name) {
  const normalized = nameKey(name);
  const existing = db
    .prepare('SELECT id, name FROM people WHERE name_norm = ?')
    .get(normalized);
  if (existing) return { id: Number(existing.id), name: existing.name };

  const info = db
    .prepare('INSERT INTO people (name, name_norm) VALUES (?, ?)')
    .run(name, normalized);
  return { id: Number(info.lastInsertRowid), name };
}

function attachWitnesses(rows) {
  if (rows.length === 0) return [];

  const witnessRows = db
    .prepare(`
      SELECT ew.entry_id, p.name
      FROM entry_witnesses ew
      JOIN people p ON p.id = ew.person_id
      ORDER BY ew.entry_id ASC, ew.position ASC
    `)
    .all();

  const byEntry = new Map();
  for (const row of witnessRows) {
    const id = Number(row.entry_id);
    if (!byEntry.has(id)) byEntry.set(id, []);
    byEntry.get(id).push(row.name);
  }

  return rows.map((row) => {
    const witnesses = byEntry.get(Number(row.id)) ?? [];
    return {
      ...row,
      witnesses,
      witness_count: witnesses.length,
    };
  });
}

function serializeEntry(row) {
  return {
    id: Number(row.id),
    name: row.name,
    personId: Number(row.person_id),
    timeMs: Number(row.time_ms),
    solvedAt: row.solved_at,
    videoUrl: row.video_url,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    personBestMs: row.person_best == null ? null : Number(row.person_best),
    witnesses: row.witnesses,
    witnessCount: row.witness_count,
  };
}

const ENTRY_COLUMNS = `
  e.id, e.time_ms, e.solved_at, e.video_url, e.note, e.status, e.created_at,
  p.id AS person_id, p.name,
  (SELECT MIN(e3.time_ms) FROM entries e3
    WHERE e3.person_id = e.person_id AND e3.status = 'active') AS person_best
`;

function getLeaderboard({ all = false } = {}) {
  const sql = all
    ? `
      SELECT ${ENTRY_COLUMNS}
      FROM entries e
      JOIN people p ON p.id = e.person_id
      WHERE e.status = 'active'
      ORDER BY e.time_ms ASC, e.solved_at ASC, e.created_at ASC, e.id ASC
      LIMIT 500
    `
    : `
      SELECT ${ENTRY_COLUMNS}
      FROM entries e
      JOIN people p ON p.id = e.person_id
      WHERE e.status = 'active'
        AND e.id = (
          SELECT e2.id FROM entries e2
          WHERE e2.person_id = e.person_id AND e2.status = 'active'
          ORDER BY e2.time_ms ASC, e2.solved_at ASC, e2.created_at ASC, e2.id ASC
          LIMIT 1
        )
      ORDER BY e.time_ms ASC, e.solved_at ASC, e.created_at ASC, e.id ASC
      LIMIT 500
    `;

  return attachWitnesses(db.prepare(sql).all()).map(serializeEntry);
}

function getEntry(id) {
  const row = db
    .prepare(`
      SELECT ${ENTRY_COLUMNS}
      FROM entries e
      JOIN people p ON p.id = e.person_id
      WHERE e.id = ?
    `)
    .get(id);

  if (!row) return null;
  return serializeEntry(attachWitnesses([row])[0]);
}

function getStats() {
  const activeEntries = Number(
    db.prepare("SELECT COUNT(*) AS n FROM entries WHERE status = 'active'").get().n
  );
  const solvers = Number(
    db
      .prepare("SELECT COUNT(DISTINCT person_id) AS n FROM entries WHERE status = 'active'")
      .get().n
  );
  const witnessTags = Number(
    db
      .prepare(`
        SELECT COUNT(*) AS n
        FROM entry_witnesses ew
        JOIN entries e ON e.id = ew.entry_id
        WHERE e.status = 'active'
      `)
      .get().n
  );
  const fastest = db
    .prepare("SELECT MIN(time_ms) AS value FROM entries WHERE status = 'active'")
    .get().value;

  return {
    solvers,
    entries: activeEntries,
    witnessTags,
    fastestMs: fastest == null ? null : Number(fastest),
  };
}

function getPeople() {
  return db
    .prepare(`
      SELECT p.name,
        ((SELECT COUNT(*) FROM entries e WHERE e.person_id = p.id) +
         (SELECT COUNT(*) FROM entry_witnesses w WHERE w.person_id = p.id)) AS uses
      FROM people p
      ORDER BY uses DESC, p.name COLLATE NOCASE ASC
      LIMIT 500
    `)
    .all()
    .map((row) => row.name);
}

function createEntry(data) {
  return transaction(() => {
    const solver = getOrCreatePerson(data.solver);
    const previous = db
      .prepare("SELECT MIN(time_ms) AS best FROM entries WHERE person_id = ? AND status = 'active'")
      .get(solver.id);
    const previousBestMs = previous?.best == null ? null : Number(previous.best);

    const info = db
      .prepare(`
        INSERT INTO entries (person_id, time_ms, solved_at, video_url, note)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(solver.id, data.timeMs, data.solvedAt, data.videoUrl, data.note);
    const entryId = Number(info.lastInsertRowid);

    const insertWitness = db.prepare(`
      INSERT INTO entry_witnesses (entry_id, person_id, position)
      VALUES (?, ?, ?)
    `);

    data.witnesses.forEach((name, index) => {
      const witness = getOrCreatePerson(name);
      insertWitness.run(entryId, witness.id, index);
    });

    return {
      id: entryId,
      isPB: previousBestMs === null || data.timeMs < previousBestMs,
      previousBestMs,
    };
  });
}

function addReport(entryId, reason, note, ipHash, threshold) {
  const entry = db.prepare('SELECT id, status FROM entries WHERE id = ?').get(entryId);
  if (!entry) return { status: 'not_found' };

  try {
    db.prepare(
      'INSERT INTO reports (entry_id, reason, note, ip_hash) VALUES (?, ?, ?, ?)'
    ).run(entryId, reason, note, ipHash);
  } catch (error) {
    if (String(error.message).toLowerCase().includes('unique')) {
      return { status: 'duplicate' };
    }
    throw error;
  }

  const reportCount = Number(
    db.prepare('SELECT COUNT(*) AS n FROM reports WHERE entry_id = ?').get(entryId).n
  );

  let underReview = entry.status === 'under_review';
  if (!underReview && reportCount >= threshold) {
    db.prepare("UPDATE entries SET status = 'under_review' WHERE id = ?").run(entryId);
    underReview = true;
  }

  return { status: 'ok', reportCount, underReview };
}

function getAdminEntries() {
  const rows = db
    .prepare(`
      SELECT e.id, e.time_ms, e.solved_at, e.video_url, e.note, e.status, e.created_at,
        p.id AS person_id, p.name,
        (SELECT COUNT(*) FROM reports r WHERE r.entry_id = e.id) AS report_count
      FROM entries e
      JOIN people p ON p.id = e.person_id
      ORDER BY (e.status = 'under_review') DESC, report_count DESC, e.created_at DESC
    `)
    .all();

  const withWitnesses = attachWitnesses(rows);

  const reportRows = db
    .prepare(`
      SELECT id, entry_id, reason, note, created_at
      FROM reports
      ORDER BY created_at DESC, id DESC
    `)
    .all();

  const reportsByEntry = new Map();
  for (const report of reportRows) {
    const entryId = Number(report.entry_id);
    if (!reportsByEntry.has(entryId)) reportsByEntry.set(entryId, []);
    reportsByEntry.get(entryId).push({
      id: Number(report.id),
      reason: report.reason,
      note: report.note,
      createdAt: report.created_at,
    });
  }

  return withWitnesses.map((row) => ({
    id: Number(row.id),
    name: row.name,
    timeMs: Number(row.time_ms),
    solvedAt: row.solved_at,
    videoUrl: row.video_url,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    reportCount: Number(row.report_count),
    reports: reportsByEntry.get(Number(row.id)) ?? [],
    witnesses: row.witnesses,
    witnessCount: row.witness_count,
  }));
}

function deleteEntry(entryId) {
  const info = db.prepare('DELETE FROM entries WHERE id = ?').run(entryId);
  return Number(info.changes) > 0;
}

function dismissReports(entryId) {
  return transaction(() => {
    const entry = db.prepare('SELECT id FROM entries WHERE id = ?').get(entryId);
    if (!entry) return false;

    db.prepare('DELETE FROM reports WHERE entry_id = ?').run(entryId);
    db.prepare("UPDATE entries SET status = 'active' WHERE id = ?").run(entryId);
    return true;
  });
}

module.exports = {
  getLeaderboard,
  getEntry,
  getStats,
  getPeople,
  createEntry,
  addReport,
  getAdminEntries,
  deleteEntry,
  dismissReports,
};
