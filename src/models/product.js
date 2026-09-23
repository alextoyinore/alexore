const db = require('../db');
const slugify = require('slugify');

const Product = {
  findAll({ status = null, category = null, featured = null } = {}) {
    let sql = 'SELECT * FROM product WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (featured !== null && featured !== undefined) {
      sql += ' AND featured = ?';
      params.push(featured ? 1 : 0);
    }

    sql += ' ORDER BY order_num ASC, featured DESC, created_at DESC';
    return db.all(sql, ...params);
  },

  findPublished({ category = null } = {}) {
    return this.findAll({ status: 'published', category });
  },

  findById(id) {
    return db.get('SELECT * FROM product WHERE id = ?', id);
  },

  findBySlug(slug) {
    return db.get('SELECT * FROM product WHERE slug = ?', slug);
  },

  generateUniqueSlug(base, currentId = null) {
    const baseSlug = slugify(base, { lower: true, strict: true }) || 'product';
    let candidate = baseSlug;
    let count = 1;
    while (true) {
      const existing = db.get('SELECT id FROM product WHERE slug = ?', candidate);
      if (!existing || (currentId && existing.id === currentId)) {
        return candidate;
      }
      count++;
      candidate = `${baseSlug}-${count}`;
    }
  },

  create(data) {
    const slug = this.generateUniqueSlug(data.slug || data.title);
    const now = new Date().toISOString();

    const result = db.run(
      `INSERT INTO product (
        title, slug, subtitle, creator_name, creator_bio, creator_avatar,
        category, price, original_price, cover_image, cover_image_alt,
        content_html, content_json, external_store_name, external_store_url,
        badge, status, featured, order_num, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.title,
      slug,
      data.subtitle || '',
      data.creator_name || 'Alex Ore',
      data.creator_bio || '',
      data.creator_avatar || '',
      data.category || 'E-Book',
      data.price,
      data.original_price || '',
      data.cover_image || '',
      data.cover_image_alt || data.title,
      data.content_html || '',
      data.content_json || '',
      data.external_store_name || 'Store',
      data.external_store_url,
      data.badge || '',
      data.status || 'published',
      data.featured ? 1 : 0,
      data.order_num || 0,
      now,
      now
    );

    return this.findById(result.lastInsertRowid);
  },

  update(id, data) {
    const existing = this.findById(id);
    if (!existing) return null;

    const slug = data.slug ? this.generateUniqueSlug(data.slug, id) : existing.slug;
    const now = new Date().toISOString();

    db.run(
      `UPDATE product SET
        title = ?, slug = ?, subtitle = ?, creator_name = ?, creator_bio = ?, creator_avatar = ?,
        category = ?, price = ?, original_price = ?, cover_image = ?, cover_image_alt = ?,
        content_html = ?, content_json = ?, external_store_name = ?, external_store_url = ?,
        badge = ?, status = ?, featured = ?, order_num = ?, updated_at = ?
      WHERE id = ?`,
      data.title !== undefined ? data.title : existing.title,
      slug,
      data.subtitle !== undefined ? data.subtitle : existing.subtitle,
      data.creator_name !== undefined ? data.creator_name : existing.creator_name,
      data.creator_bio !== undefined ? data.creator_bio : existing.creator_bio,
      data.creator_avatar !== undefined ? data.creator_avatar : existing.creator_avatar,
      data.category !== undefined ? data.category : existing.category,
      data.price !== undefined ? data.price : existing.price,
      data.original_price !== undefined ? data.original_price : existing.original_price,
      data.cover_image !== undefined ? data.cover_image : existing.cover_image,
      data.cover_image_alt !== undefined ? data.cover_image_alt : existing.cover_image_alt,
      data.content_html !== undefined ? data.content_html : existing.content_html,
      data.content_json !== undefined ? data.content_json : existing.content_json,
      data.external_store_name !== undefined ? data.external_store_name : existing.external_store_name,
      data.external_store_url !== undefined ? data.external_store_url : existing.external_store_url,
      data.badge !== undefined ? data.badge : existing.badge,
      data.status !== undefined ? data.status : existing.status,
      data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured,
      data.order_num !== undefined ? data.order_num : existing.order_num,
      now,
      id
    );

    return this.findById(id);
  },

  delete(id) {
    return db.run('DELETE FROM product WHERE id = ?', id);
  },

  incrementViews(id) {
    return db.run('UPDATE product SET views = COALESCE(views, 0) + 1 WHERE id = ?', id);
  },

  incrementClicks(id) {
    return db.run('UPDATE product SET clicks = COALESCE(clicks, 0) + 1 WHERE id = ?', id);
  },

  count({ status = null } = {}) {
    if (status) {
      const row = db.get('SELECT COUNT(*) as count FROM product WHERE status = ?', status);
      return row ? row.count : 0;
    }
    const row = db.get('SELECT COUNT(*) as count FROM product');
    return row ? row.count : 0;
  },

  totalClicks() {
    const row = db.get('SELECT SUM(clicks) as total FROM product');
    return row && row.total ? row.total : 0;
  },

  getCategories() {
    const rows = db.all("SELECT DISTINCT category FROM product WHERE status = 'published' AND category IS NOT NULL AND category != ''");
    return rows.map(r => r.category);
  }
};

module.exports = Product;
