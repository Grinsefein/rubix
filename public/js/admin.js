import { api, ApiError } from './api.js';
import {
  avatarColor,
  escapeHtml,
  formatDate,
  formatTimestamp,
  initials,
  showToast,
  witnessAvatars,
} from './ui.js';
import { formatTimeMs } from './time.js';

const REASON_LABELS = {
  fake_time: 'Fake time',
  fake_witnesses: 'Fake witnesses',
  spam: 'Spam',
  other: 'Other',
};

const elements = {
  boot: document.getElementById('admin-boot'),
  loginView: document.getElementById('login-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginButton: document.getElementById('login-btn'),
  password: document.getElementById('admin-password'),
  adminView: document.getElementById('admin-view'),
  countEntries: document.getElementById('admin-count-entries'),
  countReview: document.getElementById('admin-count-review'),
  countReports: document.getElementById('admin-count-reports'),
  filterNote: document.getElementById('admin-filter-note'),
  filterButtons: Array.from(document.querySelectorAll('[data-filter]')),
  loading: document.getElementById('admin-loading'),
  empty: document.getElementById('admin-empty'),
  emptyTitle: document.getElementById('admin-empty-title'),
  emptyText: document.getElementById('admin-empty-text'),
  list: document.getElementById('admin-list'),
  logout: document.getElementById('logout-btn'),
  confirmDialog: document.getElementById('confirm-dialog'),
  confirmText: document.getElementById('confirm-text'),
  confirmDelete: document.getElementById('confirm-delete'),
  confirmCancel: document.getElementById('confirm-cancel'),
  confirmClose: document.getElementById('confirm-close'),
};

const state = {
  entries: [],
  filter: 'review',
};

let pendingDelete = null;

function showLogin() {
  elements.boot.hidden = true;
  elements.adminView.hidden = true;
  elements.loginView.hidden = false;
  window.setTimeout(() => elements.password.focus(), 50);
}

function showDashboard() {
  elements.boot.hidden = true;
  elements.loginView.hidden = true;
  elements.adminView.hidden = false;
}

function handleApiError(error) {
  if (error instanceof ApiError && error.status === 401) {
    showLogin();
    showToast('Your moderation session has expired. Please sign in again.', 'error');
    return;
  }
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  showToast(message, 'error');
}

function filterEntries(entries) {
  if (state.filter === 'review') {
    return entries.filter((entry) => entry.status === 'under_review' || entry.reportCount > 0);
  }
  if (state.filter === 'suspicious') {
    return entries.filter((entry) => entry.witnessCount === 0 || entry.timeMs < 5000);
  }
  return entries;
}

function reportsHtml(entry) {
  if (entry.reports.length === 0) return '';

  return `
    <div class="admin-reports">
      <h3>Community reports <span class="count-chip">${entry.reports.length}</span></h3>
      <ul class="report-list">
        ${entry.reports
          .map(
            (report) => `
              <li>
                <span class="report-reason">${REASON_LABELS[report.reason] ?? 'Report'}</span>
                ${report.note ? `<p>${escapeHtml(report.note)}</p>` : ''}
                <time>${formatTimestamp(report.createdAt)}</time>
              </li>
            `
          )
          .join('')}
      </ul>
    </div>
  `;
}

function entryCard(entry) {
  const underReview = entry.status === 'under_review';
  const suspicious = entry.witnessCount === 0 || entry.timeMs < 5000;
  const witnessNames =
    entry.witnessCount === 0
      ? 'No witnesses'
      : entry.witnesses.map((name) => escapeHtml(name)).join(', ');

  return `
    <article class="panel admin-card" data-id="${entry.id}">
      <header class="admin-card-head">
        <div class="admin-entry-title">
          <span class="avatar avatar--${avatarColor(entry.name)}">${escapeHtml(
            initials(entry.name)
          )}</span>
          <div>
            <h2>${escapeHtml(entry.name)}</h2>
            <p class="admin-entry-sub">
              <span class="mono">${formatTimeMs(entry.timeMs)}</span>
              <span>·</span>
              <span>solved ${formatDate(entry.solvedAt)}</span>
            </p>
          </div>
        </div>
        <div class="admin-tags">
          <span class="status-pill ${
            underReview ? 'status-pill--review' : 'status-pill--live'
          }">${underReview ? 'Under review' : 'Live'}</span>
          ${
            entry.reportCount > 0
              ? `<span class="count-chip">${entry.reportCount} report${
                  entry.reportCount === 1 ? '' : 's'
                }</span>`
              : ''
          }
          ${suspicious ? '<span class="count-chip count-chip--warn">Suspicious</span>' : ''}
        </div>
      </header>

      <div class="admin-details">
        <div class="admin-detail">
          <span class="admin-detail-label">Witnesses</span>
          <div class="admin-witness-line">
            ${witnessAvatars(entry.witnesses, 4)}
            <span>${witnessNames}</span>
          </div>
        </div>
        ${entry.note ? `<p class="admin-note">“${escapeHtml(entry.note)}”</p>` : ''}
      </div>

      ${reportsHtml(entry)}

      <footer class="admin-actions">
        <a class="btn btn-ghost btn-small" href="/entry?id=${entry.id}">View entry</a>
        ${
          entry.videoUrl
            ? `<a class="btn btn-ghost btn-small" href="${escapeHtml(
                entry.videoUrl
              )}" target="_blank" rel="noopener noreferrer">Video</a>`
            : ''
        }
        ${
          entry.reportCount > 0 || underReview
            ? `<button type="button" class="btn btn-ghost btn-small" data-action="dismiss" data-id="${entry.id}">Dismiss reports &amp; restore</button>`
            : ''
        }
        <button type="button" class="btn btn-danger btn-small" data-action="delete" data-id="${entry.id}">
          Delete entry
        </button>
      </footer>
    </article>
  `;
}

function renderAdmin() {
  const entries = state.entries;
  const reviewCount = entries.filter(
    (entry) => entry.status === 'under_review' || entry.reportCount > 0
  ).length;
  const reportCount = entries.reduce((total, entry) => total + entry.reportCount, 0);

  elements.countEntries.textContent = String(entries.length);
  elements.countReview.textContent = String(reviewCount);
  elements.countReports.textContent = String(reportCount);

  const filtered = filterEntries(entries);
  elements.filterNote.textContent =
    state.filter === 'review'
      ? `${filtered.length} waiting for a moderator`
      : state.filter === 'suspicious'
        ? `${filtered.length} flagged for a quick look`
        : `${filtered.length} total entries`;

  elements.loading.hidden = true;

  if (filtered.length === 0) {
    elements.list.innerHTML = '';
    elements.empty.hidden = false;

    if (state.filter === 'review') {
      elements.emptyTitle.textContent = 'Nothing needs review';
      elements.emptyText.textContent =
        'No entries are on hold and no reports are waiting. The board is quiet.';
    } else if (state.filter === 'suspicious') {
      elements.emptyTitle.textContent = 'No suspicious entries';
      elements.emptyText.textContent =
        'Nothing with zero witnesses or a sub-5-second time right now.';
    } else {
      elements.emptyTitle.textContent = 'No entries yet';
      elements.emptyText.textContent = 'Once times are submitted, they show up here.';
    }
    return;
  }

  elements.empty.hidden = true;
  elements.list.innerHTML = filtered.map(entryCard).join('');
}

async function loadEntries() {
  elements.loading.hidden = false;
  elements.empty.hidden = true;
  elements.list.innerHTML = '';

  try {
    const data = await api('/api/admin/entries');
    state.entries = data.entries;
    renderAdmin();
  } catch (error) {
    elements.loading.hidden = true;
    handleApiError(error);
    if (!(error instanceof ApiError) || error.status !== 401) {
      elements.empty.hidden = false;
      elements.emptyTitle.textContent = 'Could not load the moderation queue';
      elements.emptyText.textContent = 'Refresh the page to try again.';
    }
  }
}

async function dismissReports(entry, button) {
  button.disabled = true;
  try {
    await api(`/api/admin/entries/${entry.id}/dismiss-reports`, { method: 'POST' });
    showToast('Reports dismissed. The entry is live again.');
    await loadEntries();
  } catch (error) {
    handleApiError(error);
    button.disabled = false;
  }
}

function askDelete(entry) {
  pendingDelete = entry;
  elements.confirmText.textContent = `This permanently removes “${entry.name}” (${formatTimeMs(
    entry.timeMs
  )}) and all of its reports. This cannot be undone.`;
  elements.confirmDialog.showModal();
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const entry = pendingDelete;

  elements.confirmDelete.disabled = true;
  elements.confirmDelete.textContent = 'Deleting…';

  try {
    await api(`/api/admin/entries/${entry.id}`, { method: 'DELETE' });
    elements.confirmDialog.close();
    showToast('Entry deleted.');
    await loadEntries();
  } catch (error) {
    handleApiError(error);
  } finally {
    elements.confirmDelete.disabled = false;
    elements.confirmDelete.textContent = 'Delete entry';
    pendingDelete = null;
  }
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.loginError.hidden = true;
    elements.loginButton.disabled = true;
    elements.loginButton.textContent = 'Signing in…';

    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: { password: elements.password.value },
      });
      elements.password.value = '';
      showDashboard();
      showToast('Signed in.');
      await loadEntries();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.';
      elements.loginError.textContent = message;
      elements.loginError.hidden = false;
    } finally {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = 'Sign in';
    }
  });

  elements.logout.addEventListener('click', async () => {
    try {
      await api('/api/admin/logout', { method: 'POST' });
    } catch {
      // Clear the view regardless; the cookie is still cleared on the client.
    }
    state.entries = [];
    showLogin();
    showToast('Signed out.');
  });

  elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      elements.filterButtons.forEach((other) => {
        other.classList.toggle('is-active', other === button);
      });
      renderAdmin();
    });
  });

  elements.list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const entry = state.entries.find((item) => item.id === Number(button.dataset.id));
    if (!entry) return;

    if (button.dataset.action === 'dismiss') {
      dismissReports(entry, button);
    } else if (button.dataset.action === 'delete') {
      askDelete(entry);
    }
  });

  elements.confirmDelete.addEventListener('click', confirmDelete);
  elements.confirmCancel.addEventListener('click', () => elements.confirmDialog.close());
  elements.confirmClose.addEventListener('click', () => elements.confirmDialog.close());
  elements.confirmDialog.addEventListener('click', (event) => {
    if (event.target === elements.confirmDialog) elements.confirmDialog.close();
  });
  elements.confirmDialog.addEventListener('close', () => {
    if (!elements.confirmDelete.disabled) pendingDelete = null;
  });
}

async function init() {
  bindEvents();

  try {
    const session = await api('/api/admin/me');
    if (session.authenticated) {
      showDashboard();
      await loadEntries();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

init();
