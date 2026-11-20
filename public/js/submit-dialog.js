import { api, ApiError } from './api.js';
import { DEFAULT_EVENT, getEvent, isEvent } from './events.js';
import { formatTimeMs, parseTimeInput } from './time.js';
import {
  clearFieldErrors,
  escapeHtml,
  showFieldErrors,
  showFormBanner,
  showToast,
} from './ui.js';

let dialog = null;
let head = null;
let form = null;
let success = null;
let witnessRows = null;
let addWitnessButton = null;
let witnessCountLabel = null;
let errorBanner = null;
let submitButton = null;
let timeInput = null;
let timePreview = null;
let noteInput = null;
let noteCount = null;
let solvedAtInput = null;
let eventSelect = null;
let peopleList = null;
let successTitle = null;
let successMessage = null;
let successTime = null;
let successLink = null;

let peopleLoaded = false;
let activeEvent = DEFAULT_EVENT;
let onSubmitted = () => {};
let onClosed = () => {};

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateWitnessMeta() {
  if (!witnessRows) return;
  const rows = Array.from(witnessRows.querySelectorAll('.witness-row'));
  let filled = 0;

  rows.forEach((row, index) => {
    row.querySelector('.witness-index').textContent = index + 1;
    if (row.querySelector('input').value.trim()) filled += 1;
  });

  witnessCountLabel.textContent = `${filled} added`;
}

function createWitnessRow(value = '') {
  const row = document.createElement('div');
  row.className = 'witness-row';
  row.innerHTML = `
    <span class="witness-index"></span>
    <input
      class="witness-input"
      list="submit-people-list"
      maxlength="40"
      autocomplete="off"
      placeholder="Witness name"
      aria-label="Witness name"
    />
    <button type="button" class="icon-btn witness-remove" aria-label="Remove this witness">
      <svg class="icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="m6 6 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  const input = row.querySelector('input');
  input.value = value;

  input.addEventListener('input', () => {
    updateWitnessMeta();
    const error = form.querySelector('[data-error-for="witnesses"]');
    if (error) error.hidden = true;
  });

  row.querySelector('.witness-remove').addEventListener('click', () => {
    row.remove();
    updateWitnessMeta();
  });

  witnessRows.append(row);
  updateWitnessMeta();
  return input;
}

function collectWitnesses() {
  return Array.from(witnessRows.querySelectorAll('.witness-input'))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function updateTimePreview() {
  const raw = timeInput.value;
  timeInput.classList.remove('is-invalid');

  if (!raw.trim()) {
    timePreview.textContent = 'Use 12.345 or 1:02.345.';
    timePreview.className = 'field-hint';
    return;
  }

  const milliseconds = parseTimeInput(raw);
  if (milliseconds === null) {
    timePreview.textContent = 'Not a valid time yet — try 12.345 or 1:02.345.';
    timePreview.className = 'field-hint field-hint--error';
    timeInput.classList.add('is-invalid');
  } else {
    timePreview.textContent = `Reads as ${formatTimeMs(milliseconds)}`;
    timePreview.className = 'field-hint field-hint--ok';
  }
}

function resetForm() {
  form.reset();
  clearFieldErrors(form);
  showFormBanner(errorBanner, '');
  timeInput.classList.remove('is-invalid');
  timePreview.textContent = 'Use 12.345 or 1:02.345.';
  timePreview.className = 'field-hint';
  noteCount.textContent = '0';

  const today = localIsoDate();
  solvedAtInput.max = today;
  solvedAtInput.value = today;

  witnessRows.innerHTML = '';
  createWitnessRow();

  eventSelect.value = activeEvent;
  submitButton.disabled = false;
  submitButton.textContent = 'Publish entry';

  head.hidden = false;
  form.hidden = false;
  success.hidden = true;
}

function showSuccess(result, payload, witnessCount) {
  const milliseconds = parseTimeInput(payload.time);
  const details = getEvent(payload.event);
  const eventName = details?.name ?? payload.event;

  if (result.isPB && result.previousBestMs == null) {
    successTitle.textContent = 'Your first entry is live!';
    successMessage.textContent = `You are on the ${eventName} board. Your witnesses are attached to the entry.`;
  } else if (result.isPB) {
    successTitle.textContent = 'New personal best!';
    successMessage.textContent = `You beat your previous ${eventName} best of ${formatTimeMs(
      result.previousBestMs
    )}. The new time is now your entry on the leaderboard.`;
  } else {
    successTitle.textContent = 'Time saved.';
    successMessage.textContent = `Your ${eventName} personal best remains ${formatTimeMs(
      result.previousBestMs
    )}. The attempt is stored and visible with “All attempts”.`;
  }

  if (witnessCount > 0) {
    successMessage.textContent += ` ${witnessCount} witness${
      witnessCount === 1 ? '' : 'es'
    } listed.`;
  }

  successTime.textContent = milliseconds === null ? payload.time : formatTimeMs(milliseconds);
  successLink.href = `/entry?id=${result.id}`;
  head.hidden = true;
  form.hidden = true;
  success.hidden = false;
  dialog.querySelector('.submit-dialog-card').scrollTop = 0;
}

function showApiError(error) {
  if (error instanceof ApiError) {
    if (error.fields) {
      showFieldErrors(form, error.fields);
      const order = ['event', 'solver', 'time', 'solvedAt', 'videoUrl', 'note', 'witnesses'];
      const first = order.find((name) => error.fields[name]);
      if (first === 'witnesses') {
        witnessRows.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (first) {
        form.elements[first]?.focus({ preventScroll: true });
        form.elements[first]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    showFormBanner(errorBanner, error.message);
    showToast(error.message, 'error');
    return;
  }

  const message = 'The entry could not be published. Check your connection and try again.';
  showFormBanner(errorBanner, message);
  showToast(message, 'error');
}

async function loadPeople() {
  if (peopleLoaded) return;
  try {
    const data = await api('/api/people');
    peopleList.innerHTML = data.names
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join('');
    peopleLoaded = true;
  } catch {
    // Autocomplete is a convenience; the form still works without it.
  }
}

function open({ event = DEFAULT_EVENT } = {}) {
  if (!dialog) return;
  activeEvent = isEvent(event) ? event : DEFAULT_EVENT;
  resetForm();
  loadPeople();

  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
  window.requestAnimationFrame(() => {
    form.elements.solver?.focus({ preventScroll: true });
  });
}

function close() {
  if (dialog?.open) dialog.close();
}

function buildBindings() {
  dialog = document.getElementById('submit-dialog');
  if (!dialog) return false;

  head = document.getElementById('submit-dialog-head');
  form = document.getElementById('submit-form');
  success = document.getElementById('submit-success');
  witnessRows = document.getElementById('witness-rows');
  addWitnessButton = document.getElementById('add-witness');
  witnessCountLabel = document.getElementById('witness-count-label');
  errorBanner = document.getElementById('submit-form-error');
  submitButton = document.getElementById('submit-btn');
  timeInput = document.getElementById('time');
  timePreview = document.getElementById('time-preview');
  noteInput = document.getElementById('note');
  noteCount = document.getElementById('note-count');
  solvedAtInput = document.getElementById('solved-at');
  eventSelect = document.getElementById('submit-event');
  peopleList = document.getElementById('submit-people-list');
  successTitle = document.getElementById('success-title');
  successMessage = document.getElementById('success-message');
  successTime = document.getElementById('success-time');
  successLink = document.getElementById('success-link');

  dialog.querySelectorAll('[data-submit-close]').forEach((button) => {
    button.addEventListener('click', close);
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    onClosed();
  });

  addWitnessButton.addEventListener('click', () => {
    const input = createWitnessRow();
    input.focus();
  });

  timeInput.addEventListener('input', () => {
    updateTimePreview();
    const error = form.querySelector('[data-error-for="time"]');
    if (error) error.hidden = true;
  });

  noteInput.addEventListener('input', () => {
    noteCount.textContent = String(noteInput.value.length);
  });

  form.addEventListener('input', (event) => {
    const field = event.target.name;
    if (!field) return;
    const error = form.querySelector(`[data-error-for="${field}"]`);
    if (error) error.hidden = true;
    showFormBanner(errorBanner, '');
  });

  document.getElementById('submit-again').addEventListener('click', () => {
    resetForm();
    window.requestAnimationFrame(() => {
      form.elements.solver?.focus({ preventScroll: true });
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    showFormBanner(errorBanner, '');

    const witnesses = collectWitnesses();
    const payload = {
      event: form.elements.event.value,
      solver: form.elements.solver.value,
      time: form.elements.time.value,
      solvedAt: form.elements.solvedAt.value,
      videoUrl: form.elements.videoUrl.value,
      note: form.elements.note.value,
      witnesses,
    };

    submitButton.disabled = true;
    submitButton.textContent = 'Publishing…';

    try {
      const result = await api('/api/entries', { method: 'POST', body: payload });
      activeEvent = isEvent(payload.event) ? payload.event : DEFAULT_EVENT;
      showSuccess(result, payload, witnesses.length);
      showToast('Entry published.', 'success');

      try {
        await onSubmitted(result, payload);
      } catch {
        // The entry is published; a failed leaderboard refresh is not a submit failure.
      }
    } catch (error) {
      showApiError(error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Publish entry';
    }
  });

  return true;
}

export function setupSubmitDialog({ onSubmitted: submitted, onClosed: closed } = {}) {
  onSubmitted = typeof submitted === 'function' ? submitted : () => {};
  onClosed = typeof closed === 'function' ? closed : () => {};
  if (!dialog && !buildBindings()) return null;

  return { open, close, isOpen: () => Boolean(dialog?.open) };
}
