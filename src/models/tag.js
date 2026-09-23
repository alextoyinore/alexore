const db = require('../db');
const slugify = require('slugify');

const Tag = {
  findAll() {
    return db.all('SELECT * FROM tag ORDER BY name ASC');
  },

  findById(id) {
    return db.get('SELECT * FROM tag WHERE id = ?', id);
  },

  findBySlug(slug) {
    return db.get('SELECT * FROM tag WHERE slug = ?', slug);
  },

  findOrCreate(name) {
    const slug = slugify(name, { lower: true, strict: true });
    let tag = this.findBySlug(slug);
    if (!tag) {
      const res = db.run('INSERT INTO tag (name, slug) VALUES (?, ?)', name, slug);
      tag = this.findById(res.lastInsertRowid);
    }
    return tag;
  }
};

module.exports = Tag;
