const AVATAR_COLORS = ['green', 'yellow', 'blue', 'orange', 'red', 'purple'];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

export function avatarColor(name) {
  let hash = 0;
  const value = String(name ?? '');
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function witnessTier(count) {
  const value = Number(count) || 0;
  if (value === 0) {
    return { label: 'No witnesses', className: 'witness-pill--none' };
  }
  if (value < 3) {
    return {
      label: `${value} witness${value === 1 ? '' : 'es'}`,
      className: 'witness-pill--low',
    };
  }
  return { label: `${value} witnesses`, className: 'witness-pill--good' };
}

export function witnessAvatars(names, limit = 3) {
  const list = Array.isArray(names) ? names : [];
  const shown = list.slice(0, limit);
  const extra = list.length - shown.length;

  const avatars = shown
    .map(
      (name) =>
        `<span class="avatar avatar--sm avatar--${avatarColor(name)}" title="${escapeHtml(
          name
        )}">${escapeHtml(initials(name))}</span>`
    )
    .join('');

  const more = extra > 0 ? `<span class="avatar avatar--sm avatar--more">+${extra}</span>` : '';
  return `<span class="avatar-stack" title="${escapeHtml(list.join(', '))}">${avatars}${more}</span>`;
}

export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function clearFieldErrors(form) {
  if (!form) return;
  form.querySelectorAll('[data-error-for]').forEach((element) => {
    element.textContent = '';
    element.hidden = true;
  });
}

export function showFieldErrors(form, fields = {}) {
  if (!form) return;
  for (const [name, message] of Object.entries(fields)) {
    const element = form.querySelector(`[data-error-for="${name}"]`);
    if (element) {
      element.textContent = message;
      element.hidden = false;
    }
  }
}

export function showFormBanner(element, message) {
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.hidden = true;
    return;
  }
  element.textContent = message;
  element.hidden = false;
}

export function showToast(message, type = 'success') {
  let region = document.querySelector('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  region.append(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 250);
  }, 4200);
}
