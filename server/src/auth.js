'use strict';
const jwt = require('jsonwebtoken');
const db = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('[auth] JWT_SECRET not set - using an insecure development secret');

const XP_PER_LEVEL = 200;
const levelFor = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, teamId: u.team_id,
    xp: u.xp, level: levelFor(u.xp), xpIntoLevel: u.xp % XP_PER_LEVEL, xpPerLevel: XP_PER_LEVEL,
    streak: u.streak,
  };
}

const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, SECRET, { expiresIn: '7d' });

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account not found.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ error: `Only ${role}s can do this.` });

module.exports = { sign, requireAuth, requireRole, publicUser, levelFor, XP_PER_LEVEL };
