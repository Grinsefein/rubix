import { api, ApiError } from './api.js';
import { formatTimeMs, parseTimeInput } from './time.js';
import {
  clearFieldErrors,
  escapeHtml,
  showFieldErrors,
  showFormBanner,
  showToast,
} from './ui.js';

const form = document.getElementById('submit-form');
const layout = document.getElementById('submit-layout');
const success = document.getElementById('submit-success');
const witnessRows = document.getElementById('witness-rows');
const addWitnessButton = document.getElementById('add-witness');
const witnessCountLabel = document.getElementById('witness-count-label');
const errorBanner = document.getElementById('form-error');
const submitButton = document.getElementById('submit-btn');
const timeInput = document.getElementById('time');
const timePreview = document.getElementById('time-preview');
const noteInput = document.getElementById('note');
const noteCount = document.getElementById('note-count');
const solvedAtInput = document.getElementById('solved-at');
const peopleList = document.getElementById('people-list');
const successTitle = document.getElementById('success-title');
const successMessage = document.getElementById('success-message');
const successTime = document.getElementById('success-time');
const successLink = document.getElementById('success-link');

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateWitnessMeta() {
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
      list="people-list"
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

function showSuccess(result, payload, witnessCount) {
  const milliseconds = parseTimeInput(payload.time);

  if (result.isPB && result.previousBestMs == null) {
    successTitle.textContent = 'Your first entry is live!';
    successMessage.textContent =
      'You are on the board. Bring a few witnesses next time to make the result easier to trust.';
  } else if (result.isPB) {
    successTitle.textContent = 'New personal best!';
    successMessage.textContent = `You beat your previous best of ${formatTimeMs(
      result.previousBestMs
    )}. The new time is now your entry on the leaderboard.`;
  } else {
    successTitle.textContent = 'Time saved.';
    successMessage.textContent = `Your personal best remains ${formatTimeMs(
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
  layout.hidden = true;
  success.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showApiError(error) {
  if (error instanceof ApiError) {
    if (error.fields) {
      showFieldErrors(form, error.fields);
      const order = ['solver', 'time', 'solvedAt', 'videoUrl', 'note', 'witnesses'];
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

function bindEvents() {
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    showFormBanner(errorBanner, '');

    const witnesses = collectWitnesses();
    const payload = {
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
      showSuccess(result, payload, witnesses.length);
      showToast('Entry published.', 'success');
    } catch (error) {
      showApiError(error);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Publish entry';
    }
  });
}

async function init() {
  const today = localIsoDate();
  solvedAtInput.max = today;
  solvedAtInput.value = today;

  createWitnessRow();
  bindEvents();

  try {
    const data = await api('/api/people');
    peopleList.innerHTML = data.names
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join('');
  } catch {
    // Autocomplete is a convenience; the form still works without it.
  }
}

init();
