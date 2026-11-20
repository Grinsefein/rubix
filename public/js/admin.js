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
import { getEvent, eventLabel } from './events.js';

const PAGE_SIZE = 12;

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
  filterCounts: {
    review: document.getElementById('filter-count-review'),
    suspicious: document.getElementById('filter-count-suspicious'),
    all: document.getElementById('filter-count-all'),
  },
  search: document.getElementById('admin-search'),
  eventSelect: document.getElementById('admin-event'),
  sort: document.getElementById('admin-sort'),
  refresh: document.getElementById('admin-refresh'),
  loading: document.getElementById('admin-loading'),
  empty: document.getElementById('admin-empty'),
  emptyTitle: document.getElementById('admin-empty-title'),
  emptyText: document.getElementById('admin-empty-text'),
  list: document.getElementById('admin-list'),
  loadMore: document.getElementById('admin-load-more'),
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
  event: 'all',
  search: '',
  sort: 'reports',
  visible: PAGE_SIZE,
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

function matchesEvent(entry) {
  return state.event === 'all' || entry.event === state.event;
}

function matchesReview(entry) {
  return entry.status === 'under_review' || entry.reportCount > 0;
}

function matchesSuspicious(entry) {
  return entry.witnessCount === 0 || entry.timeMs < 5000;
}

function matchesFilter(entry, filter) {
  if (filter === 'review') return matchesReview(entry);
  if (filter === 'suspicious') return matchesSuspicious(entry);
  return true;
}

function matchesSearch(entry, needle) {
  if (!needle) return true;

  const details = getEvent(entry.event);
  const haystack = [
    entry.name,
    String(entry.id),
    entry.note ?? '',
    entry.solvedAt,
    details?.label ?? '',
    details?.name ?? '',
    ...entry.witnesses,
    ...entry.reports.flatMap((report) => [
      REASON_LABELS[report.reason] ?? '',
      report.reason,
      report.note ?? '',
    ]),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

function sortEntries(entries) {
  const sorted = [...entries];

  if (state.sort === 'newest') {
    return sorted.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id
    );
  }
  if (state.sort === 'oldest') {
    return sorted.sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id
    );
  }
  if (state.sort === 'fastest') {
    return sorted.sort((a, b) => a.timeMs - b.timeMs || a.id - b.id);
  }

  return sorted.sort(
    (a, b) =>
      b.reportCount - a.reportCount ||
      Number(b.status === 'under_review') - Number(a.status === 'under_review') ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id - a.id
  );
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
  const suspicious = matchesSuspicious(entry);
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
          <div class="admin-entry-main">
            <h2>${escapeHtml(entry.name)}</h2>
            <p class="admin-entry-sub">
              <span class="mono">${formatTimeMs(entry.timeMs)}</span>
              <span>·</span>
              <span>solved ${formatDate(entry.solvedAt)}</span>
              <span>·</span>
              <span class="admin-entry-id">#${entry.id}</span>
            </p>
          </div>
        </div>
        <div class="admin-tags">
          <span class="event-chip">${escapeHtml(eventLabel(entry.event))}</span>
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
        <button type="button" class="btn btn-ghost btn-small" data-action="copy" data-id="${entry.id}">
          Copy link
        </button>
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
  const eventEntries = state.entries.filter(matchesEvent);
  const searchEntries = eventEntries.filter((entry) =>
    matchesSearch(entry, state.search)
  );

  elements.countEntries.textContent = String(eventEntries.length);
  elements.countReview.textContent = String(eventEntries.filter(matchesReview).length);
  elements.countReports.textContent = String(
    eventEntries.reduce((total, entry) => total + entry.reportCount, 0)
  );

  elements.filterCounts.review.textContent = String(
    searchEntries.filter((entry) => matchesFilter(entry, 'review')).length
  );
  elements.filterCounts.suspicious.textContent = String(
    searchEntries.filter((entry) => matchesFilter(entry, 'suspicious')).length
  );
  elements.filterCounts.all.textContent = String(searchEntries.length);

  const filtered = sortEntries(
    searchEntries.filter((entry) => matchesFilter(entry, state.filter))
  );
  const visible = filtered.slice(0, state.visible);
  const eventName = state.event === 'all' ? '' : ` in ${eventLabel(state.event)}`;
  const filterLabel =
    state.filter === 'review'
      ? 'to review'
      : state.filter === 'suspicious'
        ? 'flagged for a quick look'
        : 'entries';

  if (state.search) {
    elements.filterNote.textContent = `${filtered.length} of ${eventEntries.length} ${
      eventEntries.length === 1 ? 'entry' : 'entries'
    } match “${state.search}”`;
  } else {
    elements.filterNote.textContent = `${filtered.length} ${filterLabel}${eventName} · ${
      eventEntries.length
    } total`;
  }

  elements.loading.hidden = true;

  if (filtered.length === 0) {
    elements.list.innerHTML = '';
    elements.empty.hidden = false;
    elements.loadMore.hidden = true;

    if (state.search) {
      elements.emptyTitle.textContent = 'No matching entries';
      elements.emptyText.textContent = `Nothing matches “${state.search}”. Try another name, witness, event or report keyword.`;
    } else if (state.filter === 'review') {
      elements.emptyTitle.textContent = 'Nothing needs review';
      elements.emptyText.textContent =
        'No entries are on hold and no reports are waiting. The board is quiet.';
    } else if (state.filter === 'suspicious') {
      elements.emptyTitle.textContent = 'No suspicious entries';
      elements.emptyText.textContent =
        'Nothing with zero witnesses or a sub-5-second time right now.';
    } else {
      elements.emptyTitle.textContent = eventName
        ? `No entries in ${eventLabel(state.event)} yet`
        : 'No entries yet';
      elements.emptyText.textContent =
        'Once times are submitted, they show up here for moderation.';
    }
    return;
  }

  elements.empty.hidden = true;
  elements.list.innerHTML = visible.map(entryCard).join('');

  const remaining = filtered.length - visible.length;
  elements.loadMore.hidden = remaining <= 0;
  elements.loadMore.textContent = `Load more (${remaining} remaining)`;
}

async function loadEntries() {
  elements.loading.hidden = false;
  elements.empty.hidden = true;
  elements.list.innerHTML = '';
  elements.loadMore.hidden = true;

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

async function refreshEntries() {
  elements.refresh.disabled = true;
  const original = elements.refresh.innerHTML;
  elements.refresh.textContent = 'Refreshing…';

  try {
    await loadEntries();
  } finally {
    elements.refresh.innerHTML = original;
    elements.refresh.disabled = false;
  }
}

async function dismissReports(entry, button) {
  button.disabled = true;
  button.textContent = 'Restoring…';
  try {
    await api(`/api/admin/entries/${entry.id}/dismiss-reports`, { method: 'POST' });
    showToast('Reports dismissed. The entry is live again.');
    await loadEntries();
  } catch (error) {
    handleApiError(error);
    button.disabled = false;
    button.textContent = 'Dismiss reports & restore';
  }
}

async function copyEntryLink(entry) {
  const url = `${window.location.origin}/entry?id=${entry.id}`;
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(url);
    showToast('Entry link copied.');
  } catch {
    showToast('Could not copy the link. Open the entry and copy the URL instead.', 'error');
  }
}

function askDelete(entry) {
  pendingDelete = entry;
  elements.confirmText.textContent = `This permanently removes “${entry.name}” (${eventLabel(
    entry.event
  )}, ${formatTimeMs(entry.timeMs)}) and all of its reports. This cannot be undone.`;
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
      state.visible = PAGE_SIZE;
      elements.filterButtons.forEach((other) => {
        other.classList.toggle('is-active', other === button);
      });
      renderAdmin();
    });
  });

  elements.search.addEventListener('input', () => {
    state.search = elements.search.value.trim();
    state.visible = PAGE_SIZE;
    renderAdmin();
  });

  elements.eventSelect.addEventListener('change', () => {
    state.event = elements.eventSelect.value;
    state.visible = PAGE_SIZE;
    renderAdmin();
  });

  elements.sort.addEventListener('change', () => {
    state.sort = elements.sort.value;
    state.visible = PAGE_SIZE;
    renderAdmin();
  });

  elements.loadMore.addEventListener('click', () => {
    state.visible += PAGE_SIZE;
    renderAdmin();
  });

  elements.refresh.addEventListener('click', refreshEntries);

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || elements.confirmDialog.open) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    event.preventDefault();
    elements.search.focus();
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
    } else if (button.dataset.action === 'copy') {
      copyEntryLink(entry);
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
