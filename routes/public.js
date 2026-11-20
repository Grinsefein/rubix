'use strict';

const crypto = require('node:crypto');
const express = require('express');

const config = require('../config');
const store = require('../store');
const { EVENTS, DEFAULT_EVENT, isEvent, getEvent } = require('../events');
const { validateSubmission, validateReport } = require('../validation');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'You have submitted a lot of times recently. Please try again in a bit.',
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'You have sent a lot of reports recently. Please try again in a bit.',
});

function parseEntryId(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    res.status(404).json({ error: 'Entry not found.' });
    return null;
  }
  return id;
}

function getReporterId(req, res) {
  const match = String(req.headers.cookie ?? '').match(/(?:^|;\s*)rubix_reporter=([^;]+)/);
  const existing = match ? decodeURIComponent(match[1]) : '';
  if (/^[a-f0-9-]{36}$/i.test(existing)) return existing;

  const reporterId = crypto.randomUUID();
  res.setHeader(
    'Set-Cookie',
    `rubix_reporter=${encodeURIComponent(reporterId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${config.cookieSecure ? '; Secure' : ''}`
  );
  return reporterId;
}

function parseEvent(req, res) {
  const raw = req.query.event;
  const event = raw === undefined || raw === '' ? DEFAULT_EVENT : String(raw);
  if (!isEvent(event)) {
    res.status(400).json({ error: 'Unknown cube event.' });
    return null;
  }
  return event;
}

router.get('/events', (req, res) => {
  res.json({ events: EVENTS, defaultEvent: DEFAULT_EVENT });
});

router.get('/stats', (req, res) => {
  const event = parseEvent(req, res);
  if (event === null) return;

  res.json(store.getStats(event));
});

router.get('/leaderboard', (req, res) => {
  const event = parseEvent(req, res);
  if (event === null) return;

  const all = req.query.all === '1' || req.query.all === 'true';
  const details = getEvent(event);
  res.json({
    event,
    eventLabel: details?.label ?? event,
    eventName: details?.name ?? event,
    entries: store.getLeaderboard({ all, event }),
  });
});

router.get('/people', (req, res) => {
  res.json({ names: store.getPeople() });
});

router.get('/entries/:id', (req, res) => {
  const id = parseEntryId(req, res);
  if (id === null) return;

  const entry = store.getEntry(id);
  if (!entry) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ entry });
});

router.post('/entries', createLimiter, (req, res) => {
  const { fields, data } = validateSubmission(req.body);
  if (fields) {
    return res.status(422).json({
      error: 'Please check the highlighted fields.',
      fields,
    });
  }

  const result = store.createEntry(data);
  res.status(201).json(result);
});

router.post('/entries/:id/report', reportLimiter, (req, res) => {
  const id = parseEntryId(req, res);
  if (id === null) return;

  const { fields, data } = validateReport(req.body);
  if (fields) {
    return res.status(422).json({
      error: 'Please check the highlighted fields.',
      fields,
    });
  }

  const result = store.addReport(
    id,
    data.reason,
    data.note,
    getReporterId(req, res),
    config.reportHideThreshold
  );

  if (result.status === 'not_found') {
    return res.status(404).json({ error: 'Entry not found.' });
  }
  if (result.status === 'duplicate') {
    return res.status(409).json({
      error: 'You have already reported this entry from this browser.',
    });
  }

  res.status(201).json({
    ok: true,
    underReview: result.underReview,
  });
});

module.exports = router;
