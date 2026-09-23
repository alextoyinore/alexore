const express = require('express');
const router = express.Router();
const Post = require('../models/post');
const Product = require('../models/product');
const Topic = require('../models/topic');
const Tag = require('../models/tag');
const Subscriber = require('../models/subscriber');
const Comment = require('../models/comment');
const AboutMe = require('../models/aboutMe');
const LegalPage = require('../models/legalPage');

const RESOURCES = [
  {
    slug: 'soft-skills-academy',
    name: 'Soft Skills Academy',
    icon: '🧠',
    tagline: 'The human skills that no algorithm can replace.',
    cta: 'Join Soft Skills Academy',
    description: 'Master communication, emotional intelligence, focus, and leadership systems built for modern creators & professionals.',
    body: `Most people optimise for technical skills. But the people who actually lead, inspire, and build lasting influence are the ones who mastered the human layer first.

Soft Skills Academy is a structured curriculum for developing the high-leverage, high-impact abilities that compound over a lifetime: clear thinking, deep communication, emotional fluency, and the ability to lead yourself before leading others.

Each module is practical, research-backed, and designed to be applied immediately — not just studied.`,
    features: [
      'Self-paced modules on communication, focus & emotional intelligence',
      'Weekly essay drops distilling key frameworks',
      'Practical exercises — not just theory',
      'Access to a library of mental models for decision-making',
      'Community of professionals committed to intentional growth'
    ]
  },
  {
    slug: 'one-school',
    name: 'One School',
    icon: '✦',
    tagline: 'The holistic digital education platform for polymaths & modern builders.',
    cta: 'Explore One School',
    description: 'Synthesize your passions, build digital leverage, and design an independent life with our flagship curriculum.',
    body: `The education system was designed for a world that no longer exists. One School is built for the world we're actually living in.

We believe the best thinkers and creators are polymaths — people who can draw connections across disciplines, synthesize ideas into unique insight, and build leverage from their curiosity.

One School is a living curriculum that teaches you how to learn, think, create, and build in the digital age — without giving up the depth and craft that separates great work from noise.`,
    features: [
      'Cross-disciplinary curriculum spanning writing, philosophy, tech & business',
      'Project-based learning — build something real while you study',
      'Flagship cohorts with live sessions and direct feedback',
      'Personal knowledge management system included',
      'Lifetime access to all course material updates'
    ]
  },
  {
    slug: 'the-toolkit',
    name: 'The Toolkit',
    icon: '⚙',
    tagline: 'Curated tools, frameworks & resources for the independent creator.',
    cta: 'Explore The Toolkit',
    description: 'Curated tools, mental models, and frameworks used by the world\'s most effective thinkers, writers & builders.',
    body: `Stop drowning in productivity advice. The Toolkit is a hand-curated, opinionated collection of the tools and systems that actually move the needle — tested, refined, and used daily.

From writing and thinking tools to business infrastructure and creative systems, every recommendation comes with context: why it works, how to use it, and when to move on.

No affiliate spam. No bloated lists. Just the best tools for building a focused, independent creative life.`,
    features: [
      'Curated list of writing, research & thinking tools',
      'Mental model reference library',
      'Business & creator infrastructure recommendations',
      'New additions every month — curated, not aggregated',
      'Honest reviews with real-world context'
    ]
  },
  {
    slug: 'the-archive',
    name: 'The Archive',
    icon: '📚',
    tagline: 'Every essay, idea, and thread — organised for deep reading.',
    cta: 'Browse The Archive',
    description: 'A structured, searchable library of every essay, idea, and piece of writing published on this site.',
    body: `Great writing is meant to be revisited. The Archive is a structured home for every piece of long-form work published here — searchable, tagged, and organised by theme.

Whether you want to follow a thread on philosophy, deep-dive into creative systems, or trace the evolution of an idea over time — the Archive makes it easy.

This is not a feed. It's a library.`,
    features: [
      'Every published essay, searchable by topic and date',
      'Curated reading paths for new readers',
      'Tag-based navigation across themes',
      'Highlighted editor\'s picks and most-read pieces'
    ]
  },
  {
    slug: 'the-letter',
    name: 'The Letter',
    icon: '✉',
    tagline: 'High-signal essays delivered to your inbox twice a week.',
    cta: 'Subscribe Free',
    description: 'A free newsletter on thinking, writing, and building a life on your own terms. No spam. No filler.',
    body: `The Letter is a twice-weekly dispatch for people who want to think better, write clearly, and build something worth building.

Each issue explores one idea in depth — pulled from philosophy, psychology, business, or whatever has caught my attention that week — and distilled into something practical and clear.

No sponsored content. No roundups. Just one writer\'s honest thinking, sent directly to you.`,
    features: [
      'Two essays per week — focused and substantive',
      'No ads, sponsorships or affiliate links',
      'Searchable back-issues for every subscriber',
      'Exclusive subscriber-only posts and early access',
      '1-click unsubscribe, always'
    ]
  },
  {
    slug: 'the-reading-list',
    name: 'The Reading List',
    icon: '🔖',
    tagline: 'Books, essays, and ideas that have shaped the way I think.',
    cta: 'Explore The Reading List',
    description: 'A curated list of the books and essays that have most influenced how I think, write, and build.',
    body: `I don\'t read to consume — I read to think. This reading list is a running record of the books, essays, and long-form pieces that have genuinely changed something about how I see the world.

Each entry comes with a note on why it mattered and what I took from it. Not a summary. Not a review. Just honest context.

Updated regularly as I read. Organized by theme, not date.`,
    features: [
      'Organised by theme: philosophy, creativity, business, science',
      'Personal notes on why each book mattered',
      'Regularly updated as new reads are absorbed',
      'Honest ratings — no five-stars-for-everything inflation'
    ]
  }
];

const RESOURCES_BY_SLUG = {};
for (const r of RESOURCES) {
  RESOURCES_BY_SLUG[r.slug] = r;
}

// ── Home ───────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const latest_posts = Post.findLatestPublished(8);
  const featured_post = Post.findFeaturedPublished();
  const all_tags = Tag.findAll();
  const total_posts_count = Post.count({ status: 'published' });
  const subscriber_count = Subscriber.count({ status: 'active' });
  const about_data = AboutMe.getInstance();
  const featured_products = Product.findAll({ status: 'published', featured: true }).slice(0, 3);

  res.render('public/index', {
    title: null,
    latest_posts,
    featured_post,
    all_tags,
    total_posts_count,
    subscriber_count,
    about: about_data,
    featured_products
  });
});

// ── About ──────────────────────────────────────────────────────────────────────
router.get('/about', (req, res) => {
  const about_data = AboutMe.getInstance();
  res.render('public/about', {
    title: 'About',
    about: about_data
  });
});

// ── Writing & Essays Feed ──────────────────────────────────────────────────────
router.get('/writing', (req, res) => {
  const feed = req.query.feed || 'latest';
  const q = (req.query.q || '').trim();
  const page = parseInt(req.query.page || '1', 10);

  const posts = Post.paginatePublished({ page, perPage: 10, feed, q });
  const all_topics = Topic.findAll();
  const subscriber_count = Subscriber.count({ status: 'active' });
  const popular_posts = Post.findPopularPublished(4);
  const featured_post = Post.findFeaturedPublished();

  res.render('public/writing', {
    title: 'Writing',
    posts,
    all_topics,
    active_topic: null,
    active_tag: null,
    active_feed: feed,
    search_query: q,
    subscriber_count,
    featured_post,
    popular_posts,
    recommendations: RESOURCES
  });
});

router.get('/writing/topic/:slug', (req, res) => {
  const topic = Topic.findBySlug(req.params.slug);
  if (!topic) {
    return res.status(404).render('public/404', { title: 'Topic Not Found' });
  }

  const feed = req.query.feed || 'latest';
  const q = (req.query.q || '').trim();
  const page = parseInt(req.query.page || '1', 10);

  const posts = Post.paginatePublished({ page, perPage: 10, feed, q, topicId: topic.id });
  const all_topics = Topic.findAll();
  const subscriber_count = Subscriber.count({ status: 'active' });

  res.render('public/writing', {
    title: topic.name,
    posts,
    all_topics,
    active_topic: topic,
    active_tag: null,
    active_feed: feed,
    search_query: q,
    subscriber_count,
    featured_post: null,
    popular_posts: [],
    recommendations: RESOURCES
  });
});

router.get('/tag/:slug', (req, res) => {
  const tag = Tag.findBySlug(req.params.slug);
  if (!tag) {
    return res.status(404).render('public/404', { title: 'Tag Not Found' });
  }

  const feed = req.query.feed || 'latest';
  const q = (req.query.q || '').trim();
  const page = parseInt(req.query.page || '1', 10);

  const posts = Post.paginatePublished({ page, perPage: 10, feed, q, tagSlug: tag.slug });
  const all_topics = Topic.findAll();
  const subscriber_count = Subscriber.count({ status: 'active' });

  res.render('public/writing', {
    title: `#${tag.name}`,
    posts,
    all_topics,
    active_topic: null,
    active_tag: tag,
    active_feed: feed,
    search_query: q,
    subscriber_count,
    featured_post: null,
    popular_posts: [],
    recommendations: RESOURCES
  });
});

router.get('/writing/:slug', (req, res) => {
  const post = Post.findPublishedBySlug(req.params.slug);
  if (!post) {
    return res.status(404).render('public/404', { title: 'Post Not Found' });
  }

  // Increment views
  Post.incrementViews(post.id);

  // Fetch comments
  const comments = Comment.findApprovedByPost(post.id);
  const related_posts = Post.findRelatedPublished(post.id, 3);

  res.render('public/post', {
    title: post.title,
    post,
    related_posts,
    comments
  });
});

// ── DIGITAL PRODUCTS STORE ─────────────────────────────────────────────────────
router.get('/store', (req, res) => {
  const category_filter = req.query.category || 'all';
  const products = Product.findPublished({ category: category_filter });
  const categories = Product.getCategories();

  res.render('public/store', {
    title: 'Digital Store & Products',
    products,
    categories,
    category_filter
  });
});

router.get('/store/:slug', (req, res) => {
  const product = Product.findBySlug(req.params.slug);
  if (!product || product.status !== 'published') {
    return res.status(404).render('public/404', { title: 'Product Not Found' });
  }

  // Increment product views
  Product.incrementViews(product.id);

  // Fetch other related products
  const related = Product.findPublished()
    .filter(p => p.id !== product.id)
    .slice(0, 3);

  res.render('public/product_detail', {
    title: `${product.title} — Digital Product`,
    product,
    related
  });
});

// Track outbound clicks and redirect to external store URL
router.get('/store/:slug/buy', (req, res) => {
  const product = Product.findBySlug(req.params.slug);
  if (!product) {
    return res.redirect('/store');
  }

  // Increment outbound click analytics
  Product.incrementClicks(product.id);

  // Redirect visitor to final destination (Amazon, Selar, Gumroad, etc.)
  return res.redirect(product.external_store_url);
});

// ── Newsletter ─────────────────────────────────────────────────────────────────
router.get('/newsletter', (req, res) => {
  res.render('public/newsletter', {
    title: 'Newsletter'
  });
});

router.get('/unsubscribe/:token', (req, res) => {
  const sub = Subscriber.unsubscribe(req.params.token);
  if (!sub) {
    return res.status(404).render('public/404', { title: 'Invalid Token' });
  }
  res.render('public/unsubscribed', {
    title: 'Unsubscribed',
    subscriber: sub
  });
});

// ── Legal Pages ────────────────────────────────────────────────────────────────
router.get('/terms', (req, res) => {
  const page = LegalPage.findBySlug('terms');
  res.render('public/legal', {
    title: page.title,
    page
  });
});

router.get('/privacy', (req, res) => {
  const page = LegalPage.findBySlug('privacy');
  res.render('public/legal', {
    title: page.title,
    page
  });
});

router.get('/disclaimer', (req, res) => {
  const page = LegalPage.findBySlug('disclaimer');
  res.render('public/legal', {
    title: page.title,
    page
  });
});

// ── Resources ──────────────────────────────────────────────────────────────────
router.get('/resources', (req, res) => {
  res.render('public/resources', {
    title: 'Curated Resources',
    resources: RESOURCES
  });
});

router.get('/resources/:slug', (req, res) => {
  const resource = RESOURCES_BY_SLUG[req.params.slug];
  if (!resource) {
    return res.status(404).render('public/404', { title: 'Resource Not Found' });
  }
  res.render('public/resource_detail', {
    title: resource.name,
    resource
  });
});

module.exports = {
  router,
  RESOURCES,
  RESOURCES_BY_SLUG
};
