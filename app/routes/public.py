from flask import Blueprint, render_template, abort, request, current_app
from app import db
from app.models import Post, Tag, Topic, Subscriber, Comment, AboutMe, LegalPage

public_bp = Blueprint('public', __name__)


@public_bp.route('/')
def index():
    latest_posts = (
        Post.query
        .filter_by(status=Post.STATUS_PUBLISHED)
        .order_by(Post.published_at.desc())
        .limit(8)
        .all()
    )
    featured_post = (
        Post.query
        .filter_by(status=Post.STATUS_PUBLISHED, featured=True)
        .order_by(Post.published_at.desc())
        .first()
    )
    all_tags = Tag.query.all()
    total_posts_count = Post.query.filter_by(status=Post.STATUS_PUBLISHED).count()
    subscriber_count = Subscriber.query.filter_by(status='active').count()
    about_data = AboutMe.get_instance()

    return render_template(
        'public/index.html',
        latest_posts=latest_posts,
        featured_post=featured_post,
        all_tags=all_tags,
        total_posts_count=total_posts_count,
        subscriber_count=subscriber_count,
        about=about_data,
    )


@public_bp.route('/about')
def about():
    about_data = AboutMe.get_instance()
    return render_template('public/about.html', about=about_data)


@public_bp.route('/writing')
def writing():
    feed = request.args.get('feed', 'latest')
    q = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)

    query = Post.query.filter_by(status=Post.STATUS_PUBLISHED)

    if q:
        query = query.filter(
            db.or_(
                Post.title.ilike(f'%{q}%'),
                Post.subtitle.ilike(f'%{q}%'),
                Post.content_html.ilike(f'%{q}%')
            )
        )

    if feed == 'top':
        order_clause = [Post.views.desc(), Post.published_at.desc()]
    elif feed == 'discussions':
        order_clause = [Post.comment_count.desc(), Post.views.desc(), Post.published_at.desc()]
    else:
        feed = 'latest'
        order_clause = [Post.published_at.desc()]

    posts = query.order_by(*order_clause).paginate(
        page=page, per_page=10, error_out=False
    )
    all_topics = Topic.query.order_by(Topic.order, Topic.name).all()
    subscriber_count = Subscriber.query.filter_by(status='active').count()

    popular_posts = (
        Post.query
        .filter_by(status=Post.STATUS_PUBLISHED)
        .order_by(Post.views.desc(), Post.published_at.desc())
        .limit(4)
        .all()
    )

    featured_post = (
        Post.query
        .filter_by(status=Post.STATUS_PUBLISHED, featured=True)
        .order_by(Post.published_at.desc())
        .first()
    )

    return render_template(
        'public/writing.html',
        posts=posts,
        all_topics=all_topics,
        active_topic=None,
        active_feed=feed,
        search_query=q,
        subscriber_count=subscriber_count,
        featured_post=featured_post,
        popular_posts=popular_posts,
        recommendations=_RESOURCES,
    )


@public_bp.route('/writing/topic/<slug>')
def topic_writing(slug):
    topic = Topic.query.filter_by(slug=slug).first_or_404()
    feed = request.args.get('feed', 'latest')
    q = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)

    query = Post.query.filter(
        Post.status == Post.STATUS_PUBLISHED,
        Post.topic_id == topic.id
    )

    if q:
        query = query.filter(
            db.or_(
                Post.title.ilike(f'%{q}%'),
                Post.subtitle.ilike(f'%{q}%'),
                Post.content_html.ilike(f'%{q}%')
            )
        )

    if feed == 'top':
        order_clause = [Post.views.desc(), Post.published_at.desc()]
    elif feed == 'discussions':
        order_clause = [Post.comment_count.desc(), Post.views.desc(), Post.published_at.desc()]
    else:
        feed = 'latest'
        order_clause = [Post.published_at.desc()]

    posts = query.order_by(*order_clause).paginate(page=page, per_page=10, error_out=False)
    all_topics = Topic.query.order_by(Topic.order, Topic.name).all()
    subscriber_count = Subscriber.query.filter_by(status='active').count()

    featured_post = (
        Post.query
        .filter(Post.status == Post.STATUS_PUBLISHED, Post.topic_id == topic.id, Post.featured == True)
        .order_by(Post.published_at.desc())
        .first()
    )

    return render_template(
        'public/writing.html',
        posts=posts,
        all_topics=all_topics,
        active_topic=topic,
        active_feed=feed,
        search_query=q,
        subscriber_count=subscriber_count,
        featured_post=featured_post,
        popular_posts=[],
        recommendations=_RESOURCES,
    )


@public_bp.route('/writing/<slug>')
def post(slug):
    p = Post.query.filter_by(slug=slug, status=Post.STATUS_PUBLISHED).first_or_404()

    # Increment view count
    p.views = (p.views or 0) + 1
    db.session.commit()

    # Fetch top-level approved comments
    comments = (
        Comment.query
        .filter_by(post_id=p.id, status=Comment.STATUS_APPROVED, parent_id=None)
        .order_by(Comment.created_at.asc())
        .all()
    )

    related = (
        Post.query
        .filter(Post.status == Post.STATUS_PUBLISHED, Post.id != p.id)
        .order_by(Post.published_at.desc())
        .limit(3)
        .all()
    )
    return render_template('public/post.html', post=p, related_posts=related, comments=comments)


@public_bp.route('/tag/<slug>')
def tag(slug):
    t = Tag.query.filter_by(slug=slug).first_or_404()
    feed = request.args.get('feed', 'latest')
    q = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)

    query = Post.query.filter(Post.status == Post.STATUS_PUBLISHED, Post.tags.any(Tag.slug == slug))

    if q:
        query = query.filter(
            db.or_(
                Post.title.ilike(f'%{q}%'),
                Post.subtitle.ilike(f'%{q}%'),
                Post.content_html.ilike(f'%{q}%')
            )
        )

    if feed == 'top':
        order_clause = [Post.views.desc(), Post.published_at.desc()]
    elif feed == 'discussions':
        order_clause = [Post.comment_count.desc(), Post.views.desc(), Post.published_at.desc()]
    else:
        feed = 'latest'
        order_clause = [Post.published_at.desc()]

    posts = query.order_by(*order_clause).paginate(page=page, per_page=10, error_out=False)
    all_topics = Topic.query.order_by(Topic.order, Topic.name).all()
    subscriber_count = Subscriber.query.filter_by(status='active').count()

    return render_template(
        'public/writing.html',
        posts=posts,
        all_topics=all_topics,
        active_topic=None,
        active_tag=t,
        active_feed=feed,
        search_query=q,
        subscriber_count=subscriber_count,
        featured_post=None,
        popular_posts=[],
        recommendations=_RESOURCES,
    )


@public_bp.route('/newsletter')
def newsletter():
    return render_template('public/newsletter.html')


@public_bp.route('/unsubscribe/<token>')
def unsubscribe(token):
    from app.models import Subscriber
    from datetime import datetime
    sub = Subscriber.query.filter_by(unsubscribe_token=token).first_or_404()
    sub.status = 'unsubscribed'
    sub.unsubscribed_at = datetime.utcnow()
    db.session.commit()
    return render_template('public/unsubscribed.html', subscriber=sub)


@public_bp.route('/terms')
def terms():
    page = LegalPage.query.filter_by(slug='terms').first()
    return render_template('public/terms.html', page=page)


@public_bp.route('/privacy')
def privacy():
    page = LegalPage.query.filter_by(slug='privacy').first()
    return render_template('public/privacy.html', page=page)


@public_bp.route('/disclaimer')
def disclaimer():
    page = LegalPage.query.filter_by(slug='disclaimer').first()
    return render_template('public/disclaimer.html', page=page)


# ── Dummy resource data — replace with DB model when ready ────────────────────
_RESOURCES = [
    {
        'slug': 'soft-skills-academy',
        'name': 'Soft Skills Academy',
        'icon': '🧠',
        'tagline': 'The human skills that no algorithm can replace.',
        'cta': 'Join Soft Skills Academy',
        'description': 'Master communication, emotional intelligence, focus, and leadership systems built for modern creators & professionals.',
        'body': (
            'Most people optimise for technical skills. But the people who actually lead, inspire, '
            'and build lasting influence are the ones who mastered the human layer first.\n\n'
            'Soft Skills Academy is a structured curriculum for developing the high-leverage, high-impact '
            'abilities that compound over a lifetime: clear thinking, deep communication, emotional fluency, '
            'and the ability to lead yourself before leading others.\n\n'
            'Each module is practical, research-backed, and designed to be applied immediately — not just studied.'
        ),
        'features': [
            'Self-paced modules on communication, focus & emotional intelligence',
            'Weekly essay drops distilling key frameworks',
            'Practical exercises — not just theory',
            'Access to a library of mental models for decision-making',
            'Community of professionals committed to intentional growth',
        ],
    },
    {
        'slug': 'one-school',
        'name': 'One School',
        'icon': '✦',
        'tagline': 'The holistic digital education platform for polymaths & modern builders.',
        'cta': 'Explore One School',
        'description': 'Synthesize your passions, build digital leverage, and design an independent life with our flagship curriculum.',
        'body': (
            'The education system was designed for a world that no longer exists. '
            'One School is built for the world we\'re actually living in.\n\n'
            'We believe the best thinkers and creators are polymaths — people who can draw connections '
            'across disciplines, synthesize ideas into unique insight, and build leverage from their curiosity.\n\n'
            'One School is a living curriculum that teaches you how to learn, think, create, and build '
            'in the digital age — without giving up the depth and craft that separates great work from noise.'
        ),
        'features': [
            'Cross-disciplinary curriculum spanning writing, philosophy, tech & business',
            'Project-based learning — build something real while you study',
            'Flagship cohorts with live sessions and direct feedback',
            'Personal knowledge management system included',
            'Lifetime access to all course material updates',
        ],
    },
    {
        'slug': 'the-toolkit',
        'name': 'The Toolkit',
        'icon': '⚙',
        'tagline': 'Curated tools, frameworks & resources for the independent creator.',
        'cta': 'Explore The Toolkit',
        'description': 'Curated tools, mental models, and frameworks used by the world\'s most effective thinkers, writers & builders.',
        'body': (
            'Stop drowning in productivity advice. The Toolkit is a hand-curated, opinionated collection '
            'of the tools and systems that actually move the needle — tested, refined, and used daily.\n\n'
            'From writing and thinking tools to business infrastructure and creative systems, '
            'every recommendation comes with context: why it works, how to use it, and when to move on.\n\n'
            'No affiliate spam. No bloated lists. Just the best tools for building a focused, independent creative life.'
        ),
        'features': [
            'Curated list of writing, research & thinking tools',
            'Mental model reference library',
            'Business & creator infrastructure recommendations',
            'New additions every month — curated, not aggregated',
            'Honest reviews with real-world context',
        ],
    },
    {
        'slug': 'the-archive',
        'name': 'The Archive',
        'icon': '📚',
        'tagline': 'Every essay, idea, and thread — organised for deep reading.',
        'cta': 'Browse The Archive',
        'description': 'A structured, searchable library of every essay, idea, and piece of writing published on this site.',
        'body': (
            'Great writing is meant to be revisited. The Archive is a structured home for every piece '
            'of long-form work published here — searchable, tagged, and organised by theme.\n\n'
            'Whether you want to follow a thread on philosophy, deep-dive into creative systems, '
            'or trace the evolution of an idea over time — the Archive makes it easy.\n\n'
            'This is not a feed. It\'s a library.'
        ),
        'features': [
            'Every published essay, searchable by topic and date',
            'Curated reading paths for new readers',
            'Tag-based navigation across themes',
            'Highlighted editor\'s picks and most-read pieces',
        ],
    },
    {
        'slug': 'the-letter',
        'name': 'The Letter',
        'icon': '✉',
        'tagline': 'High-signal essays delivered to your inbox twice a week.',
        'cta': 'Subscribe Free',
        'description': 'A free newsletter on thinking, writing, and building a life on your own terms. No spam. No filler.',
        'body': (
            'The Letter is a twice-weekly dispatch for people who want to think better, write clearly, '
            'and build something worth building.\n\n'
            'Each issue explores one idea in depth — pulled from philosophy, psychology, business, '
            'or whatever has caught my attention that week — and distilled into something practical and clear.\n\n'
            'No sponsored content. No roundups. Just one writer\'s honest thinking, sent directly to you.'
        ),
        'features': [
            'Two essays per week — focused and substantive',
            'No ads, sponsorships or affiliate links',
            'Searchable back-issues for every subscriber',
            'Exclusive subscriber-only posts and early access',
            '1-click unsubscribe, always',
        ],
    },
    {
        'slug': 'the-reading-list',
        'name': 'The Reading List',
        'icon': '🔖',
        'tagline': 'Books, essays, and ideas that have shaped the way I think.',
        'cta': 'Explore The Reading List',
        'description': 'A curated list of the books and essays that have most influenced how I think, write, and build.',
        'body': (
            'I don\'t read to consume — I read to think. This reading list is a running record of '
            'the books, essays, and long-form pieces that have genuinely changed something about '
            'how I see the world.\n\n'
            'Each entry comes with a note on why it mattered and what I took from it. '
            'Not a summary. Not a review. Just honest context.\n\n'
            'Updated regularly as I read. Organized by theme, not date.'
        ),
        'features': [
            'Organised by theme: philosophy, creativity, business, science',
            'Personal notes on why each book mattered',
            'Regularly updated as new reads are absorbed',
            'Honest ratings — no five-stars-for-everything inflation',
        ],
    },
]

_RESOURCES_BY_SLUG = {r['slug']: r for r in _RESOURCES}


@public_bp.route('/resources')
def resources():
    return render_template('public/resources.html', resources=_RESOURCES)


@public_bp.route('/resources/<slug>')
def resource_detail(slug):
    resource = _RESOURCES_BY_SLUG.get(slug)
    if not resource:
        abort(404)
    return render_template('public/resource_detail.html', resource=resource)
