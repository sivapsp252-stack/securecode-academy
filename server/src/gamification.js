'use strict';
const db = require('./db');
const { levelFor } = require('./auth');

const dayStr = (d) => d.toISOString().slice(0, 10);

function award(userId, slug) {
  const badge = db.prepare('SELECT * FROM badges WHERE slug = ?').get(slug);
  if (!badge) return null;
  const r = db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, awarded_at) VALUES (?,?,?)')
    .run(userId, badge.id, new Date().toISOString());
  return r.changes ? { slug: badge.slug, name: badge.name, description: badge.description, icon: badge.icon } : null;
}

/** Marks a lesson complete once, adds XP, updates streak, awards badges. */
const completeLesson = db.transaction((userId, lessonId) => {
  const lesson = db.prepare(
    'SELECT l.*, m.badge_slug FROM lessons l JOIN modules m ON m.id = l.module_id WHERE l.id = ?'
  ).get(lessonId);
  if (!lesson) throw Object.assign(new Error('Lesson not found'), { status: 404 });

  const ins = db.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id, completed_at) VALUES (?,?,?)')
    .run(userId, lessonId, new Date().toISOString());
  if (ins.changes === 0) return { alreadyCompleted: true, xpGained: 0, newBadges: [] };

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 864e5));
  let streak = user.streak;
  if (user.last_active !== today) streak = user.last_active === yesterday ? streak + 1 : 1;

  const xp = user.xp + lesson.xp;
  db.prepare('UPDATE users SET xp = ?, streak = ?, last_active = ? WHERE id = ?').run(xp, streak, today, userId);

  const newBadges = [];
  const push = (b) => b && newBadges.push(b);

  const done = db.prepare('SELECT COUNT(*) c FROM progress WHERE user_id = ?').get(userId).c;
  if (done === 1) push(award(userId, 'first-steps'));
  if (streak >= 3) push(award(userId, 'on-fire'));

  if (lesson.badge_slug) {
    const left = db.prepare(`SELECT COUNT(*) c FROM lessons l
      WHERE l.module_id = ? AND l.id NOT IN (SELECT lesson_id FROM progress WHERE user_id = ?)`)
      .get(lesson.module_id, userId).c;
    if (left === 0) push(award(userId, lesson.badge_slug));
  }
  const total = db.prepare('SELECT COUNT(*) c FROM lessons').get().c;
  if (done === total) push(award(userId, 'security-champion'));

  return {
    alreadyCompleted: false, xpGained: lesson.xp, totalXp: xp,
    level: levelFor(xp), leveledUp: levelFor(xp) > levelFor(user.xp), streak, newBadges,
  };
});

module.exports = { completeLesson };
