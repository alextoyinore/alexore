import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-me')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///alexore.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Site identity
    SITE_NAME = os.environ.get('SITE_NAME', 'alexore')
    SITE_TAGLINE = os.environ.get('SITE_TAGLINE', 'Think Deeper. Write Better. Live Free.')
    SITE_DESCRIPTION = os.environ.get('SITE_DESCRIPTION', '')
    SITE_AUTHOR = os.environ.get('SITE_AUTHOR', 'Alex Ore')

    # Admin
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'changeme123')

    # Uploads
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'app/static/uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 10 * 1024 * 1024))
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'}

    # Email
    RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
    RESEND_FROM_EMAIL = os.environ.get('RESEND_FROM_EMAIL', 'hello@example.com')

    # Social
    TWITTER_URL = os.environ.get('TWITTER_URL', '')
    LINKEDIN_URL = os.environ.get('LINKEDIN_URL', '')
    INSTAGRAM_URL = os.environ.get('INSTAGRAM_URL', '')
    YOUTUBE_URL = os.environ.get('YOUTUBE_URL', '')


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', '').replace(
        'postgres://', 'postgresql://'  # Fix for Railway/Heroku
    )


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
