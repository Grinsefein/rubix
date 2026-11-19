'use strict';

const { parseTimeToMs } = require('./time');

const NAME_MAX = 40;
const NOTE_MAX = 280;
const REPORT_NOTE_MAX = 300;
const URL_MAX = 500;
const DATE_MIN = '2000-01-01';

const REPORT_REASONS = new Set(['fake_time', 'fake_witnesses', 'spam', 'other']);

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameKey(value) {
  return normalizeName(value).toLowerCase();
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function normalizeHttpUrl(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { error: 'Enter the video URL as text.' };

  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > URL_MAX) return { error: `The URL must be ${URL_MAX} characters or fewer.` };

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: 'Enter a valid URL, for example https://youtube.com/watch?v=…' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http:// and https:// links are allowed.' };
  }

  return { value: parsed.toString() };
}

function validateSubmission(body) {
  const fields = {};
  if (!body || typeof body !== 'object') {
    return { fields: { general: 'The request body is missing.' } };
  }

  const solver = normalizeName(body.solver);
  const solverKey = nameKey(solver);
  if (!solver) {
    fields.solver = 'Please enter the solver name.';
  } else if (solver.length > NAME_MAX) {
    fields.solver = `The solver name must be ${NAME_MAX} characters or fewer.`;
  }

  const timeMs = parseTimeToMs(body.time);
  if (timeMs === null) {
    fields.time = 'Enter a time like 12.345 or 1:02.345 (between 1 second and 1 hour).';
  }

  const solvedAt = typeof body.solvedAt === 'string' ? body.solvedAt.trim() : '';
  const today = todayIso();
  if (!isValidDateString(solvedAt)) {
    fields.solvedAt = 'Please choose a valid date.';
  } else if (solvedAt < DATE_MIN) {
    fields.solvedAt = `The date must be after ${DATE_MIN}.`;
  } else if (solvedAt > today) {
    fields.solvedAt = 'The solve date cannot be in the future.';
  }

  const video = normalizeHttpUrl(body.videoUrl);
  if (video.error) fields.videoUrl = video.error;

  let note = null;
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    if (typeof body.note !== 'string') {
      fields.note = 'The note must be text.';
    } else {
      note = body.note.trim();
      if (note.length > NOTE_MAX) {
        fields.note = `The note must be ${NOTE_MAX} characters or fewer.`;
      } else if (!note) {
        note = null;
      }
    }
  }

  const witnesses = [];
  const rawWitnesses = Array.isArray(body.witnesses) ? body.witnesses : [];
  const seen = new Set();

  for (const raw of rawWitnesses) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') {
      fields.witnesses = 'Witness names must be text.';
      break;
    }

    const name = normalizeName(raw);
    if (!name) continue;
    if (name.length > NAME_MAX) {
      fields.witnesses = `Witness names must be ${NAME_MAX} characters or fewer.`;
      break;
    }

    const key = nameKey(name);
    if (solverKey && key === solverKey) {
      fields.witnesses = "You can't list yourself as a witness.";
      break;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    witnesses.push(name);
  }

  if (Object.keys(fields).length > 0) return { fields };

  return {
    data: {
      solver,
      solverKey,
      timeMs,
      solvedAt,
      videoUrl: video.value,
      note,
      witnesses,
    },
  };
}

function validateReport(body) {
  const fields = {};
  if (!body || typeof body !== 'object') {
    return { fields: { general: 'The request body is missing.' } };
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!REPORT_REASONS.has(reason)) {
    fields.reason = 'Please choose a reason.';
  }

  let note = null;
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    if (typeof body.note !== 'string') {
      fields.note = 'The note must be text.';
    } else {
      note = body.note.trim();
      if (note.length > REPORT_NOTE_MAX) {
        fields.note = `The note must be ${REPORT_NOTE_MAX} characters or fewer.`;
      } else if (!note) {
        note = null;
      }
    }
  }

  if (reason === 'other' && !note) {
    fields.note = 'Please describe the problem briefly.';
  }

  if (Object.keys(fields).length > 0) return { fields };
  return { data: { reason, note } };
}

module.exports = {
  NAME_MAX,
  NOTE_MAX,
  REPORT_NOTE_MAX,
  URL_MAX,
  REPORT_REASONS,
  normalizeName,
  nameKey,
  todayIso,
  validateSubmission,
  validateReport,
};
