// api.js — thin fetch wrapper for the backend REST endpoints.

/** @param {string} url */
async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && body.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Search EPSG CRS by code or name. @returns {Promise<Array>} */
export function searchCrs(q) {
  return request(`/api/crs/search?q=${encodeURIComponent(q)}`);
}

/** Fetch CRS detail. @returns {Promise<object>} */
export function getCrs(code) {
  return request(`/api/crs/${code}`);
}

/** List datum transformations available between two CRS. @returns {Promise<object>} */
export function getOperations(source, target) {
  const params = new URLSearchParams({ source, target });
  return request(`/api/operations?${params}`);
}

/** Transform a single point. @returns {Promise<object>} */
export function transformPoint(source, target, x, y, operationIndex) {
  const params = new URLSearchParams({ source, target, x: String(x), y: String(y) });
  if (operationIndex !== null && operationIndex !== undefined) {
    params.set('operation_index', String(operationIndex));
  }
  return request(`/api/transform?${params}`, { method: 'POST' });
}

/** Transform a batch CSV file. @returns {Promise<object>} */
export function transformBatch(file, form) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('source', form.source);
  fd.append('target', form.target);
  if (form.id_col) fd.append('id_col', form.id_col);
  if (form.x_col) fd.append('x_col', form.x_col);
  if (form.y_col) fd.append('y_col', form.y_col);
  if (form.delimiter) fd.append('delimiter', form.delimiter);
  return request('/api/transform/batch', { method: 'POST', body: fd });
}
