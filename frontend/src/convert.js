// convert.js — single-point conversion form with datum-transformation picker.

import { transformPoint, getOperations } from './api.js';
import { plotSingle } from './map.js';
import { toast } from './ui.js';
import { createCrsPicker } from './crsPicker.js';

const srcInput = document.getElementById('src-picker');
const dstInput = document.getElementById('dst-picker');
const srcResults = document.getElementById('src-results');
const dstResults = document.getElementById('dst-results');
const datumField = document.getElementById('datum-field');
const datumOp = document.getElementById('datum-op');
const datumDetail = document.getElementById('datum-detail');
const inX = document.getElementById('in-x');
const inY = document.getElementById('in-y');
const btnConvert = document.getElementById('btn-convert');
const resultBox = document.getElementById('result');
const resultCoords = document.getElementById('result-coords');
const resultOp = document.getElementById('result-op');

/** @type {Array} */
let operations = [];

/** @type {ReturnType<typeof createCrsPicker>} */
let srcPicker;
/** @type {ReturnType<typeof createCrsPicker>} */
let dstPicker;

function srcCode() {
  const code = srcPicker.getCode();
  return code !== null ? String(code) : srcInput.value.trim();
}

function dstCode() {
  const code = dstPicker.getCode();
  return code !== null ? String(code) : dstInput.value.trim();
}

async function refreshOperations() {
  const s = srcCode();
  const d = dstCode();
  if (!s || !d) return;
  try {
    const { operations: ops } = await getOperations(s, d);
    operations = ops;
    if (ops.length <= 1) {
      datumField.hidden = true;
      datumOp.innerHTML = '';
      datumDetail.textContent = '';
      return;
    }
    datumOp.innerHTML = '';
    ops.forEach((op, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = op.description;
      datumOp.appendChild(opt);
    });
    datumField.hidden = false;
    showDatumDetail();
  } catch (err) {
    operations = [];
    datumField.hidden = true;
  }
}

function showDatumDetail() {
  const idx = parseInt(datumOp.value, 10);
  if (!operations[idx]) {
    datumDetail.textContent = '';
    return;
  }
  const steps = operations[idx].steps
    .filter((s) => s.towgs84)
    .map((s) => `${s.name}: towgs84 = ${s.towgs84.join(', ')}`)
    .join('  |  ');
  datumDetail.textContent = steps || '';
}

async function convert() {
  const source = srcCode();
  const target = dstCode();
  const x = parseFloat(inX.value);
  const y = parseFloat(inY.value);

  if (!source || !target) {
    toast('Select both source and target CRS', 'error');
    return;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    toast('Enter numeric X and Y coordinates', 'error');
    return;
  }

  const opIndex = datumField.hidden ? null : parseInt(datumOp.value, 10);

  btnConvert.disabled = true;
  btnConvert.textContent = 'Converting…';
  try {
    const res = await transformPoint(source, target, x, y, opIndex);
    const r = res.result;
    resultCoords.textContent = `${fmt(r.x)} , ${fmt(r.y)}`;
    resultOp.textContent = res.chosen_operation;
    resultBox.hidden = false;
    plotSingle(res.source_wgs84, res.target_wgs84);
  } catch (err) {
    toast(`Conversion failed: ${err.message}`, 'error');
  } finally {
    btnConvert.disabled = false;
    btnConvert.textContent = 'Convert';
  }
}

function fmt(v) {
  if (!Number.isFinite(v)) return String(v);
  const rounded = Math.abs(v) >= 1000 ? v.toFixed(3) : v.toPrecision(10);
  return Number(rounded).toLocaleString('en-US');
}

function initDefaults() {
  srcPicker.setCode(24548);
  srcInput.value = 'EPSG:24548 — Kertau 1968 / UTM zone 48N';
  dstPicker.setCode(32648);
  dstInput.value = 'EPSG:32648 — WGS 84 / UTM zone 48N';
}

export function setupSingle() {
  srcPicker = createCrsPicker(srcInput, srcResults, () => refreshOperations());
  dstPicker = createCrsPicker(dstInput, dstResults, () => refreshOperations());

  initDefaults();
  btnConvert.addEventListener('click', convert);
  datumOp.addEventListener('change', showDatumDetail);
  refreshOperations();
}
