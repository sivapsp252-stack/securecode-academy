'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { completeLesson } = require('../gamification');

const router = express.Router();
router.use(requireAuth);

router.get('/curriculum', (req, res) => {
  const done = new Set(db.prepare('SELECT lesson_id FROM progress WHERE user_id = ?').all(req.user.id).map((r) => r.lesson_id));
  const tracks = db.prepare('SELECT * FROM tracks').all().map((t) => ({
    ...t,
    modules: db.prepare('SELECT * FROM modules WHERE track_id = ? ORDER BY position').all(t.id).map((m) => {
      const lessons = db.prepare('SELECT id,slug,title,type,xp FROM lessons WHERE module_id = ? ORDER BY position').all(m.id)
        .map((l) => ({ ...l, completed: done.has(l.id) }));
      const badge = m.badge_slug ? db.prepare('SELECT slug,name,icon FROM badges WHERE slug = ?').get(m.badge_slug) : null;
      return { id: m.id, slug: m.slug, title: m.title, description: m.description, badge, lessons,
        completed: lessons.filter((l) => l.completed).length, total: lessons.length };
    }),
  }));
  res.json({ tracks });
});

router.get('/lessons/:slug', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE slug = ?').get(req.params.slug);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  const done = new Set(db.prepare('SELECT lesson_id FROM progress WHERE user_id = ?').all(req.user.id).map((r) => r.lesson_id));
  const mod = db.prepare('SELECT id,slug,title FROM modules WHERE id = ?').get(lesson.module_id);
  const siblings = db.prepare('SELECT id,slug,title,type FROM lessons WHERE module_id = ? ORDER BY position').all(lesson.module_id)
    .map((l) => ({ ...l, completed: done.has(l.id) }));
  res.json({
    lesson: { id: lesson.id, slug: lesson.slug, title: lesson.title, markdown: lesson.markdown, type: lesson.type,
      challengeSlug: lesson.challenge_slug, xp: lesson.xp, completed: done.has(lesson.id) },
    module: mod, siblings,
  });
});

// Reading lessons and browser-validated (XSS) challenges are completed from the client.
// Server-validated challenges can ONLY be completed through /api/challenges/:slug/validate.
router.post('/lessons/:slug/complete', (req, res) => {
  const lesson = db.prepare('SELECT id,type FROM lessons WHERE slug = ?').get(req.params.slug);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  if (lesson.type === 'server-challenge') return res.status(400).json({ error: 'Pass the test suite to complete this challenge.' });
  res.json(completeLesson(req.user.id, lesson.id));
});

module.exports = router;
