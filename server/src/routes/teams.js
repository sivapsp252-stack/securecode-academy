'use strict';
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole, levelFor } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  if (!req.user.team_id) return res.json({ team: null });
  const team = db.prepare('SELECT id,name,invite_code,manager_id FROM teams WHERE id = ?').get(req.user.team_id);
  if (req.user.role !== 'manager') return res.json({ team: { id: team.id, name: team.name } });

  const totalLessons = db.prepare('SELECT COUNT(*) c FROM lessons').get().c;
  const members = db.prepare(`SELECT u.id,u.name,u.email,u.xp,u.streak,u.last_active,
      (SELECT COUNT(*) FROM progress p WHERE p.user_id = u.id) AS completed,
      (SELECT COUNT(*) FROM user_badges b WHERE b.user_id = u.id) AS badges
    FROM users u WHERE u.team_id = ? AND u.role = 'developer' ORDER BY u.xp DESC`).all(team.id)
    .map((m) => ({ ...m, level: levelFor(m.xp), completionRate: totalLessons ? Math.round((m.completed / totalLessons) * 100) : 0 }));
  const avg = members.length ? Math.round(members.reduce((s, m) => s + m.completionRate, 0) / members.length) : 0;
  const invites = db.prepare('SELECT email,accepted,created_at FROM invites WHERE team_id = ? ORDER BY id DESC').all(team.id);
  res.json({ team: { id: team.id, name: team.name, inviteCode: team.invite_code }, totalLessons, averageCompletion: avg, members, invites });
});

router.post('/invite', requireRole('manager'), (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const existing = db.prepare('SELECT id,role,team_id FROM users WHERE email = ?').get(email);
  if (existing) {
    if (existing.role !== 'developer') return res.status(400).json({ error: 'That account is not a developer.' });
    db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(req.user.team_id, existing.id);
    db.prepare('INSERT OR IGNORE INTO invites (team_id,email,accepted) VALUES (?,?,1)').run(req.user.team_id, email);
    return res.json({ added: true, message: 'Developer added to your team.' });
  }
  db.prepare('INSERT OR IGNORE INTO invites (team_id,email) VALUES (?,?)').run(req.user.team_id, email);
  res.json({ added: false, message: 'Invite saved. They join automatically when they register with this email, or by using your invite code.' });
});

router.post('/join', requireRole('developer'), (req, res) => {
  const team = db.prepare('SELECT id,name FROM teams WHERE invite_code = ?').get(String(req.body?.code || '').trim().toUpperCase());
  if (!team) return res.status(404).json({ error: 'No team has that invite code.' });
  db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(team.id, req.user.id);
  res.json({ team });
});

module.exports = router;
