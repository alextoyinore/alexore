const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SECRET_KEY: process.env.SECRET_KEY || 'dev-secret-key-change-in-production',

  // Site Identity
  SITE_NAME: process.env.SITE_NAME || 'alexore',
  SITE_TAGLINE: process.env.SITE_TAGLINE || 'Think Deeper. Write Better. Live Free.',
  SITE_DESCRIPTION: process.env.SITE_DESCRIPTION || 'Notes on thinking, writing, growth, and building a life on your own terms.',
  SITE_AUTHOR: process.env.SITE_AUTHOR || 'Alex Ore',

  // Admin Credentials
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'changeme123',

  // Uploads
  UPLOAD_FOLDER: path.resolve(process.env.UPLOAD_FOLDER || 'app/static/uploads'),
  MAX_CONTENT_LENGTH: parseInt(process.env.MAX_CONTENT_LENGTH || '10485760', 10), // 10MB default
  ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/avif'],

  // Database
  DB_PATH: path.resolve(process.env.DB_PATH || 'instance/alexore.db'),

  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'alex@alextoyinore.com',

  // Social
  TWITTER_URL: process.env.TWITTER_URL || '',
  LINKEDIN_URL: process.env.LINKEDIN_URL || '',
  INSTAGRAM_URL: process.env.INSTAGRAM_URL || '',
  YOUTUBE_URL: process.env.YOUTUBE_URL || '',
};

module.exports = config;
