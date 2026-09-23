const db = require('../db');

const LegalPage = {
  findAll() {
    return db.all('SELECT * FROM legal_page ORDER BY id ASC');
  },

  findBySlug(slug) {
    let page = db.get('SELECT * FROM legal_page WHERE slug = ?', slug);
    if (!page) {
      // Seed default if not exists
      const titles = {
        terms: 'Terms of Service',
        privacy: 'Privacy Policy',
        disclaimer: 'Disclaimer'
      };
      const title = titles[slug] || (slug.charAt(0).toUpperCase() + slug.slice(1));
      const content = `<p>This is the ${title} page for this site. You can edit this content in the admin panel.</p>`;
      const now = new Date().toISOString();
      const res = db.run(
        'INSERT INTO legal_page (slug, title, content_html, updated_at) VALUES (?, ?, ?, ?)',
        slug,
        title,
        content,
        now
      );
      page = db.get('SELECT * FROM legal_page WHERE id = ?', res.lastInsertRowid);
    }
    return page;
  },

  update(slug, { title, content_html }) {
    const page = this.findBySlug(slug);
    const now = new Date().toISOString();
    db.run(
      'UPDATE legal_page SET title = ?, content_html = ?, updated_at = ? WHERE slug = ?',
      title || page.title,
      content_html !== undefined ? content_html : page.content_html,
      now,
      slug
    );
    return this.findBySlug(slug);
  }
};

module.exports = LegalPage;
