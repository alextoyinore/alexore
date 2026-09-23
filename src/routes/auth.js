const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('auth/login', {
    layout: false,
    title: 'Admin Login'
  });
});

router.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (username === config.ADMIN_USERNAME && password === config.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.adminUser = { id: 1, username: config.ADMIN_USERNAME };

    const nextUrl = req.session.nextUrl || '/admin';
    delete req.session.nextUrl;
    req.flash('success', 'Welcome to the admin panel!');
    return res.redirect(nextUrl);
  } else {
    req.flash('error', 'Invalid credentials.');
    return res.redirect('/auth/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
