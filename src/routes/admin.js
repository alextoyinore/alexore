const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const Post = require('../models/post');
const Product = require('../models/product');
const Topic = require('../models/topic');
const Tag = require('../models/tag');
const Comment = require('../models/comment');
const Subscriber = require('../models/subscriber');
const AboutMe = require('../models/aboutMe');
const LegalPage = require('../models/legalPage');
const { sanitizePostHtml } = require('../utils/moderation');
const { sendTestEmail, sendCampaign } = require('../utils/email');

// Multer upload helper for admin file uploads (covers, avatars)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_CONTENT_LENGTH }
});

// Helper for saving uploaded image buffer to disk
async function saveUploadedImage(file, prefix = 'img') {
  if (!file) return null;
  const ext = path.extname(file.originalname).toLowerCase() || '.webp';
  const filename = `${prefix}_${crypto.randomUUID().slice(0, 10)}${ext}`;
  const targetPath = path.join(config.UPLOAD_FOLDER, filename);

  if (ext === '.gif') {
    fs.writeFileSync(targetPath, file.buffer);
  } else {
    await sharp(file.buffer).rotate().toFile(targetPath);
  }

  return `/static/uploads/${filename}`;
}

// Protect all admin routes
router.use(requireAuth);

// Pending comments count middleware for sidebar badge
router.use((req, res, next) => {
  try {
    const counts = Comment.getCounts();
    res.locals.pending_comments_count = counts.pending;
  } catch (e) {
    res.locals.pending_comments_count = 0;
  }
  next();
});

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const stats = {
    total_posts: Post.count(),
    published: Post.count({ status: 'published' }),
    drafts: Post.count({ status: 'draft' }),
    subscribers: Subscriber.count({ status: 'active' }),
    total_views: Post.totalViews(),
    total_products: Product.count(),
    published_products: Product.count({ status: 'published' }),
    total_clicks: Product.totalClicks()
  };

  const recent_posts = Post.findAll({ limit: 5 });
  const recent_subs = Subscriber.findAll({ limit: 5 });
  const recent_products = Product.findAll().slice(0, 4);

  res.render('admin/dashboard', {
    layout: 'admin/layout',
    title: 'Admin Dashboard',
    stats,
    recent_posts,
    recent_subs,
    recent_products
  });
});

// ── Posts Management ───────────────────────────────────────────────────────────
router.get('/posts', (req, res) => {
  const status_filter = req.query.status || 'all';
  const posts = Post.findAll({ status: status_filter });
  res.render('admin/posts', {
    layout: 'admin/layout',
    title: 'All Posts',
    posts,
    status_filter
  });
});

router.get('/new', (req, res) => {
  const all_tags = Tag.findAll();
  const all_topics = Topic.findAll();
  res.render('admin/editor', {
    layout: 'admin/layout',
    title: 'New Post',
    post: null,
    all_tags,
    all_topics
  });
});

router.post('/new', async (req, res) => {
  await savePost(req, res, null);
});

router.get('/edit/:id', (req, res) => {
  const post = Post.findById(parseInt(req.params.id, 10));
  if (!post) {
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }
  const all_tags = Tag.findAll();
  const all_topics = Topic.findAll();
  res.render('admin/editor', {
    layout: 'admin/layout',
    title: `Edit "${post.title}"`,
    post,
    all_tags,
    all_topics
  });
});

router.post('/edit/:id', async (req, res) => {
  const post = Post.findById(parseInt(req.params.id, 10));
  if (!post) {
    req.flash('error', 'Post not found.');
    return res.redirect('/admin/posts');
  }
  await savePost(req, res, post);
});

async function savePost(req, res, existingPost) {
  const body = req.body || {};
  const title = (body.title || '').trim();
  if (!title) {
    req.flash('error', 'Title is required.');
    return res.redirect(req.originalUrl);
  }

  const rawHtml = body.content_html || '';
  const content_html = sanitizePostHtml(rawHtml);
  const action = body.action || 'draft';

  let status = 'draft';
  let published_at = existingPost ? existingPost.published_at : null;

  if (action === 'publish') {
    status = 'published';
    if (!published_at) published_at = new Date().toISOString();
  } else if (action === 'schedule') {
    status = 'scheduled';
    if (body.scheduled_at) {
      published_at = new Date(body.scheduled_at).toISOString();
    }
  }

  // Tags parsing
  const tagNames = (body.tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const postData = {
    title,
    slug: (body.slug || '').trim() || title,
    subtitle: (body.subtitle || '').trim(),
    content_json: body.content_json || '',
    content_html,
    seo_title: (body.seo_title || '').trim(),
    seo_desc: (body.seo_desc || '').trim(),
    post_type: body.post_type || 'essay',
    featured: body.featured === 'on',
    topic_id: body.topic_id ? parseInt(body.topic_id, 10) : (Topic.getFirst()?.id || null),
    status,
    published_at,
    cover_image: (body.cover_image || '').trim(),
    cover_image_alt: (body.cover_image_alt || '').trim(),
    tags: tagNames
  };

  let saved;
  if (existingPost) {
    saved = Post.update(existingPost.id, postData);
    req.flash('success', `Post "${saved.title}" updated.`);
  } else {
    saved = Post.create(postData);
    req.flash('success', `Post "${saved.title}" created.`);
  }

  return res.redirect(`/admin/edit/${saved.id}`);
}

router.get('/delete/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const post = Post.findById(id);
  if (post) {
    Post.delete(id);
    req.flash('success', `"${post.title}" was deleted.`);
  }
  res.redirect('/admin/posts');
});

// ── DIGITAL PRODUCTS MANAGEMENT ───────────────────────────────────────────────
router.get('/products', (req, res) => {
  const status_filter = req.query.status || 'all';
  const category_filter = req.query.category || 'all';

  const filter = {};
  if (status_filter !== 'all') filter.status = status_filter;
  if (category_filter !== 'all') filter.category = category_filter;

  const products = Product.findAll(filter);
  const categories = Product.getCategories();
  const totalClicks = Product.totalClicks();

  res.render('admin/products', {
    layout: 'admin/layout',
    title: 'Digital Products',
    products,
    status_filter,
    category_filter,
    categories,
    totalClicks
  });
});

router.get('/products/new', (req, res) => {
  res.render('admin/product_editor', {
    layout: 'admin/layout',
    title: 'Add Digital Product',
    product: null
  });
});

router.post('/products/new', upload.single('cover_file'), async (req, res) => {
  await saveProduct(req, res, null);
});

router.get('/products/edit/:id', (req, res) => {
  const product = Product.findById(parseInt(req.params.id, 10));
  if (!product) {
    req.flash('error', 'Product not found.');
    return res.redirect('/admin/products');
  }
  res.render('admin/product_editor', {
    layout: 'admin/layout',
    title: `Edit "${product.title}"`,
    product
  });
});

router.post('/products/edit/:id', upload.single('cover_file'), async (req, res) => {
  const product = Product.findById(parseInt(req.params.id, 10));
  if (!product) {
    req.flash('error', 'Product not found.');
    return res.redirect('/admin/products');
  }
  await saveProduct(req, res, product);
});

async function saveProduct(req, res, existingProduct) {
  const body = req.body || {};
  const title = (body.title || '').trim();
  const external_store_url = (body.external_store_url || '').trim();

  if (!title) {
    req.flash('error', 'Product title is required.');
    return res.redirect(req.originalUrl);
  }

  if (!external_store_url) {
    req.flash('error', 'External store buy URL is required (where visitors make final purchase).');
    return res.redirect(req.originalUrl);
  }

  let cover_image = (body.cover_image || '').trim();
  if (req.file) {
    try {
      const uploadedUrl = await saveUploadedImage(req.file, 'product');
      if (uploadedUrl) cover_image = uploadedUrl;
    } catch (err) {
      console.error('Product cover upload error:', err);
    }
  }

  const productData = {
    title,
    slug: (body.slug || '').trim() || title,
    subtitle: (body.subtitle || '').trim(),
    creator_name: (body.creator_name || '').trim() || config.SITE_AUTHOR,
    creator_bio: (body.creator_bio || '').trim(),
    category: (body.category || 'E-Book').trim(),
    price: (body.price || 'Free').trim(),
    original_price: (body.original_price || '').trim(),
    cover_image,
    cover_image_alt: (body.cover_image_alt || '').trim() || title,
    content_html: body.content_html || '',
    content_json: body.content_json || '',
    external_store_name: (body.external_store_name || 'Store').trim(),
    external_store_url,
    badge: (body.badge || '').trim(),
    status: body.status || 'published',
    featured: body.featured === 'on' || body.featured === '1',
    order_num: parseInt(body.order_num || '0', 10)
  };

  let saved;
  if (existingProduct) {
    saved = Product.update(existingProduct.id, productData);
    req.flash('success', `Product "${saved.title}" updated.`);
  } else {
    saved = Product.create(productData);
    req.flash('success', `Product "${saved.title}" created.`);
  }

  return res.redirect(`/admin/products/edit/${saved.id}`);
}

router.get('/products/delete/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = Product.findById(id);
  if (product) {
    Product.delete(id);
    req.flash('success', `Product "${product.title}" was deleted.`);
  }
  res.redirect('/admin/products');
});

// ── Comments Moderation ────────────────────────────────────────────────────────
router.get('/comments', (req, res) => {
  const status_filter = req.query.status || 'all';
  const comments = Comment.findAll({ status: status_filter });
  const counts = Comment.getCounts();

  res.render('admin/comments', {
    layout: 'admin/layout',
    title: 'Comments Moderation',
    comments,
    status_filter,
    counts
  });
});

router.get('/comments/:id/approve', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const comment = Comment.setStatus(id, 'approved');
  if (comment) {
    req.flash('success', `Comment from ${comment.author_name} was approved.`);
  }
  res.redirect(req.get('Referrer') || '/admin/comments');
});

router.get('/comments/:id/spam', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const comment = Comment.setStatus(id, 'spam');
  if (comment) {
    req.flash('info', `Comment from ${comment.author_name} marked as spam.`);
  }
  res.redirect(req.get('Referrer') || '/admin/comments');
});

router.get('/comments/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  Comment.delete(id);
  req.flash('success', 'Comment permanently deleted.');
  res.redirect(req.get('Referrer') || '/admin/comments');
});

// ── Subscribers ────────────────────────────────────────────────────────────────
router.get('/subscribers', (req, res) => {
  const subscribers = Subscriber.findAll();
  res.render('admin/subscribers', {
    layout: 'admin/layout',
    title: 'Subscribers',
    subscribers
  });
});

router.get('/subscribers/export', (req, res) => {
  const subs = Subscriber.findAll({ status: 'active' });
  const rows = ['Email,Name,Source,Date'];
  for (const s of subs) {
    const dateStr = s.subscribed_at ? s.subscribed_at.split('T')[0] : '';
    rows.push(`"${s.email}","${(s.name || '').replace(/"/g, '""')}","${s.source || ''}","${dateStr}"`);
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
  res.send(rows.join('\n'));
});

router.get('/subscribers/delete/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = Subscriber.findById(id);
  if (sub) {
    Subscriber.delete(id);
    req.flash('success', `Subscriber "${sub.email}" deleted.`);
  }
  res.redirect('/admin/subscribers');
});

// ── Send Email / Campaign ──────────────────────────────────────────────────────
router.get('/send-email', (req, res) => {
  const active_count = Subscriber.count({ status: 'active' });
  res.render('admin/send_email', {
    layout: 'admin/layout',
    title: 'Send Newsletter',
    active_count
  });
});

router.post('/send-email', async (req, res) => {
  const subject = (req.body.subject || '').trim();
  const body_html = (req.body.body_html || '').trim();
  const action_type = req.body.action_type || 'send';
  const test_email = (req.body.test_email || '').trim();

  if (!subject || !body_html) {
    req.flash('error', 'Subject and body HTML are required.');
    return res.redirect('/admin/send-email');
  }

  if (action_type === 'test') {
    const recipient = test_email || config.RESEND_FROM_EMAIL;
    const ok = await sendTestEmail(subject, body_html, recipient);
    if (ok) {
      req.flash('success', `Test email sent to ${recipient}!`);
    } else {
      req.flash('error', `Failed to send test email to ${recipient}. Verify RESEND_API_KEY in .env.`);
    }
    return res.redirect('/admin/send-email');
  }

  // Broadcast
  const subs = Subscriber.findAll({ status: 'active' });
  if (subs.length === 0) {
    req.flash('warning', 'No active subscribers found.');
    return res.redirect('/admin/send-email');
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await sendCampaign(subject, body_html, subs, baseUrl);
  req.flash('success', `Campaign finished! Sent: ${result.sent}, Failed: ${result.failed}`);
  res.redirect('/admin/subscribers');
});

// ── Topics Management ──────────────────────────────────────────────────────────
router.get('/topics', (req, res) => {
  const topics = Topic.findAll();
  res.render('admin/topics', {
    layout: 'admin/layout',
    title: 'Manage Topics',
    topics,
    edit_topic: null
  });
});

router.post(['/topics', '/topics/new'], (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    req.flash('error', 'Topic name is required.');
    return res.redirect('/admin/topics');
  }
  try {
    Topic.create(name);
    req.flash('success', `Topic "${name}" created.`);
  } catch (err) {
    req.flash('error', `Topic "${name}" already exists or could not be created.`);
  }
  res.redirect('/admin/topics');
});

router.get('/topics/:id/edit', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const topic = Topic.findById(id);
  const topics = Topic.findAll();
  res.render('admin/topics', {
    layout: 'admin/layout',
    title: 'Edit Topic',
    topics,
    edit_topic: topic
  });
});

router.post('/topics/:id/edit', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const name = (req.body.name || '').trim();
  if (name) {
    Topic.update(id, name);
    req.flash('success', `Topic "${name}" updated.`);
  }
  res.redirect('/admin/topics');
});

router.post('/topics/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  Topic.delete(id);
  req.flash('success', 'Topic deleted and posts reassigned.');
  res.redirect('/admin/topics');
});

// ── About Me Management ────────────────────────────────────────────────────────
router.get('/about', (req, res) => {
  const about = AboutMe.getInstance();
  res.render('admin/about', {
    layout: 'admin/layout',
    title: 'About Me Settings',
    about
  });
});

router.post('/about', upload.single('avatar_file'), async (req, res) => {
  const body = req.body || {};
  let avatar_image = (body.avatar_image || '').trim();

  if (req.file) {
    try {
      const uploadedUrl = await saveUploadedImage(req.file, 'avatar');
      if (uploadedUrl) avatar_image = uploadedUrl;
    } catch (err) {
      console.error('Avatar upload error:', err);
    }
  }

  AboutMe.update({
    name: (body.name || '').trim() || config.SITE_AUTHOR,
    tagline: (body.tagline || '').trim(),
    summary: (body.summary || '').trim(),
    full_content_html: (body.full_content_html || '').trim(),
    avatar_image: avatar_image || undefined
  });

  req.flash('success', 'About Me profile updated successfully!');
  res.redirect('/admin/about');
});

// ── Legal Pages Management ─────────────────────────────────────────────────────
router.get('/legal', (req, res) => {
  const pages = LegalPage.findAll();
  res.render('admin/legal', {
    layout: 'admin/layout',
    title: 'Legal Pages',
    pages
  });
});

router.get('/legal/:slug/edit', (req, res) => {
  const page = LegalPage.findBySlug(req.params.slug);
  res.render('admin/legal_editor', {
    layout: 'admin/layout',
    title: `Edit ${page.title}`,
    page
  });
});

router.post('/legal/:slug/edit', (req, res) => {
  const body = req.body || {};
  LegalPage.update(req.params.slug, {
    title: (body.title || '').trim(),
    content_html: (body.content_html || '').trim()
  });
  req.flash('success', 'Legal page updated.');
  res.redirect('/admin/legal');
});

// ── Settings ───────────────────────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  res.render('admin/settings', {
    layout: 'admin/layout',
    title: 'Site Settings',
    config
  });
});

// ── Resources Stubs ────────────────────────────────────────────────────────────
router.get('/resources', (req, res) => {
  const { RESOURCES } = require('./public');
  res.render('admin/resources', {
    layout: 'admin/layout',
    title: 'Resources',
    resources: RESOURCES
  });
});

router.get('/resources/new', (req, res) => {
  res.render('admin/resource_editor', {
    layout: 'admin/layout',
    title: 'New Resource',
    resource: null
  });
});

router.post('/resources/new', (req, res) => {
  req.flash('info', 'Resources management connected.');
  res.redirect('/admin/resources');
});

router.get('/resources/:slug/edit', (req, res) => {
  const { RESOURCES_BY_SLUG } = require('./public');
  const resource = RESOURCES_BY_SLUG[req.params.slug];
  res.render('admin/resource_editor', {
    layout: 'admin/layout',
    title: 'Edit Resource',
    resource
  });
});

router.post('/resources/:slug/edit', (req, res) => {
  req.flash('info', 'Resources updated.');
  res.redirect('/admin/resources');
});

router.get('/resources/:slug/delete', (req, res) => {
  req.flash('info', 'Resource deleted.');
  res.redirect('/admin/resources');
});

module.exports = router;
