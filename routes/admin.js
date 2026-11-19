'use strict';

const crypto = require('node:crypto');
const express = require('express');

const config = require('../config');
const store = require('../store');
const { requireAdmin, isAdmin, setAdminCookie, clearAdminCookie } = require('../auth');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please wait a few minutes.',
});

router.post('/login', loginLimiter, (req, res) => {
  if (!config.adminPassword) {
    return res.status(503).json({
      error: 'Moderation is not configured. Set ADMIN_PASSWORD in the .env file.',
    });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const supplied = crypto.createHash('sha256').update(password).digest();
  const expected = crypto
    .createHash('sha256')
    .update(config.adminPassword)
    .digest();

  if (!crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  setAdminCookie(res);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ authenticated: isAdmin(req) });
});

router.get('/entries', requireAdmin, (req, res) => {
  res.json({ entries: store.getAdminEntries() });
});

router.delete('/entries/:id', requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  if (!store.deleteEntry(id)) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  res.json({ ok: true });
});

router.post('/entries/:id/dismiss-reports', requireAdmin, (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  if (!store.dismissReports(id)) {
    return res.status(404).json({ error: 'Entry not found.' });
  }

  res.json({ ok: true });
});

module.exports = router;
