/* ── Theme Manager ──────────────────────────────────────── */
(function () {
  const THEME_KEY = 'alexore_theme';

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || 'system';
  }

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-color-scheme', theme);

    // Update active state in theme switchers
    document.querySelectorAll('.theme-switcher').forEach((switcher) => {
      switcher.querySelectorAll('.theme-opt').forEach((opt) => {
        if (opt.dataset.themeVal === theme) {
          opt.classList.add('active');
        } else {
          opt.classList.remove('active');
        }
      });
    });
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }

  // Initial application
  const initialTheme = getStoredTheme();
  applyTheme(initialTheme);

  // Listen to OS scheme changes if set to system
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system');
      }
    });
  } catch (e) {}

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getStoredTheme());

    // Theme Switcher dropdown toggle & option select
    document.querySelectorAll('.theme-switcher').forEach((switcher) => {
      const btn = switcher.querySelector('.theme-switcher-btn');

      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Close other open theme switchers
          document.querySelectorAll('.theme-switcher.open').forEach((other) => {
            if (other !== switcher) other.classList.remove('open');
          });
          switcher.classList.toggle('open');
        });
      }

      switcher.querySelectorAll('.theme-opt').forEach((opt) => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.dataset.themeVal;
          if (val) {
            setTheme(val);
            switcher.classList.remove('open');
          }
        });
      });
    });

    // Close theme dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.theme-switcher')) {
        document.querySelectorAll('.theme-switcher.open').forEach((s) => s.classList.remove('open'));
      }
    });

    // Public Mobile Navigation Toggle
    const navToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const mainNav = document.getElementById('main-nav');

    if (navToggle && mobileMenu) {
      navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = mobileMenu.classList.toggle('open');
        navToggle.classList.toggle('active', isOpen);
        if (mainNav) mainNav.classList.toggle('mobile-open', isOpen);
      });

      mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
          mobileMenu.classList.remove('open');
          navToggle.classList.remove('active');
          if (mainNav) mainNav.classList.remove('mobile-open');
        });
      });
    }

    // Admin Mobile Sidebar Toggle
    const adminSidebarToggle = document.getElementById('admin-sidebar-toggle');
    const adminLayout = document.querySelector('.admin-layout');
    const sidebarBackdrop = document.querySelector('.sidebar-backdrop');

    if (adminSidebarToggle && adminLayout) {
      adminSidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        adminLayout.classList.toggle('sidebar-open');
      });
    }

    if (sidebarBackdrop && adminLayout) {
      sidebarBackdrop.addEventListener('click', () => {
        adminLayout.classList.remove('sidebar-open');
      });
    }
  });

  window.ThemeManager = { getTheme: getStoredTheme, setTheme, applyTheme };
})();

/* ── Scroll reveal ──────────────────────────────────────── */
(function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal, .reveal-children').forEach((el) => {
    observer.observe(el);
  });
})();

/* ── Nav scroll effect ──────────────────────────────────── */
(function () {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── Subscribe form (AJAX Progressive 2-Step Flow) ───────── */
document.querySelectorAll('.js-subscribe-form').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const msgEl = form.querySelector('.subscribe-msg') || form.parentElement.querySelector('.subscribe-msg');
    const btn = form.querySelector('button[type="submit"]');
    if (!emailInput || !emailInput.value) return;

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = 'Subscribing…';
    if (msgEl) msgEl.textContent = '';

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          source: form.dataset.source || 'homepage',
        }),
      });
      const data = await res.json();

      if (res.ok && data.step === 'collect_name') {
        const userEmail = data.email;
        // Transform form to Step 2: Name Input
        form.innerHTML = `
          <div class="subscribe-name-step" style="display:flex; flex-direction:column; gap:10px; width:100%;">
            <p style="font-size:14px; color:var(--text); margin:0; font-weight:600; text-align:left;">Nice! What's your first name?</p>
            <div style="display:flex; gap:8px; width:100%;">
              <input type="text" class="subscribe-name-field" placeholder="First name..." autofocus style="flex:1; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 14px; color:var(--text); font-size:14px;">
              <button type="button" class="btn btn-primary js-save-name-btn" style="white-space:nowrap;">Save Name →</button>
            </div>
            <div style="text-align:right;">
              <button type="button" class="js-skip-name-btn" style="background:none; border:none; color:var(--text-muted); font-size:12px; cursor:pointer; text-decoration:underline;">Skip for now</button>
            </div>
          </div>
        `;

        const nameInput = form.querySelector('.subscribe-name-field');
        const saveBtn = form.querySelector('.js-save-name-btn');
        const skipBtn = form.querySelector('.js-skip-name-btn');

        const submitName = async (nameVal) => {
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving…';
          }
          try {
            const res2 = await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: userEmail,
                name: nameVal.trim(),
                source: form.dataset.source || 'homepage',
              }),
            });
            const data2 = await res2.json();
            const finalMsg = nameVal ? `All set, ${nameVal.trim()}! Welcome to the newsletter.` : "You're in! Welcome to the newsletter.";
            if (msgEl) {
              msgEl.textContent = data2.message || finalMsg;
              msgEl.style.color = 'var(--accent)';
            }
            if (window.showToast) showToast(finalMsg, 'success');
            form.innerHTML = `<p style="font-size:15px; font-weight:700; color:var(--accent); margin:12px 0;">✦ You're in! Check your inbox for updates.</p>`;
          } catch {
            if (msgEl) msgEl.textContent = 'Saved! Check your inbox.';
          }
        };

        if (nameInput) nameInput.focus();

        saveBtn?.addEventListener('click', () => {
          submitName(nameInput?.value || '');
        });

        nameInput?.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault();
            submitName(nameInput.value || '');
          }
        });

        skipBtn?.addEventListener('click', () => {
          submitName('');
        });

        if (msgEl) {
          msgEl.textContent = data.message;
          msgEl.style.color = 'var(--accent)';
        }

      } else {
        if (msgEl) {
          msgEl.textContent = data.message || data.error || 'Done!';
          msgEl.style.color = res.ok ? 'var(--accent)' : '#ff8080';
        }
        if (res.ok) {
          emailInput.value = '';
          if (window.showToast) showToast(data.message || "You're in!", 'success');
        }
      }
    } catch {
      if (msgEl) msgEl.textContent = 'Something went wrong. Try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
});

/* ── Search toggle (writing page) ───────────────────────── */
(function () {
  const toggleBtn = document.querySelector('.js-search-toggle');
  const searchInput = document.querySelector('.js-search-input');
  const searchForm = document.querySelector('.js-search-form');
  if (!toggleBtn || !searchInput) return;

  const isOpen = () => searchInput.style.width !== '0px' && searchInput.style.opacity !== '0';

  // If a query is active, start open
  if (searchInput.value.trim()) {
    searchInput.style.width = '180px';
    searchInput.style.opacity = '1';
  }

  toggleBtn.addEventListener('click', () => {
    if (isOpen()) {
      searchInput.value = '';
      searchInput.style.width = '0px';
      searchInput.style.opacity = '0';
      if (window.location.search.includes('q=')) {
        searchForm.submit();
      }
    } else {
      searchInput.style.width = '180px';
      searchInput.style.opacity = '1';
      setTimeout(() => searchInput.focus(), 50);
    }
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchInput.style.width = '0px';
      searchInput.style.opacity = '0';
      if (window.location.search.includes('q=')) searchForm.submit();
    }
    if (e.key === 'Enter') {
      searchForm.submit();
    }
  });
})();

/* ── Toast ──────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ── Confirm Delete Handler ─────────────────────────────── */
function confirmDelete(e, title) {
  if (e) e.preventDefault();
  const url = e.currentTarget.getAttribute('href');
  if (!url) return;
  const promptText = title ? `Delete "${title}" permanently?` : 'Are you sure you want to delete this permanently?';
  const confirmed = window.confirm(promptText);
  if (confirmed) {
    window.location.href = url;
  }
}

window.showToast = showToast;
window.confirmDelete = confirmDelete;

