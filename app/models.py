from datetime import datetime
import uuid
from flask_login import UserMixin
from app import db


# ── Topic ──────────────────────────────────────────────────────────────────────

class Topic(db.Model):
    """Admin-managed navigation categories for the writing page."""
    id       = db.Column(db.Integer, primary_key=True)
    name     = db.Column(db.String(100), unique=True, nullable=False)
    slug     = db.Column(db.String(100), unique=True, nullable=False, index=True)
    order    = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    posts    = db.relationship('Post', back_populates='topic', lazy='dynamic')

    @classmethod
    def get_first(cls):
        return cls.query.order_by(cls.order, cls.id).first()

    def __repr__(self):
        return f'<Topic {self.name}>'


# ── Tag ────────────────────────────────────────────────────────────────────────

post_tags = db.Table(
    'post_tags',
    db.Column('post_id', db.Integer, db.ForeignKey('post.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True),
)


class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    slug = db.Column(db.String(80), unique=True, nullable=False)

    def __repr__(self):
        return f'<Tag {self.name}>'


# ── Post ───────────────────────────────────────────────────────────────────────

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    # Core content
    title = db.Column(db.String(300), nullable=False)
    slug = db.Column(db.String(300), unique=True, nullable=False, index=True)
    subtitle = db.Column(db.String(500))
    content_json = db.Column(db.Text)          # Tiptap JSON blob
    content_html = db.Column(db.Text)          # Sanitised rendered HTML

    # Media
    cover_image = db.Column(db.String(500))    # URL (local or Cloudinary)
    cover_image_alt = db.Column(db.String(300))

    # Status & type
    STATUS_DRAFT = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_SCHEDULED = 'scheduled'
    status = db.Column(db.String(20), default='draft', nullable=False, index=True)

    TYPE_ESSAY = 'essay'
    TYPE_NOTE = 'note'
    TYPE_THREAD = 'thread'
    post_type = db.Column(db.String(20), default='essay', nullable=False)

    # Metadata
    reading_time = db.Column(db.Integer, default=1)  # minutes
    featured = db.Column(db.Boolean, default=False)
    views = db.Column(db.Integer, default=0)
    comment_count = db.Column(db.Integer, default=0)

    # SEO
    seo_title = db.Column(db.String(300))
    seo_desc = db.Column(db.String(500))
    og_image = db.Column(db.String(500))

    # Timestamps
    published_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Topic FK (navigation category — managed in admin)
    topic_id = db.Column(db.Integer, db.ForeignKey('topic.id'), nullable=True, index=True)
    topic    = db.relationship('Topic', back_populates='posts', foreign_keys=[topic_id])

    # Relations
    tags = db.relationship('Tag', secondary=post_tags, backref='posts', lazy='dynamic')

    def calculate_reading_time(self):
        """Estimate reading time based on HTML content (avg 200 wpm)."""
        if self.content_html:
            import re
            text = re.sub(r'<[^>]+>', '', self.content_html)
            word_count = len(text.split())
            self.reading_time = max(1, round(word_count / 200))

    @property
    def effective_seo_title(self):
        return self.seo_title or self.title

    @property
    def effective_seo_desc(self):
        return self.seo_desc or self.subtitle or ''

    @property
    def effective_og_image(self):
        return self.og_image or self.cover_image or ''

    @property
    def tag_names(self):
        return [t.name for t in self.tags]

    @property
    def is_published(self):
        return self.status == self.STATUS_PUBLISHED

    def update_comment_count(self):
        """Update comment count based on approved comments only."""
        self.comment_count = Comment.query.filter_by(post_id=self.id, status=Comment.STATUS_APPROVED).count()

    def __repr__(self):
        return f'<Post {self.slug}>'


# ── Comment ────────────────────────────────────────────────────────────────────

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False, index=True)
    author_name = db.Column(db.String(120), nullable=False)
    author_email = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)

    # Status constants
    STATUS_APPROVED = 'approved'
    STATUS_PENDING = 'pending_moderation'
    STATUS_SPAM = 'spam'
    STATUS_DELETED = 'deleted'

    status = db.Column(db.String(30), default='approved', nullable=False, index=True)
    flagged_reason = db.Column(db.String(255))
    is_author = db.Column(db.Boolean, default=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relations
    post = db.relationship('Post', backref=db.backref('comments', lazy='dynamic', cascade='all, delete-orphan'))
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='dynamic')

    @property
    def is_approved(self):
        return self.status == self.STATUS_APPROVED

    @property
    def is_pending(self):
        return self.status == self.STATUS_PENDING

    def __repr__(self):
        return f'<Comment {self.id} by {self.author_name} ({self.status})>'


# ── Subscriber ─────────────────────────────────────────────────────────────────

class Subscriber(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False, index=True)
    name = db.Column(db.String(200))
    status = db.Column(db.String(20), default='active', nullable=False)  # active | unsubscribed
    source = db.Column(db.String(100))         # homepage | post | footer | newsletter
    unsubscribe_token = db.Column(
        db.String(64), unique=True, nullable=False,
        default=lambda: uuid.uuid4().hex
    )
    subscribed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    unsubscribed_at = db.Column(db.DateTime)

    @property
    def is_active(self):
        return self.status == 'active'

    def __repr__(self):
        return f'<Subscriber {self.email}>'


# ── Admin User (for Flask-Login) ───────────────────────────────────────────────

class AdminUser(UserMixin):
    """Virtual user — credentials stored in .env, not DB."""
    id = 1
    username = 'admin'

    def get_id(self):
        return str(self.id)


# ── About Me ───────────────────────────────────────────────────────────────────

class AboutMe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), default='Alex Ore')
    tagline = db.Column(db.String(300), default='Writer, thinker, and builder.')
    avatar_image = db.Column(db.String(500))
    summary = db.Column(db.Text)               # Short bio for bottom of homepage
    full_content_html = db.Column(db.Text)     # Long-form story for /about page
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @classmethod
    def get_instance(cls):
        inst = cls.query.first()
        if not inst:
            inst = cls(
                name='Alex Ore',
                tagline='Exploring human potential, modern systems, and the art of independent thinking.',
                summary=(
                    'I write to understand the world and distill high-leverage mental models, systems, '
                    'and human habits that compound over a lifetime.\n\n'
                    'Through essays, frameworks, and curated resources, my goal is to help modern '
                    'builders think clearly, write persuasively, and design a life on their own terms.'
                ),
                full_content_html=(
                    '<h2>Why I Write</h2>\n'
                    '<p>Writing is the ultimate tool for thinking clearly. In an age of infinite noise, the ability to synthesize complex ideas into concise, actionable insight is the highest leverage skill you can cultivate.</p>\n'
                    '<h2>The Philosophy</h2>\n'
                    '<p>We live in a world where technical skills are being commoditized at unprecedented speed. The human layer—focus, emotional fluency, clear communication, and deliberate self-direction—is what separates genuine creators from commodity labor.</p>\n'
                    '<h2>What You Will Find Here</h2>\n'
                    '<p>Every essay and resource on this site is an honest distillation of real-world experiments, philosophical inquiry, and practical systems built to compound over decades.</p>'
                )
            )
            db.session.add(inst)
            db.session.commit()
        return inst

    def __repr__(self):
        return f'<AboutMe {self.name}>'


# ── Legal Page ─────────────────────────────────────────────────────────────────

class LegalPage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(80), unique=True, nullable=False, index=True)  # terms | privacy | disclaimer
    title = db.Column(db.String(200), nullable=False)
    content_html = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<LegalPage {self.slug}>'
