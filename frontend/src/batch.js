// batch.js — CSV batch conversion with CRS pickers, datum-op, summary, download, and map scatter.

import { transformBatch, getOperations } from './api.js';
import { plotBatch } from './map.js';
import { toast } from './ui.js';
import { createCrsPicker } from './crsPicker.js';

const fileInput      = document.getElementById('batch-file');
const batchIdCol     = document.getElementById('batch-id-col');
const batchXCol      = document.getElementById('batch-x-col');
const batchYCol      = document.getElementById('batch-y-col');
const btnBatch       = document.getElementById('btn-batch');
const batchResult    = document.getElementById('batch-result');
const batchSummary   = document.getElementById('batch-summary');
const btnDownload    = document.getElementById('btn-download');
const datumField     = document.getElementById('batch-datum-field');
const datumOp        = document.getElementById('batch-datum-op');
const datumDetail    = document.getElementById('batch-datum-detail');

const batchSrcInput  = document.getElementById('batch-src-picker');
const batchDstInput  = document.getElementById('batch-dst-picker');
const batchSrcResults = document.getElementById('batch-src-results');
const batchDstResults = document.getElementById('batch-dst-results');

let lastCsv = '';
let operations = [];

/** @type {ReturnType<typeof createCrsPicker>} */
let srcPicker;
/** @type {ReturnType<typeof createCrsPicker>} */
let dstPicker;

function srcCode() {
  const code = srcPicker.getCode();
  return code !== null ? String(code) : batchSrcInput.value.trim();
}

function dstCode() {
  const code = dstPicker.getCode();
  return code !== null ? String(code) : batchDstInput.value.trim();
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
  } catch {
    operations = [];
    datumField.hidden = true;
  }
}

function showDatumDetail() {
  const idx = parseInt(datumOp.value, 10);
  if (!operations[idx]) { datumDetail.textContent = ''; return; }
  const steps = operations[idx].steps
    .filter((s) => s.towgs84)
    .map((s) => `${s.name}: towgs84 = ${s.towgs84.join(', ')}`)
    .join('  |  ');
  datumDetail.textContent = steps || '';
}

async function runBatch() {
  const file = fileInput.files[0];
  if (!file) { toast('Choose a CSV file first', 'error'); return; }
  const source = srcCode();
  const target = dstCode();
  if (!source || !target) { toast('Select both source and target CRS', 'error'); return; }

  const opIndex = datumField.hidden ? null : parseInt(datumOp.value, 10);

  btnBatch.disabled = true;
  btnBatch.textContent = 'Transforming…';
  try {
    const res = await transformBatch(file, {
      source,
      target,
      operation_index: opIndex,
      id_col:  batchIdCol.value.trim(),
      x_col:   batchXCol.value.trim(),
      y_col:   batchYCol.value.trim(),
    });
    const s = res.summary;
    lastCsv = res.csv;
    batchSummary.textContent =
      `${s.total_rows} rows, ${s.transformed} transformed, ${s.errors} errors. ` +
      `Source ${s.source.name} → Target ${s.target.name}. ` +
      `Columns: ID=${s.columns.id}, X=${s.columns.x}, Y=${s.columns.y}.`;
    batchResult.hidden = false;
    plotBatch(res.results);
    const failed = res.results.filter((r) => r.status !== 'OK');
    if (failed.length) {
      toast(`${failed.length} row(s) failed — see download for details`, 'error');
    } else {
      toast('Batch conversion complete', 'success');
    }
  } catch (err) {
    toast(`Batch failed: ${err.message}`, 'error');
  } finally {
    btnBatch.disabled = false;
    btnBatch.textContent = 'Transform file';
  }
}

function downloadCsv() {
  const blob = new Blob([lastCsv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = fileInput.files[0]?.name.replace(/\.(csv|tsv|txt)$/i, '') || 'coordinates';
  a.download = `${name}_transformed.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function initDefaults() {
  srcPicker.setCode(24548);
  batchSrcInput.value = 'EPSG:24548 — Kertau 1968 / UTM zone 48N';
  dstPicker.setCode(32648);
  batchDstInput.value = 'EPSG:32648 — WGS 84 / UTM zone 48N';
}

export function setupBatch() {
  srcPicker = createCrsPicker(batchSrcInput, batchSrcResults, () => refreshOperations());
  dstPicker = createCrsPicker(batchDstInput, batchDstResults, () => refreshOperations());

  initDefaults();
  btnBatch.addEventListener('click', runBatch);
  btnDownload.addEventListener('click', downloadCsv);
  datumOp.addEventListener('change', showDatumDetail);
  refreshOperations();
}
