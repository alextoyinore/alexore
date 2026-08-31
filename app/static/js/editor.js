/**
 * alexore — Tiptap Simple Editor Integration
 * Powered by Tiptap v2 via native ES Modules.
 */

import { Editor } from 'https://esm.sh/@tiptap/core@2.2.4';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.2.4';
import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.2.4';
import Image from 'https://esm.sh/@tiptap/extension-image@2.2.4';
import Link from 'https://esm.sh/@tiptap/extension-link@2.2.4';
import TaskList from 'https://esm.sh/@tiptap/extension-task-list@2.2.4';
import TaskItem from 'https://esm.sh/@tiptap/extension-task-item@2.2.4';
import Underline from 'https://esm.sh/@tiptap/extension-underline@2.2.4';

document.addEventListener('DOMContentLoaded', () => {

  // ── Slug auto-generation ────────────────────────────────
  const titleInput = document.getElementById('post-title');
  const slugInput  = document.getElementById('post-slug');
  let slugManuallyEdited = (slugInput?.value?.trim().length > 0);

  titleInput?.addEventListener('input', () => {
    if (!slugManuallyEdited) {
      slugInput.value = titleInput.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);
    }
  });

  slugInput?.addEventListener('input', () => {
    slugManuallyEdited = slugInput.value.trim().length > 0;
  });

  // Auto-resize title / subtitle textareas without scrollbars
  function autoResizeTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  document.querySelectorAll('.editor-title-input, .editor-subtitle-input').forEach(ta => {
    ta.style.overflow = 'hidden';
    ta.addEventListener('input', () => autoResizeTextarea(ta));
    autoResizeTextarea(ta);
  });

  // ── Tags chip input ─────────────────────────────────────
  const tagsWrapper     = document.getElementById('tags-wrapper');
  const tagsRawInput    = document.getElementById('tags-raw-input');
  const tagsHiddenInput = document.getElementById('tags-hidden');
  let tagsList = tagsHiddenInput?.value
    ? tagsHiddenInput.value.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  function renderTagChips() {
    if (!tagsWrapper) return;
    tagsWrapper.querySelectorAll('.tag-chip').forEach(c => c.remove());
    tagsList.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag}<button class="tag-chip-remove" type="button" data-tag="${tag}">×</button>`;
      tagsWrapper.insertBefore(chip, tagsRawInput);
    });
    if (tagsHiddenInput) tagsHiddenInput.value = tagsList.join(', ');
  }

  tagsWrapper?.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-chip-remove')) {
      tagsList = tagsList.filter(t => t !== e.target.dataset.tag);
      renderTagChips();
    } else {
      tagsRawInput?.focus();
    }
  });

  tagsRawInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagsRawInput.value.trim().replace(/,$/, '');
      if (val && !tagsList.includes(val)) { tagsList.push(val); renderTagChips(); }
      tagsRawInput.value = '';
    } else if (e.key === 'Backspace' && tagsRawInput.value === '') {
      tagsList.pop();
      renderTagChips();
    }
  });

  renderTagChips();

  // ── Cover image upload ──────────────────────────────────
  const coverUploadInput = document.getElementById('cover-upload-input');
  const coverPreview     = document.getElementById('cover-preview');
  const coverUrlInput    = document.getElementById('cover_image');
  const uploadArea       = document.getElementById('cover-upload-area');

  uploadArea?.addEventListener('click', () => coverUploadInput?.click());
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'rgba(214,235,255,0.4)';
  });
  uploadArea?.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    if (e.dataTransfer.files[0]) uploadCoverImage(e.dataTransfer.files[0]);
  });
  coverUploadInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadCoverImage(e.target.files[0]);
  });

  async function uploadCoverImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        if (coverPreview) { coverPreview.src = data.url; coverPreview.style.display = 'block'; }
        if (coverUrlInput) coverUrlInput.value = data.url;
        const hint = uploadArea?.querySelector('.upload-hint');
        if (hint) hint.textContent = 'Click to change image';
      }
    } catch { alert('Image upload failed. Please try again.'); }
  }

  // ── Autosave & Metrics ──────────────────────────────────
  const postId        = document.getElementById('post-id')?.value || null;
  const autosaveDot   = document.getElementById('autosave-dot');
  const autosaveText  = document.getElementById('autosave-text');
  const wordCountEl   = document.getElementById('word-count');
  const readingTimeEl = document.getElementById('reading-time-indicator');

  function setAutosaveState(state) {
    if (!autosaveDot || !autosaveText) return;
    autosaveDot.className = `autosave-dot ${state}`;
    autosaveText.textContent = { idle: 'All changes saved', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[state] || '';
  }

  let autosaveTimer = null;
  let lastSavedHtml = null;

  async function autosave(html) {
    if (!postId || html === lastSavedHtml) return;
    setAutosaveState('saving');
    try {
      const res = await fetch('/api/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content_html: html, title: titleInput?.value || '' }),
      });
      if (res.ok) {
        lastSavedHtml = html;
        setAutosaveState('saved');
        setTimeout(() => setAutosaveState('idle'), 2000);
      } else { setAutosaveState('error'); }
    } catch { setAutosaveState('error'); }
  }

  // ── Init Tiptap Editor ──────────────────────────────────
  const initialContent = window.INITIAL_POST_HTML || '';

  const editor = new Editor({
    element: document.getElementById('tiptap-canvas'),
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write something worth reading…',
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialContent,
    autofocus: !initialContent,
    onUpdate({ editor }) {
      syncAndCount(editor);
    },
    onSelectionUpdate({ editor }) {
      updateToolbarActiveStates(editor);
    },
  });

  function syncAndCount(ed) {
    const html   = ed.getHTML();
    const hidden = document.getElementById('content_html');
    if (hidden) hidden.value = html;

    const text  = ed.getText().trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    if (wordCountEl)   wordCountEl.textContent   = `${words.toLocaleString()} words`;
    if (readingTimeEl) readingTimeEl.textContent = `~${Math.max(1, Math.round(words / 200))} min read`;

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => autosave(html), 8000);
  }

  // ── Toolbar Button Listeners ────────────────────────────
  const btnBold      = document.getElementById('btn-bold');
  const btnItalic    = document.getElementById('btn-italic');
  const btnUnderline = document.getElementById('btn-underline');
  const btnStrike    = document.getElementById('btn-strike');
  const btnCode      = document.getElementById('btn-code');
  const btnBullet    = document.getElementById('btn-bullet');
  const btnOrdered   = document.getElementById('btn-ordered');
  const btnTask      = document.getElementById('btn-task');
  const btnQuote     = document.getElementById('btn-quote');
  const btnCodeblock = document.getElementById('btn-codeblock');
  const btnLink      = document.getElementById('btn-link');
  const btnImage     = document.getElementById('btn-image');
  const btnHr        = document.getElementById('btn-hr');
  const btnUndo      = document.getElementById('btn-undo');
  const btnRedo      = document.getElementById('btn-redo');
  const headingSel   = document.getElementById('heading-select');

  btnBold?.addEventListener('click', () => editor.chain().focus().toggleBold().run());
  btnItalic?.addEventListener('click', () => editor.chain().focus().toggleItalic().run());
  btnUnderline?.addEventListener('click', () => editor.chain().focus().toggleUnderline().run());
  btnStrike?.addEventListener('click', () => editor.chain().focus().toggleStrike().run());
  btnCode?.addEventListener('click', () => editor.chain().focus().toggleCode().run());

  btnBullet?.addEventListener('click', () => editor.chain().focus().toggleBulletList().run());
  btnOrdered?.addEventListener('click', () => editor.chain().focus().toggleOrderedList().run());
  btnTask?.addEventListener('click', () => editor.chain().focus().toggleTaskList().run());
  btnQuote?.addEventListener('click', () => editor.chain().focus().toggleBlockquote().run());
  btnCodeblock?.addEventListener('click', () => editor.chain().focus().toggleCodeBlock().run());
  btnHr?.addEventListener('click', () => editor.chain().focus().setHorizontalRule().run());

  btnUndo?.addEventListener('click', () => editor.chain().focus().undo().run());
  btnRedo?.addEventListener('click', () => editor.chain().focus().redo().run());

  headingSel?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'p') editor.chain().focus().setParagraph().run();
    else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
  });

  btnLink?.addEventListener('click', () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  });

  btnImage?.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res  = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.url) {
          editor.chain().focus().setImage({ src: data.url }).run();
        }
      } catch { alert('Image upload failed.'); }
    };
  });

  function updateToolbarActiveStates(ed) {
    btnBold?.classList.toggle('is-active', ed.isActive('bold'));
    btnItalic?.classList.toggle('is-active', ed.isActive('italic'));
    btnUnderline?.classList.toggle('is-active', ed.isActive('underline'));
    btnStrike?.classList.toggle('is-active', ed.isActive('strike'));
    btnCode?.classList.toggle('is-active', ed.isActive('code'));

    btnBullet?.classList.toggle('is-active', ed.isActive('bulletList'));
    btnOrdered?.classList.toggle('is-active', ed.isActive('orderedList'));
    btnTask?.classList.toggle('is-active', ed.isActive('taskList'));
    btnQuote?.classList.toggle('is-active', ed.isActive('blockquote'));
    btnCodeblock?.classList.toggle('is-active', ed.isActive('codeBlock'));
    btnLink?.classList.toggle('is-active', ed.isActive('link'));

    if (headingSel) {
      if (ed.isActive('heading', { level: 1 })) headingSel.value = 'h1';
      else if (ed.isActive('heading', { level: 2 })) headingSel.value = 'h2';
      else if (ed.isActive('heading', { level: 3 })) headingSel.value = 'h3';
      else headingSel.value = 'p';
    }
  }

  // Sync hidden input before form submit
  document.getElementById('editor-form')?.addEventListener('submit', () => {
    const hidden = document.getElementById('content_html');
    if (hidden) hidden.value = editor.getHTML();
  });

  // Ctrl+S -> save draft
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('save-draft-btn')?.click();
    }
  });

  // Focus editor when clicking anywhere inside the editor container box
  document.querySelector('.tiptap-editor-container')?.addEventListener('click', (e) => {
    if (!e.target.closest('.tiptap-toolbar')) {
      editor.chain().focus().run();
    }
  });

  syncAndCount(editor);
  setAutosaveState('idle');
});
