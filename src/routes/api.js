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
const Subscriber = require('../models/subscriber');
const Comment = require('../models/comment');
const { checkCommentModeration, sanitizeCommentContent } = require('../utils/moderation');
const { sendWelcomeEmail } = require('../utils/email');

// Ensure upload folder exists
if (!fs.existsSync(config.UPLOAD_FOLDER)) {
  fs.mkdirSync(config.UPLOAD_FOLDER, { recursive: true });
}

// Multer memory storage for image processing with sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_CONTENT_LENGTH },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/avif'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Image Upload API
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || '.webp';
    const filename = `${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(config.UPLOAD_FOLDER, filename);

    // Save and optimize with sharp
    if (ext === '.gif') {
      // Don't re-encode animated GIFs
      fs.writeFileSync(targetPath, req.file.buffer);
    } else {
      await sharp(req.file.buffer)
        .rotate() // auto-orient based on EXIF
        .toFile(targetPath);
    }

    const url = `/static/uploads/${filename}`;
    return res.json({ url, filename });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to process image' });
  }
});

// Autosave API
router.post('/autosave', requireAuth, (req, res) => {
  const { post_id, content_html, title } = req.body || {};

  if (post_id) {
    const p = Post.findById(post_id);
    if (p) {
      Post.update(post_id, {
        content_html: content_html || p.content_html,
        title: title || p.title
      });
      return res.json({ status: 'saved', post_id: p.id });
    }
  }

  return res.json({ status: 'skipped' });
});

// Newsletter Subscribe API
router.post('/subscribe', async (req, res) => {
  const body = req.body || {};
  const email = (body.email || '').trim().toLowerCase();
  const name = (body.name || '').trim();
  const source = (body.source || 'homepage').trim();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const existing = Subscriber.findByEmail(email);
    if (existing) {
      if (name) {
        Subscriber.updateName(email, name);
      }
      if (existing.status === 'unsubscribed') {
        Subscriber.reactivate(email, name);
      }
      return res.status(200).json({
        message: `All set${name ? ' ' + name : ''}! Welcome to the newsletter.`,
        step: 'complete',
        email: existing.email
      });
    }

    const sub = Subscriber.create({ email, name, source });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    sendWelcomeEmail(sub, baseUrl).catch(() => {});

    if (name) {
      return res.status(201).json({
        message: `All set, ${name}! Welcome to the newsletter.`,
        step: 'complete',
        email: sub.email
      });
    }

    return res.status(201).json({
      message: "You're in! What's your first name so we can personalize your emails?",
      step: 'collect_name',
      email: sub.email
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Comments Submission API
router.post('/posts/:postId/comments', async (req, res) => {
  const postId = parseInt(req.params.postId, 10);
  const post = Post.findById(postId);

  if (!post || post.status !== 'published') {
    return res.status(404).json({ error: 'Post not found.' });
  }

  const data = req.body || {};
  const author_name = (data.author_name || '').trim();
  const author_email = (data.author_email || '').trim().toLowerCase();
  const raw_content = (data.content || '').trim();
  const parent_id = data.parent_id ? parseInt(data.parent_id, 10) : null;

  if (!author_name) {
    return res.status(400).json({ error: 'Please provide your name.' });
  }
  if (author_name.length > 100) {
    return res.status(400).json({ error: 'Name is too long (maximum 100 characters).' });
  }
  if (!author_email || !author_email.includes('@') || !author_email.includes('.')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (!raw_content) {
    return res.status(400).json({ error: 'Comment content cannot be empty.' });
  }
  if (raw_content.length < 2) {
    return res.status(400).json({ error: 'Comment is too short.' });
  }
  if (raw_content.length > 3000) {
    return res.status(400).json({ error: 'Comment exceeds maximum length of 3000 characters.' });
  }

  // Validate parent comment
  let validParentId = null;
  if (parent_id) {
    const parent = Comment.findById(parent_id);
    if (parent && parent.post_id === post.id && parent.status === 'approved') {
      validParentId = parent.id;
    }
  }

  const sanitizedContent = sanitizeCommentContent(raw_content);
  const isAdmin = Boolean(req.session && req.session.isAdmin);

  let status = 'approved';
  let flagged_reason = null;

  if (!isAdmin) {
    const moderation = checkCommentModeration(raw_content, author_name, author_email);
    if (moderation.isFlagged) {
      status = 'pending_moderation';
      flagged_reason = moderation.reason;
    }
  }

  const comment = Comment.create({
    post_id: post.id,
    author_name,
    author_email,
    content: sanitizedContent,
    status,
    flagged_reason,
    is_author: isAdmin,
    parent_id: validParentId
  });

  // Automatically add commenter to newsletter subscriber list
  try {
    const existingSub = Subscriber.findByEmail(author_email);
    if (!existingSub) {
      const newSub = Subscriber.create({ email: author_email, name: author_name, source: 'comment' });
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      sendWelcomeEmail(newSub, baseUrl).catch(() => {});
    } else if (!existingSub.name && author_name) {
      Subscriber.updateName(author_email, author_name);
    }
  } catch (err) {
    console.error('Auto-subscribe from comment failed:', err);
  }

  if (status === 'approved') {
    Post.updateCommentCount(post.id);
    const updatedPost = Post.findById(post.id);

    return res.status(201).json({
      status: 'approved',
      message: 'Your comment has been posted!',
      comment: {
        id: comment.id,
        author_name: comment.author_name,
        is_author: Boolean(comment.is_author),
        content: comment.content,
        created_at: 'Just now',
        parent_id: comment.parent_id
      },
      comment_count: updatedPost.comment_count
    });
  } else {
    return res.status(200).json({
      status: 'pending_moderation',
      message: 'Thank you! Your comment is awaiting moderation and will appear once approved.',
      comment: null,
      comment_count: post.comment_count
    });
  }
});

module.exports = router;
