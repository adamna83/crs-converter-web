// main.js — entry point: init map, wire tabs, single-point + batch views.

import './style.css';
import { initMap } from './map.js';
import { setupSingle } from './convert.js';
import { setupBatch } from './batch.js';
import { setStatus, toast } from './ui.js';

const tabSingle = document.getElementById('tab-single');
const tabBatch = document.getElementById('tab-batch');
const viewSingle = document.getElementById('view-single');
const viewBatch = document.getElementById('view-batch');

function checkBackend() {
  fetch('/api/health')
    .then((r) => r.ok)
    .then((ok) => {
      setStatus(ok);
      if (!ok) toast('Backend is offline — start uvicorn on port 8000', 'error');
    })
    .catch(() => {
      setStatus(false);
      toast('Backend is offline — start uvicorn on port 8000', 'error');
    });
}

function switchTab(which) {
  const isSingle = which === 'single';
  tabSingle.classList.toggle('active', isSingle);
  tabBatch.classList.toggle('active', !isSingle);
  viewSingle.classList.toggle('active', isSingle);
  viewBatch.classList.toggle('active', !isSingle);
}

function init() {
  setStatus(false);
  initMap();
  setupSingle();
  setupBatch();

  tabSingle.addEventListener('click', () => switchTab('single'));
  tabBatch.addEventListener('click', () => switchTab('batch'));

  checkBackend();
  setInterval(checkBackend, 10000);
}

init();
