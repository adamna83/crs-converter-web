// ui.js — small toast + status helpers.

const toastEl = document.getElementById('toast');
const statusEl = document.getElementById('header-status');

let toastTimer = null;

export function toast(message, kind = 'info') {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = kind;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 4000);
}

export function setStatus(online) {
  if (!statusEl) return;
  statusEl.textContent = online ? 'backend online' : 'backend offline';
  statusEl.className = online ? 'status-online' : 'status-offline';
}
