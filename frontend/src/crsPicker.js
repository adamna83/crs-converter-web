// crsPicker.js — searchable CRS autocomplete for source/target selection.

import { searchCrs } from './api.js';

/**
 * Build a searchable CRS picker around an input + results list.
 *
 * @param {HTMLInputElement} input
 * @param {HTMLUListElement} resultsEl
 * @param {(crs: {code: number, name: string}) => void} onSelect
 */
export function createCrsPicker(input, resultsEl, onSelect) {
  let items = [];
  let selectedIndex = -1;
  let debounceTimer = null;
  let active = false;

  function render(filter) {
    resultsEl.innerHTML = '';
    const visible = items.filter((it) => it.visible);
    if (visible.length === 0) {
      resultsEl.hidden = true;
      return;
    }
    visible.forEach((it) => {
      const li = document.createElement('li');
      const code = document.createElement('span');
      code.className = 'code';
      code.textContent = `EPSG:${it.code}`;
      const name = document.createElement('span');
      name.textContent = it.name;
      li.appendChild(name);
      li.appendChild(code);
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choose(it);
      });
      resultsEl.appendChild(li);
    });
    resultsEl.hidden = false;
  }

  function setItems(list) {
    items = list.map((c) => ({ ...c, visible: true }));
    selectedIndex = -1;
    render();
  }

  function choose(item) {
    input.value = `EPSG:${item.code} — ${item.name}`;
    input.dataset.code = String(item.code);
    resultsEl.hidden = true;
    active = false;
    onSelect(item);
  }

  async function refresh() {
    const q = input.value.trim();
    if (!q) {
      setItems([]);
      return;
    }
    try {
      const { results } = await searchCrs(q);
      setItems(results || []);
    } catch (err) {
      resultsEl.hidden = true;
    }
  }

  input.addEventListener('input', () => {
    active = true;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, 180);
  });

  input.addEventListener('focus', () => {
    if (items.length) render();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      resultsEl.hidden = true;
    }, 120);
  });

  input.addEventListener('keydown', (e) => {
    const visible = items.filter((it) => it.visible);
    if (!visible.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, visible.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && visible[selectedIndex]) {
        e.preventDefault();
        choose(visible[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      resultsEl.hidden = true;
      active = false;
    }
  });

  return {
    /** @returns {number|null} the selected EPSG code, or null */
    getCode: () => {
      const raw = input.value.trim();
      const m = raw.match(/EPSG:(\d+)/i);
      if (m) return parseInt(m[1], 10);
      if (/^\d+$/.test(raw)) return parseInt(raw, 10);
      return null;
    },
    /** @param {number} code */
    setCode: (code) => {
      input.value = `EPSG:${code}`;
      input.dataset.code = String(code);
      items = [];
      resultsEl.hidden = true;
    },
    /** Manually trigger a search (e.g. after programmatic set). */
    refresh,
  };
}
