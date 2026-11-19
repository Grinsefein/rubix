import { api } from './api.js';
import {
  avatarColor,
  escapeHtml,
  formatDate,
  initials,
  witnessAvatars,
  witnessTier,
} from './ui.js';
import { formatTimeMs } from './time.js';
import { setupReportDialog } from './report.js';

const state = {
  pbEntries: [],
  allEntries: null,
  all: false,
  sort: 'time',
  search: '',
  onlyWitnessed: false,
};

const elements = {
  statSolvers: document.getElementById('stat-solvers'),
  statEntries: document.getElementById('stat-entries'),
  statWitnesses: document.getElementById('stat-witnesses'),
  statFastest: document.getElementById('stat-fastest'),
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
  onlyWitnessed: document.getElementById('only-witnessed'),
  showAll: document.getElementById('show-all'),
  sortButtons: Array.from(document.querySelectorAll('[data-sort]')),
};

let reporter = null;
let entriesById = new Map();

function renderStats(stats) {
  elements.statSolvers.textContent = stats.solvers;
  elements.statEntries.textContent = stats.entries;
  elements.statWitnesses.textContent = stats.witnessTags;
  elements.statFastest.textContent = stats.fastestMs == null ? '--.---' : formatTimeMs(stats.fastestMs);
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
    ${witnessAvatars(leader.witnesses, 4)}
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
        <a class="podium-card podium-card--${rank}" href="/entry?id=${entry.id}">
          <span class="podium-rank">${rank}</span>
          <span class="avatar avatar--xl avatar--${avatarColor(entry.name)}">${escapeHtml(
            initials(entry.name)
          )}</span>
          <h3 class="podium-name">${escapeHtml(entry.name)}</h3>
          <span class="podium-time mono">${formatTimeMs(entry.timeMs)}</span>
          <span class="podium-meta">
            ${witnessAvatars(entry.witnesses)}
            <span class="witness-pill ${tier.className}">${escapeHtml(tier.label)}</span>
          </span>
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
  if (state.onlyWitnessed && entry.witnessCount === 0) return false;
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
      const video = entry.videoUrl
        ? `<a class="icon-btn" href="${escapeHtml(entry.videoUrl)}" target="_blank" rel="noopener noreferrer" title="Watch video" aria-label="Watch video for ${escapeHtml(entry.name)}">
             <svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5.5v9l7-4.5-7-4.5Z" fill="currentColor"/></svg>
           </a>`
        : '';

      return `
        <tr>
          <td><span class="${rankClass}">${rank}</span></td>
          <td>
            <a class="solver-cell" href="/entry?id=${entry.id}">
              <span class="avatar avatar--sm avatar--${avatarColor(entry.name)}">${escapeHtml(
                initials(entry.name)
              )}</span>
              <span class="solver-name">${escapeHtml(entry.name)}</span>
            </a>
          </td>
          <td>
            <a class="time-cell mono" href="/entry?id=${entry.id}">
              ${formatTimeMs(entry.timeMs)}${isPB ? '<span class="pb-chip">PB</span>' : ''}
            </a>
          </td>
          <td class="date-cell">${formatDate(entry.solvedAt)}</td>
          <td>
            <span class="witness-cell">
              ${witnessAvatars(entry.witnesses)}
              <span class="witness-pill ${tier.className}">${escapeHtml(tier.label)}</span>
            </span>
          </td>
          <td class="actions-cell">
            ${video}
            <button type="button" class="icon-btn report-btn" data-report-id="${
              entry.id
            }" title="Report entry" aria-label="Report ${escapeHtml(entry.name)}">
              <svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V4m0 0h9l-2 3 2 3H5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function showBoardError() {
  elements.boardLoading.innerHTML = 'The leaderboard could not be loaded. Refresh the page to try again.';
  elements.boardLoading.classList.add('loading-state--error');
}

async function loadAllEntries() {
  const data = await api('/api/leaderboard?all=1');
  state.allEntries = data.entries;
}

async function refreshAll() {
  const [stats, board] = await Promise.all([api('/api/stats'), api('/api/leaderboard')]);
  state.pbEntries = board.entries;
  state.allEntries = null;
  renderStats(stats);
  renderHero(state.pbEntries);
  renderPodium(state.pbEntries);
  if (state.all) await loadAllEntries();
  renderBoard();
}

function setSort(sort) {
  state.sort = sort;
  elements.sortButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.sort === sort);
  });
  renderBoard();
}

function bindEvents() {
  elements.search.addEventListener('input', () => {
    state.search = elements.search.value.trim();
    renderBoard();
  });

  elements.onlyWitnessed.addEventListener('change', () => {
    state.onlyWitnessed = elements.onlyWitnessed.checked;
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
    const button = event.target.closest('.report-btn');
    if (!button) return;
    const entry = entriesById.get(Number(button.dataset.reportId));
    if (entry) reporter.open(entry);
  });
}

async function init() {
  reporter = setupReportDialog({ onReported: refreshAll });
  bindEvents();

  try {
    const [stats, board] = await Promise.all([api('/api/stats'), api('/api/leaderboard')]);
    state.pbEntries = board.entries;
    renderStats(stats);
    renderHero(state.pbEntries);
    renderPodium(state.pbEntries);
    renderBoard();
  } catch {
    showBoardError();
  }
}

init();
