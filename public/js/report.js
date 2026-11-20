import { api, ApiError } from './api.js';
import { showToast } from './ui.js';
import { formatTimeMs } from './time.js';

const REASONS = [
  {
    value: 'fake_time',
    title: 'Fake time',
    description: 'The result looks impossible or edited.',
  },
  {
    value: 'fake_witnesses',
    title: 'Fake witnesses',
    description: 'The listed witnesses may not exist or were not there.',
  },
  {
    value: 'spam',
    title: 'Spam',
    description: 'Offensive, irrelevant or duplicate content.',
  },
  {
    value: 'other',
    title: 'Other',
    description: 'Something else is wrong with this entry.',
  },
];

let dialog = null;
let form = null;
let errorElement = null;
let nameElement = null;
let timeElement = null;
let submitButton = null;
let activeEntry = null;
let reportedCallback = () => {};

function open(entry) {
  if (!dialog) return;
  activeEntry = entry;
  form.reset();
  errorElement.hidden = true;
  errorElement.textContent = '';
  nameElement.textContent = entry.name;
  timeElement.textContent = formatTimeMs(entry.timeMs);
  submitButton.disabled = false;
  submitButton.textContent = 'Send report';

  if (!dialog.open) dialog.showModal();
  window.requestAnimationFrame(() => {
    dialog.querySelector('input[name="reason"]')?.focus();
  });
}

const controller = { open };

function buildDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <form class="dialog-card report-form" novalidate>
      <button type="button" class="dialog-close" data-close aria-label="Close dialog">×</button>
      <p class="eyebrow">Community report</p>
      <h2>Report this entry</h2>
      <p class="dialog-subtitle">
        You are reporting <strong data-report-name></strong> — <span class="mono" data-report-time></span>.
        Enough reports can hide an entry until a moderator reviews it.
      </p>
      <fieldset class="reason-grid">
        <legend class="sr-only">Why are you reporting this entry?</legend>
        ${REASONS.map(
          (reason) => `
            <label class="reason-option">
              <input type="radio" name="reason" value="${reason.value}">
              <span class="reason-copy">
                <strong>${reason.title}</strong>
                <small>${reason.description}</small>
              </span>
            </label>
          `
        ).join('')}
      </fieldset>
      <label class="field">
        <span class="field-label">Details <small>(required for “Other”)</small></span>
        <textarea name="note" rows="3" maxlength="300" placeholder="What should the moderators know?"></textarea>
      </label>
      <p class="form-error" data-report-error hidden></p>
      <div class="dialog-actions">
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
        <button type="submit" class="btn btn-danger">Send report</button>
      </div>
    </form>
  `;
  document.body.append(dialog);

  form = dialog.querySelector('form');
  errorElement = dialog.querySelector('[data-report-error]');
  nameElement = dialog.querySelector('[data-report-name]');
  timeElement = dialog.querySelector('[data-report-time]');
  submitButton = form.querySelector('button[type="submit"]');

  dialog.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!activeEntry) return;

    const reason = form.querySelector('input[name="reason"]:checked')?.value;
    const note = form.elements.note.value;

    if (!reason) {
      errorElement.textContent = 'Please choose a reason first.';
      errorElement.hidden = false;
      return;
    }

    errorElement.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';

    try {
      const result = await api(`/api/entries/${activeEntry.id}/report`, {
        method: 'POST',
        body: { reason, note },
      });

      dialog.close();
      showToast(
        result.underReview
          ? 'Thanks. This entry has been put on hold for review.'
          : 'Thanks — your report was sent to the moderators.'
      );

      try {
        await reportedCallback(activeEntry, result);
      } catch {
        // The report itself succeeded; a failed refresh should not look like an error.
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'The report could not be sent. Please try again.';
      errorElement.textContent = message;
      errorElement.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Send report';
    }
  });
}

export function setupReportDialog({ onReported } = {}) {
  reportedCallback = typeof onReported === 'function' ? onReported : () => {};
  if (!dialog) buildDialog();
  return controller;
}
