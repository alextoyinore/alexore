const db = require('../db');
const slugify = require('slugify');

function calculateReadingTime(html) {
  if (!html) return 1;
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function enrichPost(post) {
  if (!post) return null;

  // Fetch tags
  const tags = db.all(
    `SELECT t.* FROM tag t
     JOIN post_tags pt ON pt.tag_id = t.id
     WHERE pt.post_id = ?
     ORDER BY t.name ASC`,
    post.id
  );

  // Fetch topic
  let topic = null;
  if (post.topic_id) {
    topic = db.get('SELECT * FROM topic WHERE id = ?', post.topic_id);
  }

  return {
    ...post,
    tags,
    tag_names: tags.map(t => t.name),
    topic,
    effective_seo_title: post.seo_title || post.title,
    effective_seo_desc: post.seo_desc || post.subtitle || '',
    effective_og_image: post.og_image || post.cover_image || '',
    is_published: post.status === 'published'
  };
}

const Post = {
  STATUS_DRAFT: 'draft',
  STATUS_PUBLISHED: 'published',
  STATUS_SCHEDULED: 'scheduled',

  findById(id) {
    const post = db.get('SELECT * FROM post WHERE id = ?', id);
    return enrichPost(post);
  },

  findBySlug(slug) {
    const post = db.get('SELECT * FROM post WHERE slug = ?', slug);
    return enrichPost(post);
  },

  findPublishedBySlug(slug) {
    const post = db.get("SELECT * FROM post WHERE slug = ? AND status = 'published'", slug);
    return enrichPost(post);
  },

  findAll({ status = null, limit = null, offset = null } = {}) {
    let sql = 'SELECT * FROM post WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY updated_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const posts = db.all(sql, ...params);
    return posts.map(enrichPost);
  },

  findLatestPublished(limit = 8) {
    const posts = db.all(
      "SELECT * FROM post WHERE status = 'published' ORDER BY published_at DESC LIMIT ?",
      limit
    );
    return posts.map(enrichPost);
  },

  findFeaturedPublished() {
    const post = db.get(
      "SELECT * FROM post WHERE status = 'published' AND featured = 1 ORDER BY published_at DESC LIMIT 1"
    );
    return enrichPost(post);
  },

  findPopularPublished(limit = 4) {
    const posts = db.all(
      "SELECT * FROM post WHERE status = 'published' ORDER BY views DESC, published_at DESC LIMIT ?",
      limit
    );
    return posts.map(enrichPost);
  },

  findRelatedPublished(postId, limit = 3) {
    const posts = db.all(
      "SELECT * FROM post WHERE status = 'published' AND id != ? ORDER BY published_at DESC LIMIT ?",
      postId,
      limit
    );
    return posts.map(enrichPost);
  },

  paginatePublished({ page = 1, perPage = 10, feed = 'latest', q = '', topicId = null, tagSlug = null } = {}) {
    let whereClauses = ["p.status = 'published'"];
    const params = [];

    if (q) {
      whereClauses.push('(p.title LIKE ? OR p.subtitle LIKE ? OR p.content_html LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    if (topicId) {
      whereClauses.push('p.topic_id = ?');
      params.push(topicId);
    }

    let joinClause = '';
    if (tagSlug) {
      joinClause = 'JOIN post_tags pt ON pt.post_id = p.id JOIN tag tg ON tg.id = pt.tag_id';
      whereClauses.push('tg.slug = ?');
      params.push(tagSlug);
    }

    let orderClause = 'p.published_at DESC';
    if (feed === 'top') {
      orderClause = 'p.views DESC, p.published_at DESC';
    } else if (feed === 'discussions') {
      orderClause = 'p.comment_count DESC, p.views DESC, p.published_at DESC';
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM post p ${joinClause} ${whereSql}`;
    const countRow = db.get(countSql, ...params);
    const total = countRow ? countRow.total : 0;

    const offset = (page - 1) * perPage;
    const querySql = `
      SELECT DISTINCT p.* FROM post p
      ${joinClause}
      ${whereSql}
      ORDER BY ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const items = db.all(querySql, ...params, perPage, offset).map(enrichPost);
    const pages = Math.ceil(total / perPage) || 1;

    return {
      items,
      total,
      page,
      perPage,
      pages,
      hasPrev: page > 1,
      hasNext: page < pages,
      prevNum: page - 1,
      nextNum: page + 1
    };
  },

  create(data) {
    const slug = slugify(data.slug || data.title, { lower: true, strict: true });
    const now = new Date().toISOString();
    const readingTime = calculateReadingTime(data.content_html);

    const result = db.run(
      `INSERT INTO post (
        title, slug, subtitle, content_json, content_html,
        cover_image, cover_image_alt, status, post_type, reading_time,
        featured, seo_title, seo_desc, og_image, published_at,
        created_at, updated_at, topic_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.title,
      slug,
      data.subtitle || '',
      data.content_json || '',
      data.content_html || '',
      data.cover_image || '',
      data.cover_image_alt || '',
      data.status || 'draft',
      data.post_type || 'essay',
      readingTime,
      data.featured ? 1 : 0,
      data.seo_title || '',
      data.seo_desc || '',
      data.og_image || '',
      data.published_at || (data.status === 'published' ? now : null),
      now,
      now,
      data.topic_id || null
    );

    const postId = result.lastInsertRowid;
    if (data.tags && Array.isArray(data.tags)) {
      this.setTags(postId, data.tags);
    }

    return this.findById(postId);
  },

  update(id, data) {
    const existing = this.findById(id);
    if (!existing) return null;

    const slug = data.slug ? slugify(data.slug, { lower: true, strict: true }) : existing.slug;
    const now = new Date().toISOString();
    const contentHtml = data.content_html !== undefined ? data.content_html : existing.content_html;
    const readingTime = calculateReadingTime(contentHtml);

    let publishedAt = existing.published_at;
    if (data.status === 'published' && !existing.published_at) {
      publishedAt = now;
    } else if (data.published_at !== undefined) {
      publishedAt = data.published_at;
    }

    db.run(
      `UPDATE post SET
        title = ?, slug = ?, subtitle = ?, content_json = ?, content_html = ?,
        cover_image = ?, cover_image_alt = ?, status = ?, post_type = ?,
        reading_time = ?, featured = ?, seo_title = ?, seo_desc = ?,
        og_image = ?, published_at = ?, updated_at = ?, topic_id = ?
      WHERE id = ?`,
      data.title !== undefined ? data.title : existing.title,
      slug,
      data.subtitle !== undefined ? data.subtitle : existing.subtitle,
      data.content_json !== undefined ? data.content_json : existing.content_json,
      contentHtml,
      data.cover_image !== undefined ? data.cover_image : existing.cover_image,
      data.cover_image_alt !== undefined ? data.cover_image_alt : existing.cover_image_alt,
      data.status !== undefined ? data.status : existing.status,
      data.post_type !== undefined ? data.post_type : existing.post_type,
      readingTime,
      data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured,
      data.seo_title !== undefined ? data.seo_title : existing.seo_title,
      data.seo_desc !== undefined ? data.seo_desc : existing.seo_desc,
      data.og_image !== undefined ? data.og_image : existing.og_image,
      publishedAt,
      now,
      data.topic_id !== undefined ? data.topic_id : existing.topic_id,
      id
    );

    if (data.tags !== undefined) {
      this.setTags(id, data.tags);
    }

    return this.findById(id);
  },

  delete(id) {
    db.run('DELETE FROM post_tags WHERE post_id = ?', id);
    db.run('DELETE FROM comment WHERE post_id = ?', id);
    return db.run('DELETE FROM post WHERE id = ?', id);
  },

  setTags(postId, tagNames) {
    db.run('DELETE FROM post_tags WHERE post_id = ?', postId);
    for (const rawName of tagNames) {
      const name = rawName.trim();
      if (!name) continue;
      const tagSlug = slugify(name, { lower: true, strict: true });

      let tag = db.get('SELECT * FROM tag WHERE slug = ?', tagSlug);
      if (!tag) {
        const res = db.run('INSERT INTO tag (name, slug) VALUES (?, ?)', name, tagSlug);
        tag = { id: res.lastInsertRowid, name, slug: tagSlug };
      }

      db.run('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)', postId, tag.id);
    }
  },

  incrementViews(id) {
    return db.run('UPDATE post SET views = COALESCE(views, 0) + 1 WHERE id = ?', id);
  },

  updateCommentCount(id) {
    const row = db.get("SELECT COUNT(*) as count FROM comment WHERE post_id = ? AND status = 'approved'", id);
    const count = row ? row.count : 0;
    return db.run('UPDATE post SET comment_count = ? WHERE id = ?', count, id);
  },

  count({ status = null } = {}) {
    if (status && status !== 'all') {
      const row = db.get('SELECT COUNT(*) as count FROM post WHERE status = ?', status);
      return row ? row.count : 0;
    }
    const row = db.get('SELECT COUNT(*) as count FROM post');
    return row ? row.count : 0;
  },

  totalViews() {
    const row = db.get('SELECT SUM(views) as total FROM post');
    return row && row.total ? row.total : 0;
  }
};

module.exports = Post;
