'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const CONTENT = path.join(__dirname, '..', '..', 'content');

/** Loads curriculum.json + markdown lessons into the database (idempotent). */
function seedContent() {
  const cur = JSON.parse(fs.readFileSync(path.join(CONTENT, 'curriculum.json'), 'utf8'));
  db.transaction(() => {
    db.prepare(`INSERT INTO tracks (slug,title,description) VALUES (?,?,?)
      ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description`)
      .run(cur.track.slug, cur.track.title, cur.track.description);
    const track = db.prepare('SELECT id FROM tracks WHERE slug = ?').get(cur.track.slug);

    for (const b of cur.badges) {
      db.prepare(`INSERT INTO badges (slug,name,description,icon) VALUES (?,?,?,?)
        ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description, icon=excluded.icon`)
        .run(b.slug, b.name, b.description, b.icon);
    }
    cur.modules.forEach((m, mi) => {
      db.prepare(`INSERT INTO modules (track_id,slug,title,description,badge_slug,position) VALUES (?,?,?,?,?,?)
        ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description,
        badge_slug=excluded.badge_slug, position=excluded.position`)
        .run(track.id, m.slug, m.title, m.description, m.badge || null, mi);
      const mod = db.prepare('SELECT id FROM modules WHERE slug = ?').get(m.slug);
      m.lessons.forEach((l, li) => {
        const markdown = fs.readFileSync(path.join(CONTENT, 'lessons', l.file), 'utf8');
        db.prepare(`INSERT INTO lessons (module_id,slug,title,markdown,type,challenge_slug,xp,position) VALUES (?,?,?,?,?,?,?,?)
          ON CONFLICT(slug) DO UPDATE SET module_id=excluded.module_id, title=excluded.title, markdown=excluded.markdown,
          type=excluded.type, challenge_slug=excluded.challenge_slug, xp=excluded.xp, position=excluded.position`)
          .run(mod.id, l.slug, l.title, markdown, l.type, l.challenge || null, l.xp, li);
      });
    });
  })();
}

const newInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();

/** Demo accounts so the app can be shown straight after the first start. Disable with SEED_DEMO=0 */
function seedDemo() {
  if (process.env.SEED_DEMO === '0') return;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get('manager@securecode.dev')) return;
  const hash = (p) => bcrypt.hashSync(p, 10);
  const m = db.prepare('INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)')
    .run('manager@securecode.dev', 'Demo Manager', hash('Manager@123'), 'manager');
  const t = db.prepare('INSERT INTO teams (name,invite_code,manager_id) VALUES (?,?,?)')
    .run('Demo Team', 'DEMO2026', m.lastInsertRowid);
  db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(t.lastInsertRowid, m.lastInsertRowid);
  db.prepare('INSERT INTO users (email,name,password_hash,role,team_id) VALUES (?,?,?,?,?)')
    .run('dev@securecode.dev', 'Demo Developer', hash('Developer@123'), 'developer', t.lastInsertRowid);
  console.log('[seed] demo users: manager@securecode.dev / Manager@123 , dev@securecode.dev / Developer@123');
}

module.exports = { seedContent, seedDemo, newInviteCode };
