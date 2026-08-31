import os
import json
import bleach
from datetime import datetime
from flask import (Blueprint, render_template, redirect, url_for,
                   request, flash, current_app, jsonify)
from flask_login import login_required
from slugify import slugify
from app import db
from app.models import Post, Tag, Subscriber, Comment, AboutMe, LegalPage

admin_bp = Blueprint('admin', __name__)

# Allowed HTML tags/attrs for Tiptap-rendered content
ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
    'img', 'figure', 'figcaption', 'mark', 'span', 'div', 'sub', 'sup',
]
ALLOWED_ATTRS = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'code': ['class'],
    'pre': ['class'],
    'span': ['class', 'style'],
    'div': ['class'],
    'p': ['class'],
    '*': ['class'],
}


def sanitise_html(html: str) -> str:
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)


# ── Dashboard ──────────────────────────────────────────────────────────────────

@admin_bp.route('/')
@login_required
def dashboard():
    stats = {
        'total_posts': Post.query.count(),
        'published': Post.query.filter_by(status=Post.STATUS_PUBLISHED).count(),
        'drafts': Post.query.filter_by(status=Post.STATUS_DRAFT).count(),
        'subscribers': Subscriber.query.filter_by(status='active').count(),
        'total_views': db.session.query(db.func.sum(Post.views)).scalar() or 0,
    }
    recent_posts = Post.query.order_by(Post.updated_at.desc()).limit(5).all()
    recent_subs = Subscriber.query.order_by(Subscriber.subscribed_at.desc()).limit(5).all()
    return render_template(
        'admin/dashboard.html',
        stats=stats,
        recent_posts=recent_posts,
        recent_subs=recent_subs,
    )


# ── Posts List ─────────────────────────────────────────────────────────────────

@admin_bp.route('/posts')
@login_required
def posts():
    status_filter = request.args.get('status', 'all')
    query = Post.query
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    all_posts = query.order_by(Post.updated_at.desc()).all()
    return render_template('admin/posts.html', posts=all_posts, status_filter=status_filter)


# ── New Post ───────────────────────────────────────────────────────────────────

@admin_bp.route('/new', methods=['GET', 'POST'])
@login_required
def new_post():
    all_tags = Tag.query.order_by(Tag.name).all()
    if request.method == 'POST':
        return _save_post(None)
    return render_template('admin/editor.html', post=None, all_tags=all_tags)


# ── Edit Post ──────────────────────────────────────────────────────────────────

@admin_bp.route('/edit/<int:post_id>', methods=['GET', 'POST'])
@login_required
def edit_post(post_id):
    p = Post.query.get_or_404(post_id)
    all_tags = Tag.query.order_by(Tag.name).all()
    if request.method == 'POST':
        return _save_post(p)
    return render_template('admin/editor.html', post=p, all_tags=all_tags)


def _save_post(post):
    """Shared create/update logic."""
    title = request.form.get('title', '').strip()
    if not title:
        flash('Title is required.', 'error')
        return redirect(request.url)

    if post is None:
        post = Post()
        db.session.add(post)

    post.title = title
    post.subtitle = request.form.get('subtitle', '').strip()
    post.content_json = request.form.get('content_json', '')
    raw_html = request.form.get('content_html', '')
    post.content_html = sanitise_html(raw_html)
    post.seo_title = request.form.get('seo_title', '').strip()
    post.seo_desc = request.form.get('seo_desc', '').strip()
    post.post_type = request.form.get('post_type', 'essay')
    post.featured = request.form.get('featured') == 'on'

    # Slug
    raw_slug = request.form.get('slug', '').strip()
    post.slug = slugify(raw_slug or title)

    # Status
    action = request.form.get('action', 'draft')
    if action == 'publish':
        post.status = Post.STATUS_PUBLISHED
        if not post.published_at:
            post.published_at = datetime.utcnow()
    elif action == 'schedule':
        post.status = Post.STATUS_SCHEDULED
        scheduled = request.form.get('scheduled_at')
        if scheduled:
            post.published_at = datetime.fromisoformat(scheduled)
    else:
        post.status = Post.STATUS_DRAFT

    # Cover image (already uploaded via API, just store URL)
    cover_url = request.form.get('cover_image', '').strip()
    if cover_url:
        post.cover_image = cover_url
    post.cover_image_alt = request.form.get('cover_image_alt', '').strip()

    # Tags
    tag_names = [t.strip() for t in request.form.get('tags', '').split(',') if t.strip()]
    post.tags = []
    for name in tag_names:
        tag_slug = slugify(name)
        tag = Tag.query.filter_by(slug=tag_slug).first()
        if not tag:
            tag = Tag(name=name, slug=tag_slug)
            db.session.add(tag)
        post.tags.append(tag)

    post.calculate_reading_time()
    post.updated_at = datetime.utcnow()
    db.session.commit()

    flash(f'Post "{post.title}" saved.', 'success')
    return redirect(url_for('admin.edit_post', post_id=post.id))


# ── Delete Post ────────────────────────────────────────────────────────────────

@admin_bp.route('/delete/<int:post_id>', methods=['GET', 'POST'])
@login_required
def delete_post(post_id):
    p = Post.query.get_or_404(post_id)
    title = p.title
    p.tags = []
    db.session.delete(p)
    db.session.commit()
    flash(f'"{title}" was deleted.', 'success')
    return redirect(url_for('admin.posts'))


# ── Subscribers ────────────────────────────────────────────────────────────────

@admin_bp.route('/subscribers')
@login_required
def subscribers():
    subs = Subscriber.query.order_by(Subscriber.subscribed_at.desc()).all()
    return render_template('admin/subscribers.html', subscribers=subs)


@admin_bp.route('/subscribers/export')
@login_required
def export_subscribers():
    import csv
    import io
    from flask import Response
    subs = Subscriber.query.filter_by(status='active').all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Email', 'Name', 'Source', 'Date'])
    for s in subs:
        writer.writerow([s.email, s.name or '', s.source or '', s.subscribed_at.strftime('%Y-%m-%d')])
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=subscribers.csv'},
    )


@admin_bp.route('/subscribers/delete/<int:sub_id>', methods=['GET', 'POST'])
@login_required
def delete_subscriber(sub_id):
    sub = Subscriber.query.get_or_404(sub_id)
    email = sub.email
    db.session.delete(sub)
    db.session.commit()
    flash(f'Subscriber "{email}" has been deleted.', 'success')
    return redirect(url_for('admin.subscribers'))


# ── Send Email Campaign ────────────────────────────────────────────────────────

@admin_bp.route('/send-email', methods=['GET', 'POST'])
@login_required
def send_email():
    active_count = Subscriber.query.filter_by(status='active').count()

    if request.method == 'POST':
        subject = request.form.get('subject', '').strip()
        body_html = request.form.get('body_html', '').strip()
        action_type = request.form.get('action_type', 'send')
        test_email = request.form.get('test_email', '').strip()

        if not subject or not body_html:
            flash('Subject and email body HTML are required.', 'error')
            return redirect(url_for('admin.send_email'))

        if action_type == 'test':
            recipient = test_email or current_app.config['RESEND_FROM_EMAIL']
            success = _send_test_email(subject, body_html, recipient)
            if success:
                flash(f'Test email sent to {recipient} via Resend!', 'success')
            else:
                flash(f'Failed to send test email to {recipient}. Verify RESEND_API_KEY in .env.', 'error')
            return redirect(url_for('admin.send_email'))

        # Broadcast campaign
        subs = Subscriber.query.filter_by(status='active').all()
        if not subs:
            flash('No active subscribers to send to.', 'warning')
            return redirect(url_for('admin.send_email'))

        sent, failed = _send_campaign(subject, body_html, subs)
        flash(f'Campaign broadcast finished! Sent: {sent}, Failed: {failed}.', 'success')
        return redirect(url_for('admin.subscribers'))

    return render_template('admin/send_email.html', active_count=active_count)


def _send_test_email(subject, body_html, recipient):
    import resend
    api_key = current_app.config.get('RESEND_API_KEY', '')
    if not api_key:
        return False
    resend.api_key = api_key
    from_email = current_app.config['RESEND_FROM_EMAIL']
    author = current_app.config['SITE_AUTHOR']

    html_content = body_html + f"""
    <br><br><hr style="border:none;border-top:1px solid #333;margin:32px 0">
    <p style="font-size:12px;color:#888;text-align:center;">
        [TEST PREVIEW] — Sent from {current_app.config['SITE_NAME']} Dashboard
    </p>"""

    try:
        resend.Emails.send({
            'from': f"{author} <{from_email}>",
            'to': recipient,
            'subject': f"[TEST] {subject}",
            'html': html_content,
        })
        return True
    except Exception as e:
        current_app.logger.error(f"Resend test email failed: {e}")
        return False


def _send_campaign(subject, body_html, subscribers):
    import resend
    resend.api_key = current_app.config['RESEND_API_KEY']
    from_email = current_app.config['RESEND_FROM_EMAIL']
    author = current_app.config['SITE_AUTHOR']
    site_name = current_app.config['SITE_NAME']
    sent = failed = 0

    for sub in subscribers:
        unsubscribe_url = url_for(
            'public.unsubscribe', token=sub.unsubscribe_token, _external=True
        )
        personalised_html = body_html + f"""
        <br><br><hr style="border:none;border-top:1px solid #333;margin:32px 0">
        <p style="font-size:12px;color:#888;text-align:center;">
            You're receiving this because you subscribed at {site_name}.
            <a href="{unsubscribe_url}" style="color:#888;">Unsubscribe</a>
        </p>"""
        try:
            resend.Emails.send({
                'from': f"{author} <{from_email}>",
                'to': sub.email,
                'subject': subject,
                'html': personalised_html,
            })
            sent += 1
        except Exception as e:
            current_app.logger.error(f"Resend campaign error for {sub.email}: {e}")
            failed += 1

    return sent, failed


# ── Settings ───────────────────────────────────────────────────────────────────

@admin_bp.route('/settings')
@login_required
def settings():
    return render_template('admin/settings.html')


# ── Resources (stub — mirrors public._RESOURCES until DB model is ready) ───────

from app.routes.public import _RESOURCES, _RESOURCES_BY_SLUG

@admin_bp.route('/resources')
@login_required
def resources():
    return render_template('admin/resources.html', resources=_RESOURCES)


@admin_bp.route('/resources/new', methods=['GET', 'POST'])
@login_required
def new_resource():
    if request.method == 'POST':
        flash('Resources editing will be connected to the database in the next update.', 'info')
        return redirect(url_for('admin.resources'))
    return render_template('admin/resource_editor.html', resource=None)


@admin_bp.route('/resources/<slug>/edit', methods=['GET', 'POST'])
@login_required
def edit_resource(slug):
    resource = _RESOURCES_BY_SLUG.get(slug)
    if not resource:
        flash('Resource not found.', 'error')
        return redirect(url_for('admin.resources'))
    if request.method == 'POST':
        flash('Resources editing will be connected to the database in the next update.', 'info')
        return redirect(url_for('admin.resources'))
    return render_template('admin/resource_editor.html', resource=resource)


@admin_bp.route('/resources/<slug>/delete', methods=['GET', 'POST'])
@login_required
def delete_resource(slug):
    from app.routes import public
    found = False
    for i, r in enumerate(public._RESOURCES):
        if r.get('slug') == slug:
            name = r.get('name', slug)
            del public._RESOURCES[i]
            public._RESOURCES_BY_SLUG.pop(slug, None)
            found = True
            flash(f'Resource "{name}" deleted.', 'success')
            break
    if not found:
        flash('Resource not found.', 'error')
    return redirect(url_for('admin.resources'))


# ── Comments Moderation ────────────────────────────────────────────────────────

@admin_bp.context_processor
def admin_context():
    try:
        pending = Comment.query.filter_by(status=Comment.STATUS_PENDING).count()
    except Exception:
        pending = 0
    return {'pending_comments_count': pending}


@admin_bp.route('/comments')
@login_required
def comments():
    status_filter = request.args.get('status', 'all')
    page = request.args.get('page', 1, type=int)

    query = Comment.query

    if status_filter == 'pending':
        query = query.filter_by(status=Comment.STATUS_PENDING)
    elif status_filter == 'approved':
        query = query.filter_by(status=Comment.STATUS_APPROVED)
    elif status_filter == 'spam':
        query = query.filter_by(status=Comment.STATUS_SPAM)

    comments_list = query.order_by(Comment.created_at.desc()).all()

    counts = {
        'all': Comment.query.count(),
        'pending': Comment.query.filter_by(status=Comment.STATUS_PENDING).count(),
        'approved': Comment.query.filter_by(status=Comment.STATUS_APPROVED).count(),
        'spam': Comment.query.filter_by(status=Comment.STATUS_SPAM).count(),
    }

    return render_template(
        'admin/comments.html',
        comments=comments_list,
        status_filter=status_filter,
        counts=counts
    )


@admin_bp.route('/comments/<int:comment_id>/approve', methods=['GET', 'POST'])
@login_required
def approve_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    comment.status = Comment.STATUS_APPROVED
    comment.post.update_comment_count()
    db.session.commit()
    flash(f'Comment from {comment.author_name} was approved and published.', 'success')
    return redirect(request.referrer or url_for('admin.comments'))


@admin_bp.route('/comments/<int:comment_id>/spam', methods=['GET', 'POST'])
@login_required
def spam_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    comment.status = Comment.STATUS_SPAM
    comment.post.update_comment_count()
    db.session.commit()
    flash(f'Comment from {comment.author_name} marked as spam.', 'info')
    return redirect(request.referrer or url_for('admin.comments'))


@admin_bp.route('/comments/<int:comment_id>/delete', methods=['GET', 'POST'])
@login_required
def delete_comment(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    author = comment.author_name
    post = comment.post
    db.session.delete(comment)
    db.session.commit()
    if post:
        post.update_comment_count()
        db.session.commit()
    flash(f'Comment from {author} was permanently deleted.', 'success')
    return redirect(request.referrer or url_for('admin.comments'))


# ── About Me Management ────────────────────────────────────────────────────────

@admin_bp.route('/about', methods=['GET', 'POST'])
@login_required
def edit_about():
    about_data = AboutMe.get_instance()

    if request.method == 'POST':
        about_data.name = request.form.get('name', '').strip() or 'Alex Ore'
        about_data.tagline = request.form.get('tagline', '').strip()
        about_data.summary = request.form.get('summary', '').strip()
        about_data.full_content_html = request.form.get('full_content_html', '').strip()

        # Handle custom avatar URL
        avatar_url = request.form.get('avatar_image', '').strip()
        if avatar_url:
            about_data.avatar_image = avatar_url

        # Handle direct file upload
        if 'avatar_file' in request.files:
            file = request.files['avatar_file']
            if file and file.filename != '':
                from app.routes.api import allowed_file
                if allowed_file(file.filename):
                    import uuid
                    from PIL import Image
                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
                    upload_folder = current_app.config['UPLOAD_FOLDER']
                    os.makedirs(upload_folder, exist_ok=True)
                    filepath = os.path.join(upload_folder, filename)
                    img = Image.open(file)
                    img.save(filepath, optimize=True, quality=90)
                    about_data.avatar_image = url_for('static', filename=f'uploads/{filename}', _external=False)

        about_data.updated_at = datetime.utcnow()
        db.session.commit()
        flash('About Me profile updated successfully!', 'success')
        return redirect(url_for('admin.edit_about'))

    return render_template('admin/about.html', about=about_data)


# ── Legal Pages Management ─────────────────────────────────────────────────────

@admin_bp.route('/legal')
@login_required
def legal_pages():
    pages = LegalPage.query.order_by(LegalPage.id.asc()).all()
    return render_template('admin/legal.html', pages=pages)


@admin_bp.route('/legal/<slug>/edit', methods=['GET', 'POST'])
@login_required
def edit_legal_page(slug):
    page = LegalPage.query.filter_by(slug=slug).first_or_404()

    if request.method == 'POST':
        page.title = request.form.get('title', '').strip() or page.title
        page.content_html = request.form.get('content_html', '').strip()
        page.updated_at = datetime.utcnow()
        db.session.commit()
        flash(f'"{page.title}" updated successfully.', 'success')
        return redirect(url_for('admin.legal_pages'))

    return render_template('admin/legal_editor.html', page=page)
