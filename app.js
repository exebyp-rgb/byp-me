/**
 * BYP – Quick Job Quotes
 * State machine: compose → sent → (client view) → (manage view)
 *
 * URL routing:
 *   /        → compose page
 *   #q/ID    → client quote view
 *   #m/TOKEN → manage quote view
 */

'use strict';

const STORAGE_KEY  = 'byp_quotes';
const IDENTITY_KEY = 'byp_identity';

// ---- Utilities ---- //

function uid(len) {
  len = len || 5;
  return Math.random().toString(36).slice(2, 2 + len);
}

function saveQuote(q) {
  var quotes = loadQuotes();
  var idx = quotes.findIndex(function(x) { return x.quoteId === q.quoteId; });
  if (idx >= 0) quotes[idx] = q;
  else quotes.unshift(q);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

function loadQuotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch(e) { return []; }
}

function getQuoteById(id) {
  return loadQuotes().find(function(q) { return q.quoteId === id; }) || null;
}

function getQuoteByToken(token) {
  return loadQuotes().find(function(q) { return q.manageToken === token; }) || null;
}

function updateQuoteStatus(quoteId, status, acceptedAt) {
  var quotes = loadQuotes();
  var q = quotes.find(function(x) { return x.quoteId === quoteId; });
  if (q) {
    q.status = status;
    if (acceptedAt) q.acceptedAt = acceptedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }
}

function loadIdentity() {
  try { return JSON.parse(localStorage.getItem(IDENTITY_KEY) || '{}'); }
  catch(e) { return {}; }
}

function saveIdentity(name, phone) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ name: name, phone: phone }));
}

/**
 * Parse "job description 180" into { job, price }.
 * Everything before the trailing number = job.
 * Trailing integer or decimal = price.
 */
function parseQuoteInput(val) {
  var trimmed = (val || '').trim();
  if (!trimmed) return { job: '', price: '' };
  var match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d{1,2})?)\s*$/);
  if (match) {
    var job = match[1].trim();
    var price = String(Math.round(parseFloat(match[2])));
    return { job: capFirst(job), price: price };
  }
  return { job: capFirst(trimmed), price: '' };
}

function capFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setText(id, text) {
  var el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, duration) {
  duration = duration || 2200;
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); }, duration);
}

function copyText(text) {
  return navigator.clipboard
    ? navigator.clipboard.writeText(text)
    : new Promise(function(resolve) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      });
}

// ---- App ---- //

var app = {
  parsed:      { job: '', price: '' },
  identity:    { name: '', phone: '' },
  sentQuote:   null,
  _clientUrl:  '',
  _manageUrl:  '',
  _clientQuoteId: null,
  _authUser:   null,
  _identityBound: false,

  init: function() {
    var hash = location.hash;
    if (hash.startsWith('#q/')) {
      this.showClientView(hash.slice(3));
    } else if (hash.startsWith('#m/')) {
      this.showManageView(hash.slice(3));
    } else {
      this.showCompose();
    }
  },

  // ---- Compose view ---- //

  showCompose: function() {
    document.getElementById('main-page').style.display   = 'block';
    document.getElementById('client-page').style.display = 'none';
    document.getElementById('manage-page').style.display = 'none';

    // Restore saved identity
    var saved = loadIdentity();
    this.identity = { name: saved.name || '', phone: saved.phone || '' };
    this.renderIdentity();

    // Bind the main input
    var input = document.getElementById('quoteInput');
    input.addEventListener('input', this._onInput.bind(this));

    // Bind identity fields (once only)
    if (!this._identityBound) {
      this._bindIdentityFields();
      this._identityBound = true;
    }

    this.renderRecent();
    this.updateAuthUI();

    // Ensure input is focused and looks active
    setTimeout(function() { input.focus(); }, 0);
  },

  _onInput: function() {
    var val = document.getElementById('quoteInput').value;
    this.parsed = parseQuoteInput(val);
    this.updatePreview();
  },

  updatePreview: function() {
    var job   = this.parsed.job;
    var price = this.parsed.price;
    var hasContent = !!(job || price);

    var previewCard  = document.getElementById('preview-card');
    var footer       = document.getElementById('preview-footer');
    var sendArea     = document.getElementById('send-area');
    var chips        = document.getElementById('price-chips');

    if (hasContent) {
      previewCard.style.display = 'block';
      footer.style.display      = 'block';
      sendArea.style.display    = 'block';
      chips.style.display       = price ? 'flex' : 'none';
    } else {
      previewCard.style.display = 'none';
      footer.style.display      = 'none';
      sendArea.style.display    = 'none';
      chips.style.display       = 'none';
    }

    // Job
    setText('preview-job', job || '—');

    // Price
    var priceEl = document.getElementById('preview-price');
    if (price) {
      priceEl.textContent = '$' + price;
      priceEl.classList.remove('preview-price-empty');
    } else {
      priceEl.textContent = '—';
      priceEl.classList.add('preview-price-empty');
    }

    this._updateSendButton();
  },

  renderIdentity: function() {
    var nameEl  = document.getElementById('preview-name');
    var phoneEl = document.getElementById('preview-phone');
    if (!nameEl || !phoneEl) return;

    if (this.identity.name) {
      nameEl.textContent = this.identity.name;
      nameEl.classList.remove('preview-empty');
    } else {
      nameEl.textContent = '';
      nameEl.classList.add('preview-empty');
    }
    if (this.identity.phone) {
      phoneEl.textContent = this.identity.phone;
      phoneEl.classList.remove('preview-empty');
    } else {
      phoneEl.textContent = '';
      phoneEl.classList.add('preview-empty');
    }
  },

  _bindIdentityFields: function() {
    var self = this;
    var nameEl  = document.getElementById('preview-name');
    var phoneEl = document.getElementById('preview-phone');
    var availEl = document.getElementById('preview-avail');

    function onNameInput() {
      // Strip any HTML that may have been pasted
      var raw = nameEl.innerText || nameEl.textContent || '';
      self.identity.name = raw.replace(/\n/g, '').trim();
      if (self.identity.name) nameEl.classList.remove('preview-empty');
      else nameEl.classList.add('preview-empty');
      saveIdentity(self.identity.name, self.identity.phone);
      self._updateSendButton();
    }
    function onPhoneInput() {
      var raw = phoneEl.innerText || phoneEl.textContent || '';
      self.identity.phone = raw.replace(/\n/g, '').trim();
      if (self.identity.phone) phoneEl.classList.remove('preview-empty');
      else phoneEl.classList.add('preview-empty');
      saveIdentity(self.identity.name, self.identity.phone);
      self._updateSendButton();
    }

    nameEl.addEventListener('input', onNameInput);
    nameEl.addEventListener('blur', function() {
      if (!nameEl.textContent.trim()) nameEl.classList.add('preview-empty');
    });
    nameEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); phoneEl.focus(); }
    });
    // Prevent paste bringing in HTML
    nameEl.addEventListener('paste', function(e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    phoneEl.addEventListener('input', onPhoneInput);
    phoneEl.addEventListener('blur', function() {
      if (!phoneEl.textContent.trim()) phoneEl.classList.add('preview-empty');
    });
    phoneEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); phoneEl.blur(); }
    });
    phoneEl.addEventListener('paste', function(e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    if (availEl) {
      availEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); availEl.blur(); }
      });
    }
  },

  _updateSendButton: function() {
    var btn  = document.getElementById('btn-send');
    var hint = document.getElementById('send-hint');
    if (!btn) return;

    var hasName  = this.identity.name.length > 0;
    var hasPhone = this.identity.phone.length > 0;
    var hasJob   = this.parsed.job.length > 0;
    var hasPrice = this.parsed.price.length > 0;

    if (!hasName || !hasPhone) {
      btn.disabled = true;
      if (hint) { hint.textContent = 'Add your name and phone to continue.'; hint.style.display = 'block'; }
    } else if (!hasJob || !hasPrice) {
      btn.disabled = true;
      if (hint) { hint.textContent = 'Add a job description and price above.'; hint.style.display = 'block'; }
    } else {
      btn.disabled = false;
      if (hint) hint.style.display = 'none';
    }
  },

  setPrice: function(price) {
    var input = document.getElementById('quoteInput');
    var current = (input.value || '').trim();
    // Replace last detected number, or append price to existing job text
    var match = current.match(/^(.+?)\s+\d+(\.\d+)?\s*$/);
    if (match) {
      input.value = match[1].trim() + ' ' + price;
    } else if (this.parsed.job) {
      input.value = this.parsed.job.toLowerCase() + ' ' + price;
    } else {
      input.value = String(price);
    }
    this._onInput();
    input.focus();
  },

  // ---- Send quote ---- //

  sendQuote: function() {
    var d = this.parsed;
    if (!d.job || !d.price) { toast('Add a job and price first.'); return; }
    if (!this.identity.name || !this.identity.phone) {
      toast('Add your name and phone first.'); return;
    }

    var availEl = document.getElementById('preview-avail');
    var availability = availEl ? (availEl.textContent || '').trim() : '';

    var quoteId     = uid(5);
    var manageToken = uid(8);
    var now         = Date.now();

    var quote = {
      quoteId:        quoteId,
      manageToken:    manageToken,
      contractorName: this.identity.name,
      phone:          this.identity.phone,
      job:            d.job,
      price:          d.price,
      availability:   availability,
      status:         'created',
      createdAt:      now,
    };

    saveQuote(quote);
    this.sentQuote = quote;

    var clientUrl = location.origin + location.pathname + '#q/' + quoteId;
    var manageUrl = location.origin + location.pathname + '#m/' + manageToken;
    this._clientUrl = clientUrl;
    this._manageUrl = manageUrl;

    // Populate result area
    setText('result-client-link', 'byp.me/q/' + quoteId);
    setText('result-manage-link', 'byp.me/m/' + manageToken);

    // Switch views
    document.getElementById('compose-area').style.display = 'none';
    document.getElementById('result-area').style.display  = 'block';

    this.renderRecent();
  },

  copyClientLink: function() {
    var self = this;
    copyText(this._clientUrl).then(function() {
      self._flashCopy(document.getElementById('btn-copy-client'));
    });
  },

  copyManageLink: function() {
    var self = this;
    copyText(this._manageUrl).then(function() {
      self._flashCopy(document.getElementById('btn-copy-manage'));
    });
  },

  _flashCopy: function(btn) {
    if (!btn) return;
    var label = btn.querySelector('.copy-icon-label');
    var orig  = label ? label.textContent : '';
    if (label) label.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(function() {
      if (label) label.textContent = orig;
      btn.classList.remove('copied');
    }, 1800);
  },

  newQuote: function() {
    var input = document.getElementById('quoteInput');
    input.value = '';
    this.parsed = { job: '', price: '' };
    document.getElementById('compose-area').style.display = 'block';
    document.getElementById('result-area').style.display  = 'none';
    this.sentQuote = null;
    this.updatePreview();
    input.focus();
  },

  // ---- Recent quotes ---- //

  renderRecent: function() {
    var section   = document.getElementById('recent-section');
    var container = document.getElementById('recent-list');
    var quotes    = loadQuotes();

    if (!quotes.length) { section.style.display = 'none'; return; }

    section.style.display = 'block';
    container.innerHTML = quotes.slice(0, 5).map(function(q) {
      var cls  = q.status === 'accepted' ? 'accepted' : 'created';
      var text = q.status === 'accepted' ? '&#x2714; Accepted' : 'Sent';
      return '<button class="recent-item" onclick="app.openRecent(\'' + escHtml(q.quoteId) + '\')">' +
        '<div class="recent-info">' +
          '<div class="recent-job">' + escHtml(q.job) + '</div>' +
          '<div class="recent-meta">$' + escHtml(q.price) + '</div>' +
        '</div>' +
        '<span class="recent-status ' + cls + '">' + text + '</span>' +
      '</button>';
    }).join('');
  },

  openRecent: function(quoteId) {
    var q = getQuoteById(quoteId);
    if (!q) return;
    this._clientUrl = location.origin + location.pathname + '#q/' + q.quoteId;
    this._manageUrl = location.origin + location.pathname + '#m/' + q.manageToken;
    this.sentQuote  = q;
    setText('result-client-link', 'byp.me/q/' + q.quoteId);
    setText('result-manage-link', 'byp.me/m/' + q.manageToken);
    document.getElementById('compose-area').style.display = 'none';
    document.getElementById('result-area').style.display  = 'block';
  },

  // ---- Client view ---- //

  showClientView: function(quoteId) {
    document.getElementById('main-page').style.display   = 'none';
    document.getElementById('client-page').style.display = 'block';
    document.getElementById('manage-page').style.display = 'none';

    var q = getQuoteById(quoteId);
    if (!q) {
      document.getElementById('client-page').innerHTML =
        '<div style="padding:60px 24px;text-align:center;color:#6B7280;font-size:15px;">Quote not found.</div>';
      return;
    }

    setText('c-name', q.contractorName);

    var phoneLink = document.getElementById('c-phone-link');
    phoneLink.textContent = '\u260E ' + q.phone;
    phoneLink.href = 'tel:' + q.phone.replace(/\D/g, '');

    setText('c-job', q.job);
    setText('c-price', '$' + q.price);

    if (q.availability) {
      setText('c-avail', q.availability);
    } else {
      var availRow = document.getElementById('c-avail-row');
      if (availRow) availRow.style.display = 'none';
    }

    var callBtn = document.getElementById('c-call-btn');
    if (callBtn) {
      callBtn.href = 'tel:' + q.phone.replace(/\D/g, '');
      var firstName = q.contractorName.split(/[\s\u2013\-]/)[0].trim();
      callBtn.textContent = 'Call ' + firstName;
    }

    if (q.status === 'accepted') this._showAccepted(q.acceptedAt);

    this._clientQuoteId = quoteId;
  },

  acceptQuote: function() {
    var now = Date.now();
    updateQuoteStatus(this._clientQuoteId, 'accepted', now);
    this._showAccepted(now);
  },

  _showAccepted: function(acceptedAt) {
    var btn = document.getElementById('c-accept-btn');
    btn.textContent = 'Quote accepted \u2714';
    btn.classList.add('accepted-state');
    btn.disabled = true;

    var msg = document.getElementById('c-accepted-msg');
    msg.style.display = 'block';

    var mins = Math.round((Date.now() - acceptedAt) / 60000);
    setText('c-accepted-time', mins < 1 ? 'Just now.' : mins + ' minute' + (mins !== 1 ? 's' : '') + ' ago.');
  },

  // ---- Manage view ---- //

  showManageView: function(token) {
    document.getElementById('main-page').style.display   = 'none';
    document.getElementById('client-page').style.display = 'none';
    document.getElementById('manage-page').style.display = 'block';

    var q = getQuoteByToken(token);
    if (!q) {
      document.getElementById('manage-page').innerHTML =
        '<div style="padding:60px 24px;text-align:center;color:#6B7280;font-size:15px;">Quote not found.</div>';
      return;
    }

    setText('m-job',   q.job);
    setText('m-price', '$' + q.price);

    if (q.status === 'accepted') {
      document.getElementById('m-status-created').style.display  = 'none';
      document.getElementById('m-status-accepted').style.display = 'block';

      var mins = q.acceptedAt ? Math.round((Date.now() - q.acceptedAt) / 60000) : null;
      var timeText = mins === null ? '' :
        mins < 1 ? 'Accepted just now' :
        'Accepted ' + mins + ' minute' + (mins !== 1 ? 's' : '') + ' ago';
      setText('m-accepted-time', timeText);
    }
  },

  // ---- Firebase auth (optional) ---- //

  onAuthReady: function(user) {
    this._authUser = user;
    this.updateAuthUI();
  },

  updateAuthUI: function() {
    var statusEl = document.getElementById('auth-status');
    var btnEl    = document.getElementById('btn-auth');
    if (!statusEl || !btnEl) return;

    if (this._authUser) {
      statusEl.textContent = this._authUser.displayName || this._authUser.email || 'Signed in';
      btnEl.textContent    = 'Sign out';
    } else {
      statusEl.textContent = '';
      btnEl.textContent    = 'Sign in with Google';
    }
  },

  toggleAuth: function() {
    var self = this;
    if (this._authUser) {
      if (window._bypAuth) window._bypAuth.signOut();
      this._authUser = null;
      this.updateAuthUI();
    } else {
      if (window._bypAuth) {
        window._bypAuth.signIn()
          .then(function(result) {
            self._authUser = result.user;
            self.updateAuthUI();
          })
          .catch(function() {/* cancelled */});
      }
    }
  },
};

// Make app global
window.app = app;

// ---- Boot ---- //

document.addEventListener('DOMContentLoaded', function() {
  app.init();
});

window.addEventListener('hashchange', function() {
  app.init();
});
