const db = require('../db');

const DEFAULT_SUMMARY = `I write to understand the world and distill high-leverage mental models, systems, and human habits that compound over a lifetime.

Through essays, frameworks, and curated resources, my goal is to help modern builders think clearly, write persuasively, and design a life on their own terms.`;

const DEFAULT_FULL_HTML = `<h2>Why I Write</h2>
<p>Writing is the ultimate tool for thinking clearly. In an age of infinite noise, the ability to synthesize complex ideas into concise, actionable insight is the highest leverage skill you can cultivate.</p>
<h2>The Philosophy</h2>
<p>We live in a world where technical skills are being commoditized at unprecedented speed. The human layer—focus, emotional fluency, clear communication, and deliberate self-direction—is what separates genuine creators from commodity labor.</p>
<h2>What You Will Find Here</h2>
<p>Every essay and resource on this site is an honest distillation of real-world experiments, philosophical inquiry, and practical systems built to compound over decades.</p>`;

const AboutMe = {
  getInstance() {
    let inst = db.get('SELECT * FROM about_me LIMIT 1');
    if (!inst) {
      const now = new Date().toISOString();
      const res = db.run(
        `INSERT INTO about_me (name, tagline, avatar_image, summary, full_content_html, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        'Alex Ore',
        'Exploring human potential, modern systems, and the art of independent thinking.',
        null,
        DEFAULT_SUMMARY,
        DEFAULT_FULL_HTML,
        now
      );
      inst = db.get('SELECT * FROM about_me WHERE id = ?', res.lastInsertRowid);
    }
    return inst;
  },

  update(data) {
    const current = this.getInstance();
    const now = new Date().toISOString();
    db.run(
      `UPDATE about_me SET
        name = ?, tagline = ?, avatar_image = ?, summary = ?, full_content_html = ?, updated_at = ?
       WHERE id = ?`,
      data.name || current.name,
      data.tagline !== undefined ? data.tagline : current.tagline,
      data.avatar_image !== undefined ? data.avatar_image : current.avatar_image,
      data.summary !== undefined ? data.summary : current.summary,
      data.full_content_html !== undefined ? data.full_content_html : current.full_content_html,
      now,
      current.id
    );
    return this.getInstance();
  }
};

module.exports = AboutMe;
