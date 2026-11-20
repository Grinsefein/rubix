import { api } from './api.js';
import {
  escapeHtml,
  formatDate,
  witnessTier,
} from './ui.js';
import { formatTimeMs } from './time.js';
import { DEFAULT_EVENT, EVENTS, getEvent, isEvent } from './events.js';
import { setupReportDialog } from './report.js';
import { setupSubmitDialog } from './submit-dialog.js';

const params = new URLSearchParams(window.location.search);
const initialEvent = isEvent(params.get('event')) ? params.get('event') : DEFAULT_EVENT;

const state = {
  event: initialEvent,
  pbEntries: [],
  allEntries: null,
  all: false,
  sort: 'time',
  search: '',
};

const elements = {
  boardEventLabel: document.getElementById('board-event-label'),
  eventSwitcher: document.getElementById('event-switcher'),
  statSolvers: document.getElementById('stat-solvers'),
  statEntries: document.getElementById('stat-entries'),
  statWitnesses: document.getElementById('stat-witnesses'),
  heroFastest: document.getElementById('hero-fastest'),
  heroName: document.getElementById('hero-fastest-name'),
  heroWitnesses: document.getElementById('hero-witnesses'),
  podiumSection: document.getElementById('podium-section'),
  podium: document.getElementById('podium'),
  boardLoading: document.getElementById('board-loading'),
  lbTable: document.getElementById('lb-table'),
  lbBody: document.getElementById('lb-body'),
  boardEmpty: document.getElementById('board-empty'),
  boardCount: document.getElementById('board-count'),
  search: document.getElementById('search'),
  showAll: document.getElementById('show-all'),
  sortButtons: Array.from(document.querySelectorAll('[data-sort]')),
  submitTriggers: Array.from(document.querySelectorAll('[data-open-submit]')),
};

let reporter = null;
let submitter = null;
let entriesById = new Map();
const expandedEntries = new Set();
let loadToken = 0;

function renderEventSwitcher() {
  elements.eventSwitcher.innerHTML = EVENTS.map((event) => {
    const active = event.id === state.event;
    return `
      <button
        type="button"
        class="event-btn${active ? ' is-active' : ''}"
        data-event="${event.id}"
        aria-pressed="${active}"
      >${event.label}</button>
    `;
  }).join('');

  const activeButton = elements.eventSwitcher.querySelector('.event-btn.is-active');
  if (!activeButton) return;

  const boxRect = elements.eventSwitcher.getBoundingClientRect();
  const activeRect = activeButton.getBoundingClientRect();
  if (activeRect.left < boxRect.left || activeRect.right > boxRect.right) {
    elements.eventSwitcher.scrollLeft +=
      activeRect.left - boxRect.left - (boxRect.width - activeRect.width) / 2;
  }
}

function syncEventUrl() {
  const url = new URL(window.location.href);
  if (state.event === DEFAULT_EVENT) {
    url.searchParams.delete('event');
  } else {
    url.searchParams.set('event', state.event);
  }
  window.history.replaceState(null, '', url);
}

function setSubmitParam(open) {
  const url = new URL(window.location.href);
  if (open) {
    url.searchParams.set('submit', '1');
  } else {
    url.searchParams.delete('submit');
  }
  window.history.replaceState(null, '', url);
}

function renderStats(stats) {
  elements.statSolvers.textContent = stats.solvers;
  elements.statEntries.textContent = stats.entries;
  elements.statWitnesses.textContent = stats.witnessTags;
}

function renderHero(entries) {
  const leader = entries[0];
  if (!leader) {
    elements.heroFastest.textContent = '--.---';
    elements.heroName.textContent = 'Waiting for the first record';
    elements.heroWitnesses.textContent = '';
    return;
  }

  const tier = witnessTier(leader.witnessCount);
  elements.heroFastest.textContent = formatTimeMs(leader.timeMs);
  elements.heroName.textContent = leader.name;
  elements.heroWitnesses.innerHTML = `
    <span class="hero-witness-label">${escapeHtml(tier.label)}</span>
  `;
}

function renderPodium(entries) {
  const top = entries.slice(0, 3);
  if (top.length === 0) {
    elements.podiumSection.hidden = true;
    return;
  }

  elements.podiumSection.hidden = false;
  elements.podium.innerHTML = top
    .map((entry, index) => {
      const rank = index + 1;
      const tier = witnessTier(entry.witnessCount);
      return `
        <a class="top-card top-card--${rank}" href="/entry?id=${entry.id}">
          <span class="top-rank">${rank}</span>
          <span class="top-info">
            <span class="top-name">${escapeHtml(entry.name)}</span>
            <span class="top-time mono">${formatTimeMs(entry.timeMs)}</span>
          </span>
          <span class="witness-pill ${tier.className} top-witness">${escapeHtml(
            tier.label
          )}</span>
        </a>
      `;
    })
    .join('');
}

function rankEntries(entries) {
  const sorted = [...entries].sort(
    (a, b) =>
      a.timeMs - b.timeMs ||
      a.solvedAt.localeCompare(b.solvedAt) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id - b.id
  );

  let previousTime = null;
  let previousRank = 0;
  return sorted.map((entry, index) => {
    const rank = entry.timeMs === previousTime ? previousRank : index + 1;
    previousTime = entry.timeMs;
    previousRank = rank;
    return { entry, rank };
  });
}

function currentBaseEntries() {
  return state.all ? state.allEntries ?? [] : state.pbEntries;
}

function matchesFilters(entry) {
  if (!state.search) return true;

  const needle = state.search.toLowerCase();
  if (entry.name.toLowerCase().includes(needle)) return true;
  return entry.witnesses.some((name) => name.toLowerCase().includes(needle));
}

function sortForDisplay(entries) {
  return [...entries].sort((a, b) => {
    if (state.sort === 'date') {
      return b.solvedAt.localeCompare(a.solvedAt) || b.id - a.id;
    }
    return (
      a.timeMs - b.timeMs ||
      a.solvedAt.localeCompare(b.solvedAt) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id - b.id
    );
  });
}

function renderBoard() {
  const base = currentBaseEntries();
  const rankMap = new Map(rankEntries(base).map(({ entry, rank }) => [entry.id, rank]));
  const filtered = base.filter(matchesFilters);
  const rows = sortForDisplay(filtered);
  const noun = state.all ? 'attempts' : 'solvers';

  elements.boardCount.textContent =
    filtered.length === base.length
      ? `${base.length} ${noun}`
      : `${filtered.length} of ${base.length} ${noun}`;

  elements.boardLoading.hidden = true;
  entriesById = new Map(rows.map((entry) => [entry.id, entry]));

  if (rows.length === 0) {
    elements.lbTable.hidden = true;
    elements.boardEmpty.hidden = false;
    return;
  }

  elements.boardEmpty.hidden = true;
  elements.lbTable.hidden = false;

  elements.lbBody.innerHTML = rows
    .map((entry) => {
      const rank = rankMap.get(entry.id);
      const tier = witnessTier(entry.witnessCount);
      const isPB = state.all && entry.timeMs === entry.personBestMs;
      const rankClass = rank <= 3 ? `rank-badge rank-badge--${rank}` : 'rank-badge';
      const isExpanded = expandedEntries.has(entry.id);
      const witnesses =
        entry.witnesses.length > 0
          ? entry.witnesses.map((name) => escapeHtml(name)).join(', ')
          : 'No witnesses are listed for this entry.';
      const video = entry.videoUrl
        ? `<a class="icon-btn" href="${escapeHtml(entry.videoUrl)}" target="_blank" rel="noopener noreferrer" title="Watch video" aria-label="Watch video for ${escapeHtml(entry.name)}">
             <svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5v9l7-4.5-7-4.5Z" fill="currentColor"/></svg>
           </a>`
        : '';

      return `
        <tr>
          <td class="cell-rank"><span class="${rankClass}">${rank}</span></td>
          <td class="cell-solver">
            <a class="solver-cell" href="/entry?id=${entry.id}">
              <span class="solver-name">${escapeHtml(entry.name)}</span>
            </a>
          </td>
          <td class="cell-time">
            <a class="time-cell mono" href="/entry?id=${entry.id}">
              ${formatTimeMs(entry.timeMs)}${isPB ? '<span class="pb-chip">PB</span>' : ''}
            </a>
          </td>
          <td class="cell-date date-cell">${formatDate(entry.solvedAt)}</td>
          <td class="cell-witness">
            <span class="witness-cell">
              <span class="witness-pill ${tier.className}">${escapeHtml(tier.label)}</span>
            </span>
          </td>
          <td class="cell-actions actions-cell">
            ${video}
            <button type="button" class="icon-btn report-btn" data-report-id="${
              entry.id
            }" title="Report entry" aria-label="Report ${escapeHtml(entry.name)}">
              <svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V4m0 0h9l-2 3 2 3H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button
              type="button"
              class="icon-btn entry-expand-btn"
              data-expand-id="${entry.id}"
              aria-controls="entry-details-${entry.id}"
              aria-expanded="${isExpanded}"
              aria-label="${isExpanded ? 'Hide' : 'Show'} witnesses for ${escapeHtml(entry.name)}"
              title="${isExpanded ? 'Hide' : 'Show'} witnesses"
            >
              <svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 8 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </td>
        </tr>
        <tr class="entry-detail-row" id="entry-details-${entry.id}"${isExpanded ? '' : ' hidden'}>
          <td colspan="6">
            <div class="entry-details">
              <strong>Witnesses</strong>
              <p>${witnesses}</p>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function showBoardError() {
  elements.boardLoading.hidden = false;
  elements.boardLoading.innerHTML =
    'The leaderboard could not be loaded. Refresh the page to try again.';
  elements.boardLoading.classList.add('loading-state--error');
  elements.lbTable.hidden = true;
  elements.boardEmpty.hidden = true;
}

async function loadAllEntries() {
  const data = await api(`/api/leaderboard?event=${state.event}&all=1`);
  state.allEntries = data.entries;
}

async function refreshAll() {
  const token = ++loadToken;
  const event = state.event;
  const boardRequest = api(`/api/leaderboard?event=${event}`);
  const statsRequest = api(`/api/stats?event=${event}`);

  try {
    const [stats, board] = await Promise.all([statsRequest, boardRequest]);
    if (token !== loadToken) return;

    state.pbEntries = board.entries;
    state.allEntries = null;
    if (state.all) await loadAllEntries();
    if (token !== loadToken) return;

    renderStats(stats);
    renderHero(state.pbEntries);
    renderPodium(state.pbEntries);
    renderBoard();
  } catch {
    if (token === loadToken) showBoardError();
  }
}

async function switchEvent(event, { updateUrl = true } = {}) {
  if (!isEvent(event) || event === state.event) {
    if (event === state.event) {
      renderEventSwitcher();
    }
    return;
  }

  state.event = event;
  state.allEntries = null;
  state.search = '';
  elements.search.value = '';
  elements.boardLoading.hidden = false;
  elements.boardLoading.classList.remove('loading-state--error');
  elements.boardLoading.innerHTML =
    '<span class="spinner" aria-hidden="true"></span> Loading the leaderboard…';
  elements.lbTable.hidden = true;
  elements.boardEmpty.hidden = true;
  elements.boardCount.textContent = '—';

  const details = getEvent(event);
  elements.boardEventLabel.textContent = `${details?.label ?? event} speedcubing`;
  document.title = `${details?.label ?? event} Leaderboard — Rubix`;

  renderEventSwitcher();
  if (updateUrl) syncEventUrl();
  await refreshAll();
}

function setSort(sort) {
  state.sort = sort;
  elements.sortButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.sort === sort);
  });
  renderBoard();
}

function openSubmit() {
  if (!submitter) return;
  setSubmitParam(true);
  submitter.open({ event: state.event });
}

function bindEvents() {
  elements.eventSwitcher.addEventListener('click', (event) => {
    const button = event.target.closest('[data-event]');
    if (!button) return;
    switchEvent(button.dataset.event);
  });

  elements.search.addEventListener('input', () => {
    state.search = elements.search.value.trim();
    renderBoard();
  });

  elements.showAll.addEventListener('change', async () => {
    state.all = elements.showAll.checked;
    elements.boardLoading.hidden = false;
    elements.lbTable.hidden = true;
    elements.boardEmpty.hidden = true;

    try {
      if (state.all && !state.allEntries) await loadAllEntries();
      renderBoard();
    } catch {
      showBoardError();
    }
  });

  elements.sortButtons.forEach((button) => {
    button.addEventListener('click', () => setSort(button.dataset.sort));
  });

  elements.lbBody.addEventListener('click', (event) => {
    const expandButton = event.target.closest('.entry-expand-btn');
    if (expandButton) {
      const entryId = Number(expandButton.dataset.expandId);
      if (expandedEntries.has(entryId)) {
        expandedEntries.delete(entryId);
      } else {
        expandedEntries.add(entryId);
      }
      renderBoard();
      return;
    }

    const button = event.target.closest('.report-btn');
    if (!button) return;
    const entry = entriesById.get(Number(button.dataset.reportId));
    if (entry) reporter.open(entry);
  });

  elements.submitTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openSubmit();
    });
  });
}

async function init() {
  reporter = setupReportDialog({ onReported: refreshAll });
  submitter = setupSubmitDialog({
    onSubmitted: async (result, payload) => {
      if (payload.event === state.event) {
        await refreshAll();
      } else {
        await switchEvent(payload.event);
      }
    },
    onClosed: () => setSubmitParam(false),
  });

  renderEventSwitcher();
  const details = getEvent(state.event);
  elements.boardEventLabel.textContent = `${details?.label ?? state.event} speedcubing`;
  document.title = `${details?.label ?? state.event} Leaderboard — Rubix`;

  bindEvents();
  await refreshAll();

  if (params.get('submit') === '1') {
    openSubmit();
  }
}

init();
