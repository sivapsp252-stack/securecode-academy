'use strict';
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { seedContent, seedDemo } = require('./seed');
const { detect } = require('./sandbox');

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/content'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/team', require('./routes/teams'));

// Serve the built React app in production
const dist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

const PORT = Number(process.env.PORT || 4000);
seedContent();
seedDemo();
detect()
  .then((m) => console.log(`[sandbox] mode: ${m}`))
  .catch((e) => console.error('[sandbox] ' + e.message))
  .finally(() => app.listen(PORT, () => console.log(`SecureCode Academy API on http://localhost:${PORT}`)));
