'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { requireAuth } = require('../auth');
const { completeLesson } = require('../gamification');
const { loadChallenge, runChallenge } = require('../challengeRunner');

const router = express.Router();
router.use(requireAuth);
router.use(rateLimit({ windowMs: 60 * 1000, limit: 30, keyGenerator: (req) => String(req.user.id), standardHeaders: true, legacyHeaders: false }));

const MAX_CODE = 20 * 1024;
const codeOf = (req) => (typeof req.body?.code === 'string' && req.body.code.length <= MAX_CODE ? req.body.code : null);

router.get('/:slug', (req, res) => {
  const ch = loadChallenge(req.params.slug);
  if (!ch) return res.status(404).json({ error: 'Challenge not found.' });
  res.json({ slug: req.params.slug, ...ch.meta, starterCode: ch.starter });
});

// Step 1 - "Attack the app": run the learner's CURRENT code with attacker-controlled input.
router.post('/:slug/exploit', async (req, res, next) => {
  try {
    const code = codeOf(req);
    if (code === null) return res.status(400).json({ error: `Code is required (max ${MAX_CODE / 1024} KB).` });
    const input = {};
    for (const [k, v] of Object.entries(req.body.input || {}))
      if (['string', 'number'].includes(typeof v) && String(v).length <= 500) input[k] = v;
    res.json(await runChallenge(req.params.slug, 'exploit', code, input));
  } catch (e) { next(e); }
});

// Step 2 - "Submit patch": run the hidden test-suite. Passing awards XP and badges.
router.post('/:slug/validate', async (req, res, next) => {
  try {
    const code = codeOf(req);
    if (code === null) return res.status(400).json({ error: `Code is required (max ${MAX_CODE / 1024} KB).` });
    const out = await runChallenge(req.params.slug, 'tests', code);
    if (!out.ok) return res.json(out);
    const tests = out.result.tests;
    const passed = tests.length > 0 && tests.every((t) => t.passed);
    let reward = null;
    if (passed) {
      const lesson = db.prepare('SELECT id FROM lessons WHERE challenge_slug = ?').get(req.params.slug);
      if (lesson) reward = completeLesson(req.user.id, lesson.id);
    }
    res.json({ ok: true, passed, tests, logs: out.logs, reward });
  } catch (e) { next(e); }
});

module.exports = router;
