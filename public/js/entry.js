import { api, ApiError } from './api.js';
import {
  escapeHtml,
  formatDate,
  formatTimestamp,
  witnessTier,
} from './ui.js';
import { formatTimeMs } from './time.js';
import { getEvent } from './events.js';
import { setupReportDialog } from './report.js';

const params = new URLSearchParams(window.location.search);
const entryId = Number.parseInt(params.get('id') ?? '', 10);

const elements = {
  loading: document.getElementById('entry-loading'),
  notFound: document.getElementById('entry-not-found'),
  content: document.getElementById('entry-content'),
  reviewBanner: document.getElementById('review-banner'),
  eventLabel: document.getElementById('entry-event-label'),
  event: document.getElementById('entry-event'),
  time: document.getElementById('entry-time'),
  name: document.getElementById('entry-name'),
  date: document.getElementById('entry-date'),
  added: document.getElementById('entry-added'),
  status: document.getElementById('entry-status'),
  video: document.getElementById('entry-video'),
  noteWrap: document.getElementById('entry-note-wrap'),
  note: document.getElementById('entry-note'),
  witnessPill: document.getElementById('entry-witness-pill'),
  witnessList: document.getElementById('witness-list'),
  witnessEmpty: document.getElementById('witness-empty'),
  reportButtons: [document.getElementById('entry-report'), document.getElementById('entry-report-cta')],
};

let currentEntry = null;

const reporter = setupReportDialog({
  onReported: () => loadEntry(true),
});

function showNotFound(message) {
  elements.loading.hidden = true;
  elements.content.hidden = true;
  elements.notFound.hidden = false;
  if (message) {
    elements.notFound.querySelector('p').textContent = message;
  }
}

function setReportButtonsDisabled(disabled) {
  elements.reportButtons.forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
    button.title = disabled ? 'This entry is already under review.' : '';
  });
}

function renderEntry(entry) {
  const tier = witnessTier(entry.witnessCount);
  const details = getEvent(entry.event);
  const eventName = details?.name ?? entry.event;
  document.title = `${formatTimeMs(entry.timeMs)} — ${eventName} — Rubix Leaderboard`;

  elements.eventLabel.textContent = eventName;
  elements.event.textContent = eventName;
  elements.time.textContent = formatTimeMs(entry.timeMs);
  elements.name.textContent = entry.name;
  elements.date.textContent = formatDate(entry.solvedAt);
  elements.added.textContent = formatTimestamp(entry.createdAt);

  const underReview = entry.status === 'under_review';
  elements.status.textContent = underReview ? 'Under review' : 'Live';
  elements.status.className = `status-pill ${underReview ? 'status-pill--review' : 'status-pill--live'}`;
  elements.reviewBanner.hidden = !underReview;
  setReportButtonsDisabled(underReview);

  if (entry.videoUrl) {
    elements.video.href = entry.videoUrl;
    elements.video.hidden = false;
  } else {
    elements.video.hidden = true;
  }

  if (entry.note) {
    elements.note.textContent = entry.note;
    elements.noteWrap.hidden = false;
  } else {
    elements.noteWrap.hidden = true;
  }

  elements.witnessPill.textContent = tier.label;
  elements.witnessPill.className = `witness-pill ${tier.className}`;

  if (entry.witnessCount === 0) {
    elements.witnessList.innerHTML = '';
    elements.witnessList.hidden = true;
    elements.witnessEmpty.hidden = false;
  } else {
    elements.witnessList.hidden = false;
    elements.witnessEmpty.hidden = true;
    elements.witnessList.innerHTML = entry.witnesses
      .map(
        (name) => `
          <li class="witness-item">
            <span class="witness-copy">
              <strong>${escapeHtml(name)}</strong>
              <span>Witness</span>
            </span>
          </li>
        `
      )
      .join('');
  }

  elements.loading.hidden = true;
  elements.notFound.hidden = true;
  elements.content.hidden = false;
}

async function loadEntry(silent = false) {
  if (!Number.isInteger(entryId) || entryId < 1) {
    showNotFound('The link does not contain a valid entry ID.');
    return;
  }

  if (!silent) {
    elements.loading.hidden = false;
    elements.content.hidden = true;
    elements.notFound.hidden = true;
  }

  try {
    const data = await api(`/api/entries/${entryId}`);
    currentEntry = data.entry;
    renderEntry(data.entry);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      showNotFound('It may have been removed by a moderator.');
    } else {
      showNotFound('The entry could not be loaded. Refresh the page to try again.');
    }
  }
}

elements.reportButtons.forEach((button) => {
  button?.addEventListener('click', () => {
    if (currentEntry && currentEntry.status !== 'under_review') {
      reporter.open(currentEntry);
    }
  });
});

loadEntry();
