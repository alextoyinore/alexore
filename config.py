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

    @staticmethod
    def _build_db_uri():
        """
        Build the SQLAlchemy DB URI for production.
        Prefers DATABASE_URL env var if set.
        Falls back to composing a mysql+pymysql:// URI from individual parts.
        """
        url = os.environ.get('DATABASE_URL', '')
        if url:
            # Normalise legacy postgres:// to postgresql:// (Railway/Heroku)
            url = url.replace('postgres://', 'postgresql://')
            return url

        # Compose MySQL URL from individual cPanel-style env vars
        user   = os.environ.get('DB_USER', '')
        passwd = os.environ.get('DB_PASSWORD', '')
        host   = os.environ.get('DB_HOST', 'localhost')
        port   = os.environ.get('DB_PORT', '3306')
        name   = os.environ.get('DB_NAME', '')
        return f'mysql+pymysql://{user}:{passwd}@{host}:{port}/{name}?charset=utf8mb4'

    SQLALCHEMY_DATABASE_URI = _build_db_uri.__func__()  # evaluated at class load time
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_recycle': 280,   # cPanel MySQL connections drop after ~5 min idle
        'pool_pre_ping': True, # detect stale connections before use
    }


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
