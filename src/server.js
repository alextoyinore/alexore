const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const path = require('path');
const { marked } = require('marked');

const config = require('./config');
const { initSchema } = require('./db/schema');
const { router: publicRouter } = require('./routes/public');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

// Initialize database schema
initSchema();

const app = express();

// View engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Body parsers
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser(config.SECRET_KEY));

// Session & Flash
app.use(
  session({
    secret: config.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);
app.use(flash());

// Serve static assets
app.use('/static', express.static(path.join(__dirname, '../app/static')));

// Global Template Helpers & Variables
app.use((req, res, next) => {
  res.locals.SITE_NAME = config.SITE_NAME;
  res.locals.SITE_TAGLINE = config.SITE_TAGLINE;
  res.locals.SITE_DESCRIPTION = config.SITE_DESCRIPTION;
  res.locals.SITE_AUTHOR = config.SITE_AUTHOR;
  res.locals.TWITTER_URL = config.TWITTER_URL;
  res.locals.LINKEDIN_URL = config.LINKEDIN_URL;
  res.locals.INSTAGRAM_URL = config.INSTAGRAM_URL;
  res.locals.YOUTUBE_URL = config.YOUTUBE_URL;
  res.locals.RESEND_FROM_EMAIL = config.RESEND_FROM_EMAIL;
  res.locals.now = new Date();

  // Session state
  res.locals.is_authenticated = Boolean(req.session && req.session.isAdmin);
  res.locals.current_user = req.session && req.session.isAdmin ? req.session.adminUser : null;

  // Flash messages helper
  const flashMessages = req.flash();
  res.locals.messages = flashMessages;
  res.locals.get_flashed_messages = (opts = {}) => {
    if (opts.with_categories) {
      const list = [];
      for (const [cat, msgs] of Object.entries(flashMessages)) {
        for (const m of msgs) {
          list.push([cat, m]);
        }
      }
      return list;
    }
    return Object.values(flashMessages).flat();
  };

  // Helper for rendering Markdown or HTML
  res.locals.markdown_or_html = (content) => {
    if (!content) return '';
    return marked.parse(content);
  };

  // URL generator helper
  res.locals.url_for = (endpoint, params = {}) => {
    if (endpoint === 'static') {
      return `/static/${params.filename || ''}`;
    }
    const routes = {
      'public.index': '/',
      'public.about': '/about',
      'public.writing': '/writing',
      'public.store': '/store',
      'public.newsletter': '/newsletter',
      'public.resources': '/resources',
      'public.terms': '/terms',
      'public.privacy': '/privacy',
      'public.disclaimer': '/disclaimer',
      'admin.dashboard': '/admin',
      'admin.posts': '/admin/posts',
      'admin.new_post': '/admin/new',
      'admin.products': '/admin/products',
      'admin.new_product': '/admin/products/new',
      'admin.comments': '/admin/comments',
      'admin.subscribers': '/admin/subscribers',
      'admin.send_email': '/admin/send-email',
      'admin.topics': '/admin/topics',
      'admin.edit_about': '/admin/about',
      'admin.legal_pages': '/admin/legal',
      'admin.resources': '/admin/resources',
      'admin.settings': '/admin/settings',
      'auth.login': '/auth/login',
      'auth.logout': '/auth/logout'
    };

    if (routes[endpoint]) return routes[endpoint];
    if (endpoint === 'public.post' && params.slug) return `/writing/${params.slug}`;
    if (endpoint === 'public.store_product' && params.slug) return `/store/${params.slug}`;
    if (endpoint === 'public.topic_writing' && params.slug) return `/writing/topic/${params.slug}`;
    if (endpoint === 'public.tag' && params.slug) return `/tag/${params.slug}`;
    if (endpoint === 'public.resource_detail' && params.slug) return `/resources/${params.slug}`;
    if (endpoint === 'public.unsubscribe' && params.token) return `/unsubscribe/${params.token}`;
    if (endpoint === 'admin.edit_post' && params.post_id) return `/admin/edit/${params.post_id}`;
    if (endpoint === 'admin.delete_post' && params.post_id) return `/admin/delete/${params.post_id}`;
    if (endpoint === 'admin.edit_product' && params.id) return `/admin/products/edit/${params.id}`;
    if (endpoint === 'admin.delete_product' && params.id) return `/admin/products/delete/${params.id}`;

    return '/';
  };

  // Request info
  res.locals.request = {
    url: req.url,
    path: req.path,
    query: req.query,
    endpoint: req.baseUrl ? `${req.baseUrl.replace('/', '')}.${req.path.replace('/', '')}` : req.path
  };

  next();
});

// Mount Routes
app.use('/', publicRouter);
app.use('/admin', adminRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).render('public/404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('public/404', { title: 'Something went wrong' });
});

if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`✦ AlexOre running on Node.js at http://localhost:${config.PORT}`);
  });
}

module.exports = app;
