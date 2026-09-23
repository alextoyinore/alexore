const db = require('./index');

function initSchema() {
  // Ensure topic table
  db.exec(`
    CREATE TABLE IF NOT EXISTS topic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      "order" INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure tag table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE
    );
  `);

  // Ensure post table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      subtitle TEXT,
      content_json TEXT,
      content_html TEXT,
      cover_image TEXT,
      cover_image_alt TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      post_type TEXT NOT NULL DEFAULT 'essay',
      reading_time INTEGER DEFAULT 1,
      featured INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_desc TEXT,
      og_image TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      topic_id INTEGER REFERENCES topic(id)
    );
  `);

  // Ensure post_tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_tags (
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
  `);

  // Ensure comment table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      flagged_reason TEXT,
      is_author INTEGER DEFAULT 0,
      parent_id INTEGER REFERENCES comment(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure subscriber table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriber (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT,
      unsubscribe_token TEXT NOT NULL UNIQUE,
      subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
      unsubscribed_at TEXT
    );
  `);

  // Ensure about_me table
  db.exec(`
    CREATE TABLE IF NOT EXISTS about_me (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT DEFAULT 'Alex Ore',
      tagline TEXT DEFAULT 'Writer, thinker, and builder.',
      avatar_image TEXT,
      summary TEXT,
      full_content_html TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure legal_page table
  db.exec(`
    CREATE TABLE IF NOT EXISTS legal_page (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content_html TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // DIGITAL PRODUCTS TABLE
  db.exec(`
    CREATE TABLE IF NOT EXISTS product (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      subtitle TEXT,
      creator_name TEXT NOT NULL,
      creator_bio TEXT,
      creator_avatar TEXT,
      category TEXT DEFAULT 'E-Book',
      price TEXT NOT NULL,
      original_price TEXT,
      cover_image TEXT,
      cover_image_alt TEXT,
      content_html TEXT,
      content_json TEXT,
      external_store_name TEXT NOT NULL,
      external_store_url TEXT NOT NULL,
      badge TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      order_num INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Ensure indexes for fast lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_post_slug ON post(slug);
    CREATE INDEX IF NOT EXISTS idx_post_status ON post(status);
    CREATE INDEX IF NOT EXISTS idx_product_slug ON product(slug);
    CREATE INDEX IF NOT EXISTS idx_product_status ON product(status);
    CREATE INDEX IF NOT EXISTS idx_comment_post_id ON comment(post_id);
    CREATE INDEX IF NOT EXISTS idx_subscriber_email ON subscriber(email);
  `);
}

module.exports = { initSchema };
