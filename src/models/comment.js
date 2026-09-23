const db = require('../db');

const Comment = {
  STATUS_APPROVED: 'approved',
  STATUS_PENDING: 'pending_moderation',
  STATUS_SPAM: 'spam',
  STATUS_DELETED: 'deleted',

  findById(id) {
    return db.get('SELECT * FROM comment WHERE id = ?', id);
  },

  findApprovedByPost(postId) {
    // Fetch all approved comments for post
    const all = db.all(
      "SELECT * FROM comment WHERE post_id = ? AND status = 'approved' ORDER BY created_at ASC",
      postId
    );

    // Group into top-level and nested replies
    const topLevel = [];
    const replyMap = {};

    for (const c of all) {
      c.replies = [];
      replyMap[c.id] = c;
      if (c.parent_id && replyMap[c.parent_id]) {
        replyMap[c.parent_id].replies.push(c);
      } else {
        topLevel.push(c);
      }
    }

    return topLevel;
  },

  findAll({ status = null } = {}) {
    let sql = `
      SELECT c.*, p.title as post_title, p.slug as post_slug
      FROM comment c
      LEFT JOIN post p ON p.id = c.post_id
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' WHERE c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC';
    return db.all(sql, ...params);
  },

  getCounts() {
    const all = db.get('SELECT COUNT(*) as count FROM comment')?.count || 0;
    const pending = db.get("SELECT COUNT(*) as count FROM comment WHERE status = 'pending_moderation'")?.count || 0;
    const approved = db.get("SELECT COUNT(*) as count FROM comment WHERE status = 'approved'")?.count || 0;
    const spam = db.get("SELECT COUNT(*) as count FROM comment WHERE status = 'spam'")?.count || 0;
    return { all, pending, approved, spam };
  },

  create(data) {
    const now = new Date().toISOString();
    const res = db.run(
      `INSERT INTO comment (
        post_id, author_name, author_email, content, status,
        flagged_reason, is_author, parent_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.post_id,
      data.author_name,
      data.author_email,
      data.content,
      data.status || 'approved',
      data.flagged_reason || null,
      data.is_author ? 1 : 0,
      data.parent_id || null,
      now
    );
    return this.findById(res.lastInsertRowid);
  },

  setStatus(id, status) {
    db.run('UPDATE comment SET status = ? WHERE id = ?', status, id);
    const comment = this.findById(id);
    if (comment && comment.post_id) {
      const Post = require('./post');
      Post.updateCommentCount(comment.post_id);
    }
    return comment;
  },

  delete(id) {
    const comment = this.findById(id);
    db.run('DELETE FROM comment WHERE id = ?', id);
    if (comment && comment.post_id) {
      const Post = require('./post');
      Post.updateCommentCount(comment.post_id);
    }
  }
};

module.exports = Comment;
