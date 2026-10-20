'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { sign, requireAuth, publicUser } = require('../auth');
const { newInviteCode } = require('../seed');

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', limiter, (req, res) => {
  const { name, email, password, role = 'developer', teamName, inviteCode } = req.body || {};
  if (!name || !EMAIL.test(email || '')) return res.status(400).json({ error: 'Enter your name and a valid email.' });
  if (typeof password !== 'string' || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (!['developer', 'manager'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  const mail = email.toLowerCase().trim();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(mail)) return res.status(409).json({ error: 'That email is already registered.' });

  const hash = bcrypt.hashSync(password, 10);
  const id = db.transaction(() => {
    const r = db.prepare('INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)')
      .run(mail, String(name).trim().slice(0, 80), hash, role);
    const uid = r.lastInsertRowid;
    if (role === 'manager') {
      const t = db.prepare('INSERT INTO teams (name,invite_code,manager_id) VALUES (?,?,?)')
        .run(String(teamName || `${name}'s Team`).slice(0, 80), newInviteCode(), uid);
      db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(t.lastInsertRowid, uid);
    } else {
      let team = inviteCode ? db.prepare('SELECT id FROM teams WHERE invite_code = ?').get(String(inviteCode).trim().toUpperCase()) : null;
      if (!team) {
        const inv = db.prepare('SELECT team_id FROM invites WHERE email = ? AND accepted = 0').get(mail);
        if (inv) team = { id: inv.team_id };
      }
      if (team) {
        db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(team.id, uid);
        db.prepare('UPDATE invites SET accepted = 1 WHERE email = ? AND team_id = ?').run(mail, team.id);
      }
    }
    return uid;
  })();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', limiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  // same message for unknown user / wrong password: no account enumeration
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const badges = db.prepare(`SELECT b.slug,b.name,b.description,b.icon FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = ? ORDER BY ub.awarded_at`).all(req.user.id);
  res.json({ user: publicUser(req.user), badges });
});

module.exports = router;
