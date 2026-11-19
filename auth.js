'use strict';

const crypto = require('node:crypto');
const config = require('./config');

const COOKIE_NAME = 'rubix_admin';
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function sign(payload) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payload)
    .digest('base64url');
}

function issueToken() {
  const expiresAt = Date.now() + MAX_AGE_MS;
  const payload = `admin.${expiresAt}`;
  return `${expiresAt}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresRaw, signature] = parts;
  const expiresAt = Number.parseInt(expiresRaw, 10);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = sign(`admin.${expiresRaw}`);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return crypto.timingSafeEqual(given, wanted);
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function isAdmin(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifyToken(cookies[COOKIE_NAME]);
}

function setAdminCookie(res) {
  const attributes = [
    `${COOKIE_NAME}=${issueToken()}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`,
  ];
  if (config.cookieSecure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

function clearAdminCookie(res) {
  const attributes = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (config.cookieSecure) attributes.push('Secure');
  res.append('Set-Cookie', attributes.join('; '));
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: 'Please sign in as a moderator.' });
  }
  next();
}

module.exports = {
  isAdmin,
  setAdminCookie,
  clearAdminCookie,
  requireAdmin,
  parseCookies,
};
