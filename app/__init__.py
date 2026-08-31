import os
from datetime import datetime
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from config import config

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access the admin panel.'
login_manager.login_message_category = 'info'


def create_app(config_name=None):
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_object(config[config_name])

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Register blueprints
    from app.routes.public import public_bp
    from app.routes.admin import admin_bp
    from app.routes.auth import auth_bp
    from app.routes.api import api_bp

    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(api_bp, url_prefix='/api')

    # Inject site config into all templates
    @app.context_processor
    def inject_site_config():
        return {
            'SITE_NAME': app.config['SITE_NAME'],
            'SITE_TAGLINE': app.config['SITE_TAGLINE'],
            'SITE_AUTHOR': app.config['SITE_AUTHOR'],
            'TWITTER_URL': app.config['TWITTER_URL'],
            'LINKEDIN_URL': app.config['LINKEDIN_URL'],
            'INSTAGRAM_URL': app.config['INSTAGRAM_URL'],
            'YOUTUBE_URL': app.config['YOUTUBE_URL'],
            'now': datetime.utcnow(),
        }

    # Template filter for Markdown and HTML rendering
    @app.template_filter('markdown_or_html')
    def markdown_or_html_filter(text):
        if not text:
            return ''
        import markdown
        return markdown.markdown(text, extensions=['extra', 'sane_lists', 'tables'])

    return app
