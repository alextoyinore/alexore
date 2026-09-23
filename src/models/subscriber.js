const crypto = require('crypto');
const db = require('../db');

const Subscriber = {
  findAll({ status = null } = {}) {
    let sql = 'SELECT * FROM subscriber';
    const params = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY subscribed_at DESC';
    return db.all(sql, ...params);
  },

  findById(id) {
    return db.get('SELECT * FROM subscriber WHERE id = ?', id);
  },

  findByEmail(email) {
    return db.get('SELECT * FROM subscriber WHERE email = ?', email.toLowerCase().trim());
  },

  findByToken(token) {
    return db.get('SELECT * FROM subscriber WHERE unsubscribe_token = ?', token);
  },

  count({ status = 'active' } = {}) {
    const row = db.get('SELECT COUNT(*) as count FROM subscriber WHERE status = ?', status);
    return row ? row.count : 0;
  },

  create({ email, name = '', source = 'homepage' }) {
    const cleanEmail = email.toLowerCase().trim();
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    const res = db.run(
      `INSERT INTO subscriber (email, name, status, source, unsubscribe_token, subscribed_at)
       VALUES (?, ?, 'active', ?, ?, ?)`,
      cleanEmail,
      name ? name.trim() : null,
      source,
      token,
      now
    );

    return this.findById(res.lastInsertRowid);
  },

  updateName(email, name) {
    db.run('UPDATE subscriber SET name = ? WHERE email = ?', name.trim(), email.toLowerCase().trim());
    return this.findByEmail(email);
  },

  reactivate(email, name = null) {
    if (name) {
      db.run("UPDATE subscriber SET status = 'active', unsubscribed_at = NULL, name = ? WHERE email = ?", name.trim(), email.toLowerCase().trim());
    } else {
      db.run("UPDATE subscriber SET status = 'active', unsubscribed_at = NULL WHERE email = ?", email.toLowerCase().trim());
    }
    return this.findByEmail(email);
  },

  unsubscribe(token) {
    const now = new Date().toISOString();
    db.run("UPDATE subscriber SET status = 'unsubscribed', unsubscribed_at = ? WHERE unsubscribe_token = ?", now, token);
    return this.findByToken(token);
  },

  delete(id) {
    return db.run('DELETE FROM subscriber WHERE id = ?', id);
  }
};

module.exports = Subscriber;
