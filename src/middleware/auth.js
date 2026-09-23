function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  req.session.nextUrl = req.originalUrl;
  req.flash('info', 'Please log in to access the admin panel.');
  return res.redirect('/auth/login');
}

module.exports = { requireAuth };
