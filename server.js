'use strict';

const path = require('node:path');
const express = require('express');

const config = require('./config');
require('./db');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const { sameOrigin } = require('./middleware/same-origin');

const app = express();
app.disable('x-powered-by');

if (config.trustProxy) app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use('/api', sameOrigin);

app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

const publicDir = path.join(__dirname, 'public');
app.use(
  express.static(publicDir, {
    extensions: ['html'],
    maxAge: config.isProduction ? '1h' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request body is too large.' });
  }

  console.error(error);
  return res.status(500).json({ error: 'Something went wrong on our side.' });
});

const server = app.listen(config.port, () => {
  const mode = config.isProduction ? 'production' : 'development';
  console.log(`\n  Rubix Leaderboard`);
  console.log(`  ${'→'} http://localhost:${config.port}  (${mode})`);
  console.log(`  ${'→'} moderation: http://localhost:${config.port}/admin\n`);

  if (!config.adminPassword) {
    console.warn('  ! ADMIN_PASSWORD is not set — the moderation area is disabled.');
  }
  if (config.sessionSecret === 'rubix-development-secret-change-me') {
    console.warn('  ! Using the fallback SESSION_SECRET. Set one in .env before deploying.');
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
