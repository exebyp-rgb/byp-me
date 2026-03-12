/**
 * BYP – Quick Job Quotes
 * State machine: compose → sent → (client view) → (manage view)
 *
 * URL routing:
 *   /          → compose page
 *   #q/ID      → client quote view
 *   #m/TOKEN   → manage quote view
 */

const STORAGE_KEY = 'byp_quotes';

// ---- Utility ---- //

function uid(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function formatPrice(val) {
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? '0' : String(Math.round(n));
}

function saveQuote(q) {
  const quotes = loadQuotes();
  const idx = quotes.findIndex(x => x.quoteId === q.quoteId);
  if (idx >= 0) quotes[idx] = q;
  else quotes.unshift(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

function loadQuotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function getQuoteById(id) {
  return loadQuotes().find(q => q.quoteId === id) || null;
}

function getQuoteByToken(token) {
  return loadQuotes().find(q => q.manageToken === token) || null;
}

function updateQuoteStatus(quoteId, status, acceptedAt) {
  const quotes = loadQuotes();
  const q = quotes.find(x => x.quoteId === quoteId);
  if (q) {
    q.status = status;
    if (acceptedAt) q.acceptedAt = acceptedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }
}

function toast(msg, duration = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}

function flashBtn(btn) {
  btn.classList.add('copied');
  const orig = btn.querySelector('.copy-label').textContent;
  btn.querySelector('.copy-label').textContent = 'Copied!';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.querySelector('.copy-label').textContent = orig;
  }, 1800);
}

// ---- App state ---- //

const app = {
  // Current compose state (pre-send)
  draft: {
    contractorName: 'Mike – Plumbing Service',
    phone: '512-000-4821',
    job: 'Kitchen faucet replacement',
    price: '185',
    availability: 'Tomorrow morning',
  },

  // After sending – holds saved quote object
  sentQuote: null,

  init() {
    const hash = location.hash;

    if (hash.startsWith('#q/')) {
      // Client quote view
      const id = hash.slice(3);
      this.showClientView(id);
    } else if (hash.startsWith('#m/')) {
      // Manage view
      const token = hash.slice(3);
      this.showManageView(token);
    } else {
      // Compose view
      this.showCompose();
    }
  },

  // ---- Compose view ---- //

  showCompose() {
    document.getElementById('main-page').style.display = 'block';
    document.getElementById('client-page').style.display = 'none';
    document.getElementById('manage-page').style.display = 'none';

    this.renderDraft();
    this.renderRecent();
    this.bindEditing();
  },

  renderDraft() {
    const d = this.draft;
    setText('editor-name', d.contractorName);
    setText('editor-phone', d.phone);
    setText('editor-job', d.job);
    setText('editor-price', d.price);
    setText('editor-avail', d.availability);
  },

  bindEditing() {
    // Sync editable fields back to draft on input
    document.getElementById('editor-name').addEventListener('input', e => {
      this.draft.contractorName = e.target.textContent.trim();
    });
    document.getElementById('editor-phone').addEventListener('input', e => {
      this.draft.phone = e.target.textContent.trim();
    });
    document.getElementById('editor-job').addEventListener('input', e => {
      this.draft.job = e.target.textContent.trim();
    });
    document.getElementById('editor-price').addEventListener('input', e => {
      // Only allow digits
      const raw = e.target.textContent.replace(/[^0-9]/g, '');
      this.draft.price = raw;
    });
    document.getElementById('editor-price').addEventListener('blur', e => {
      e.target.textContent = formatPrice(this.draft.price);
      this.draft.price = formatPrice(this.draft.price);
    });
    document.getElementById('editor-avail').addEventListener('input', e => {
      this.draft.availability = e.target.textContent.trim();
    });

    // Prevent newlines in single-line fields
    const singleLine = ['editor-name', 'editor-phone', 'editor-job', 'editor-price', 'editor-avail'];
    singleLine.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
      }
    });
  },

  // ---- Send quote ---- //

  sendQuote() {
    const d = this.draft;

    if (!d.job || !d.price || d.price === '0') {
      toast('Add a job and price first.');
      return;
    }

    const quoteId = uid(5);
    const manageToken = uid(8);
    const now = Date.now();

    const quote = {
      quoteId,
      manageToken,
      contractorName: d.contractorName,
      phone: d.phone,
      job: d.job,
      price: d.price,
      availability: d.availability,
      status: 'created',
      createdAt: now,
    };

    saveQuote(quote);
    this.sentQuote = quote;

    // Switch compose area to result state
    document.getElementById('compose-area').classList.add('hidden');
    document.getElementById('result-area').style.display = 'block';

    const base = location.origin + location.pathname.replace(/\/[^/]*$/, '/');
    const clientUrl = `${location.origin}${location.pathname}#q/${quoteId}`;
    const manageUrl = `${location.origin}${location.pathname}#m/${manageToken}`;

    document.getElementById('result-client-link').textContent = `byp.me/q/${quoteId}`;
    document.getElementById('result-manage-link').textContent = `byp.me/m/${manageToken}`;

    // Store for copy actions
    this._clientUrl = clientUrl;
    this._manageUrl = manageUrl;
    this._replyText = `Here's the quote:\n${clientUrl}`;

    this.renderRecent();
  },

  copyReply() {
    const btn = document.getElementById('btn-copy-reply');
    copyText(this._replyText).then(() => { flashBtn(btn); toast('Reply text copied'); });
  },

  copyClientLink() {
    const btn = document.getElementById('btn-copy-client');
    copyText(this._clientUrl).then(() => { flashBtn(btn); toast('Client link copied'); });
  },

  copyManageLink() {
    const btn = document.getElementById('btn-copy-manage');
    copyText(this._manageUrl).then(() => { flashBtn(btn); toast('Manage link copied'); });
  },

  newQuote() {
    document.getElementById('compose-area').classList.remove('hidden');
    document.getElementById('result-area').style.display = 'none';
    this.sentQuote = null;
    // Reset to default prompt
    this.renderDraft();
    this.renderRecent();
  },

  // ---- Recent quotes ---- //

  renderRecent() {
    const container = document.getElementById('recent-list');
    const section = document.getElementById('recent-section');
    const quotes = loadQuotes();

    if (!quotes.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = quotes.slice(0, 5).map(q => {
      const statusClass = q.status === 'accepted' ? 'accepted' : 'created';
      const statusText = q.status === 'accepted' ? '✔ Accepted' : 'Created';
      return `
        <button class="recent-item" onclick="app.openRecent('${q.quoteId}')">
          <div class="recent-info">
            <div class="recent-job">${escHtml(q.job)}</div>
            <div class="recent-price">$${escHtml(q.price)}</div>
          </div>
          <span class="recent-status ${statusClass}">${statusText}</span>
        </button>`;
    }).join('');
  },

  openRecent(quoteId) {
    const q = getQuoteById(quoteId);
    if (!q) return;

    // Populate compose with this quote data and show result
    this.draft = {
      contractorName: q.contractorName,
      phone: q.phone,
      job: q.job,
      price: q.price,
      availability: q.availability,
    };
    this.renderDraft();
    this.sentQuote = q;

    const clientUrl = `${location.origin}${location.pathname}#q/${q.quoteId}`;
    const manageUrl = `${location.origin}${location.pathname}#m/${q.manageToken}`;

    this._clientUrl = clientUrl;
    this._manageUrl = manageUrl;
    this._replyText = `Here's the quote:\n${clientUrl}`;

    document.getElementById('result-client-link').textContent = `byp.me/q/${q.quoteId}`;
    document.getElementById('result-manage-link').textContent = `byp.me/m/${q.manageToken}`;

    document.getElementById('compose-area').classList.add('hidden');
    document.getElementById('result-area').style.display = 'block';
  },

  // ---- Client view ---- //

  showClientView(quoteId) {
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('client-page').style.display = 'block';
    document.getElementById('manage-page').style.display = 'none';

    const q = getQuoteById(quoteId);
    if (!q) {
      document.getElementById('client-page').innerHTML =
        '<div style="padding:40px 24px;font-size:16px;color:#6B7280;text-align:center;">Quote not found.</div>';
      return;
    }

    setText('c-name', q.contractorName);
    const phoneLink = document.getElementById('c-phone-link');
    phoneLink.textContent = '☎ ' + q.phone;
    phoneLink.href = 'tel:' + q.phone.replace(/\D/g, '');
    setText('c-job', q.job);
    setText('c-price', '$' + q.price);
    setText('c-avail', q.availability);

    const phoneLink2 = document.getElementById('c-call-btn');
    if (phoneLink2) {
      phoneLink2.href = 'tel:' + q.phone.replace(/\D/g, '');
      phoneLink2.textContent = 'Call ' + q.contractorName.split('–')[0].trim() + ' now';
    }

    // If already accepted, show accepted state
    if (q.status === 'accepted') {
      this.showAccepted(q.acceptedAt);
    }

    // Store quoteId for accept action
    this._clientQuoteId = quoteId;
  },

  acceptQuote() {
    const quoteId = this._clientQuoteId;
    const now = Date.now();
    updateQuoteStatus(quoteId, 'accepted', now);

    this.showAccepted(now);
  },

  showAccepted(acceptedAt) {
    const btn = document.getElementById('c-accept-btn');
    btn.textContent = 'Quote accepted ✔';
    btn.classList.add('accepted-state');
    btn.disabled = true;

    const msg = document.getElementById('c-accepted-msg');
    msg.style.display = 'flex';

    const minutesAgo = Math.round((Date.now() - acceptedAt) / 60000);
    document.getElementById('c-accepted-time').textContent =
      minutesAgo < 1 ? 'Just now.' : `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago.`;
  },

  // ---- Manage view ---- //

  showManageView(token) {
    document.getElementById('main-page').style.display = 'none';
    document.getElementById('client-page').style.display = 'none';
    document.getElementById('manage-page').style.display = 'block';

    const q = getQuoteByToken(token);
    if (!q) {
      document.getElementById('manage-page').innerHTML =
        '<div style="padding:40px 24px;font-size:16px;color:#6B7280;text-align:center;">Quote not found.</div>';
      return;
    }

    setText('m-job', q.job);
    setText('m-price', '$' + q.price);

    if (q.status === 'accepted') {
      document.getElementById('m-status-created').style.display = 'none';
      const accepted = document.getElementById('m-status-accepted');
      accepted.style.display = 'inline-flex';

      const minutesAgo = q.acceptedAt
        ? Math.round((Date.now() - q.acceptedAt) / 60000)
        : null;
      const timeText = minutesAgo === null
        ? ''
        : minutesAgo < 1
          ? 'Accepted just now'
          : `Accepted ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
      document.getElementById('m-accepted-time').textContent = timeText;
    }
  },
};

// ---- DOM helpers ---- //

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Boot ---- //

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

window.addEventListener('hashchange', () => {
  app.init();
});
