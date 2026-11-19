export class ApiError extends Error {
  constructor(message, status, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export async function api(path, options = {}) {
  const { method = 'GET', body } = options;

  const response = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Keep data as null when the server did not return JSON.
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed (${response.status}).`,
      response.status,
      data?.fields || null
    );
  }

  return data;
}
