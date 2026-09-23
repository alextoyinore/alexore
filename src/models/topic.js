const db = require('../db');
const slugify = require('slugify');

const Topic = {
  findAll() {
    return db.all('SELECT * FROM topic ORDER BY "order" ASC, name ASC');
  },

  findById(id) {
    return db.get('SELECT * FROM topic WHERE id = ?', id);
  },

  findBySlug(slug) {
    return db.get('SELECT * FROM topic WHERE slug = ?', slug);
  },

  getFirst() {
    return db.get('SELECT * FROM topic ORDER BY "order" ASC, id ASC LIMIT 1');
  },

  create(name) {
    const slug = slugify(name, { lower: true, strict: true });
    const countRow = db.get('SELECT COUNT(*) as count FROM topic');
    const order = countRow ? countRow.count : 0;
    const res = db.run('INSERT INTO topic (name, slug, "order") VALUES (?, ?, ?)', name, slug, order);
    return this.findById(res.lastInsertRowid);
  },

  update(id, name) {
    const slug = slugify(name, { lower: true, strict: true });
    db.run('UPDATE topic SET name = ?, slug = ? WHERE id = ?', name, slug, id);
    return this.findById(id);
  },

  delete(id) {
    // Re-assign posts to first remaining topic
    const firstRemaining = db.get('SELECT * FROM topic WHERE id != ? ORDER BY "order" ASC LIMIT 1', id);
    const replacementId = firstRemaining ? firstRemaining.id : null;
    db.run('UPDATE post SET topic_id = ? WHERE topic_id = ?', replacementId, id);
    return db.run('DELETE FROM topic WHERE id = ?', id);
  }
};

module.exports = Topic;
