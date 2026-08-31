import os
import uuid
from flask import (Blueprint, request, jsonify, current_app,
                   url_for, render_template)
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from PIL import Image
from app import db
from app.models import Post, Subscriber, Comment
from app.utils.moderation import check_comment_moderation, sanitize_comment_content

api_bp = Blueprint('api', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Image Upload ───────────────────────────────────────────────────────────────

@api_bp.route('/upload', methods=['POST'])
@login_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    filepath = os.path.join(upload_folder, filename)

    # Save and optimise with Pillow
    img = Image.open(file)
    img.save(filepath, optimize=True, quality=85)

    url = url_for('static', filename=f'uploads/{filename}', _external=True)
    return jsonify({'url': url, 'filename': filename})


# ── Autosave ───────────────────────────────────────────────────────────────────

@api_bp.route('/autosave', methods=['POST'])
@login_required
def autosave():
    data = request.get_json(silent=True) or {}
    post_id      = data.get('post_id')
    content_html = data.get('content_html', '')
    title        = data.get('title', '')

    if post_id:
        p = Post.query.get(post_id)
        if p:
            p.content_html = content_html
            if title:
                p.title = title
            from datetime import datetime
            p.updated_at = datetime.utcnow()
            db.session.commit()
            return jsonify({'status': 'saved', 'post_id': p.id})

    return jsonify({'status': 'skipped'})


# ── Subscribe ──────────────────────────────────────────────────────────────────

@api_bp.route('/subscribe', methods=['POST'])
def subscribe():
    data = request.get_json(silent=True) or request.form
    email = (data.get('email') or '').strip().lower()
    name = (data.get('name') or '').strip()
    source = (data.get('source') or 'homepage').strip()

    if not email or '@' not in email:
        return jsonify({'error': 'Please enter a valid email address.'}), 400

    existing = Subscriber.query.filter_by(email=email).first()
    if existing:
        if name:
            existing.name = name
        if existing.status == 'unsubscribed':
            existing.status = 'active'
            existing.unsubscribed_at = None
        db.session.commit()
        return jsonify({
            'message': f"All set{' ' + name if name else ''}! Welcome to the newsletter.",
            'step': 'complete',
            'email': existing.email
        }), 200

    sub = Subscriber(email=email, name=name, source=source)
    db.session.add(sub)
    db.session.commit()

    # Send welcome email
    _send_welcome_email(sub)

    if name:
        return jsonify({
            'message': f"All set, {name}! Welcome to the newsletter.",
            'step': 'complete',
            'email': sub.email
        }), 201

    return jsonify({
        'message': "You're in! What's your first name so we can personalize your emails?",
        'step': 'collect_name',
        'email': sub.email
    }), 201


def _send_welcome_email(sub: Subscriber):
    api_key = current_app.config.get('RESEND_API_KEY', '')
    if not api_key or api_key.startswith('re_your'):
        return  # Skip if not configured

    try:
        import resend
        resend.api_key = api_key
        site_name = current_app.config['SITE_NAME']
        author = current_app.config['SITE_AUTHOR']
        from_email = current_app.config['RESEND_FROM_EMAIL']
        unsub_url = url_for('public.unsubscribe', token=sub.unsubscribe_token, _external=True)

        resend.Emails.send({
            'from': f'{author} <{from_email}>',
            'to': sub.email,
            'subject': f"Welcome to {site_name} ✦",
            'html': f"""
            <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">
                <h2 style="font-size:28px;margin-bottom:8px;">You're in.</h2>
                <p style="font-size:16px;line-height:1.7;color:#444;">
                    Hi{' ' + sub.name if sub.name else ''},<br><br>
                    Thanks for subscribing to {site_name}. I write about thinking, writing,
                    and building a life on your own terms.<br><br>
                    Expect essays in your inbox — no spam, no noise.
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
                <p style="font-size:12px;color:#999;">
                    <a href="{unsub_url}" style="color:#999;">Unsubscribe</a>
                </p>
            </div>
            """,
        })
    except Exception:
        pass  # Non-critical, don't break signup


# ── Comments Submission ────────────────────────────────────────────────────────

@api_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    post = Post.query.filter_by(id=post_id, status=Post.STATUS_PUBLISHED).first_or_404()
    data = request.get_json(silent=True) or request.form

    author_name = (data.get('author_name') or '').strip()
    author_email = (data.get('author_email') or '').strip().lower()
    raw_content = (data.get('content') or '').strip()
    parent_id = data.get('parent_id')

    if not author_name:
        return jsonify({'error': 'Please provide your name.'}), 400
    if len(author_name) > 100:
        return jsonify({'error': 'Name is too long (maximum 100 characters).'}), 400

    if not author_email or '@' not in author_email or '.' not in author_email:
        return jsonify({'error': 'Please provide a valid email address.'}), 400

    if not raw_content:
        return jsonify({'error': 'Comment content cannot be empty.'}), 400
    if len(raw_content) < 2:
        return jsonify({'error': 'Comment is too short.'}), 400
    if len(raw_content) > 3000:
        return jsonify({'error': 'Comment exceeds maximum length of 3000 characters.'}), 400

    # Validate parent comment if replying
    valid_parent_id = None
    if parent_id:
        try:
            p_id = int(parent_id)
            parent_comment = Comment.query.filter_by(id=p_id, post_id=post.id, status=Comment.STATUS_APPROVED).first()
            if parent_comment:
                valid_parent_id = parent_comment.id
        except (ValueError, TypeError):
            valid_parent_id = None

    sanitized_content = sanitize_comment_content(raw_content)

    # Check if author is logged-in admin
    is_admin = current_user.is_authenticated
    is_author = is_admin

    if is_admin:
        status = Comment.STATUS_APPROVED
        flagged_reason = None
    else:
        is_flagged, flagged_terms, reason = check_comment_moderation(raw_content, author_name, author_email)
        if is_flagged:
            status = Comment.STATUS_PENDING
            flagged_reason = reason
        else:
            status = Comment.STATUS_APPROVED
            flagged_reason = None

    comment = Comment(
        post_id=post.id,
        author_name=author_name,
        author_email=author_email,
        content=sanitized_content,
        status=status,
        flagged_reason=flagged_reason,
        is_author=is_author,
        parent_id=valid_parent_id
    )
    db.session.add(comment)

    # Automatically add commenter to newsletter subscribers list if not already present
    if author_email and '@' in author_email:
        existing_sub = Subscriber.query.filter_by(email=author_email).first()
        if not existing_sub:
            new_sub = Subscriber(
                email=author_email,
                name=author_name,
                source='comment'
            )
            db.session.add(new_sub)
            db.session.commit()
            _send_welcome_email(new_sub)
        elif not existing_sub.name and author_name:
            existing_sub.name = author_name
            db.session.commit()

    db.session.commit()

    if status == Comment.STATUS_APPROVED:
        post.update_comment_count()
        db.session.commit()
        return jsonify({
            'status': 'approved',
            'message': 'Your comment has been posted!',
            'comment': {
                'id': comment.id,
                'author_name': comment.author_name,
                'is_author': comment.is_author,
                'content': comment.content,
                'created_at': comment.created_at.strftime('%b %d, %Y at %H:%M'),
                'parent_id': comment.parent_id
            },
            'comment_count': post.comment_count
        }), 201
    else:
        return jsonify({
            'status': 'pending_moderation',
            'message': 'Thank you! Your comment is awaiting moderation and will appear once approved.',
            'comment': None,
            'comment_count': post.comment_count
        }), 200
