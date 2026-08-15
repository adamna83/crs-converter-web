// batch.js — CSV batch conversion with summary, download, and map scatter.

import { transformBatch } from './api.js';
import { plotBatch } from './map.js';
import { toast } from './ui.js';

const fileInput = document.getElementById('batch-file');
const batchSrc = document.getElementById('batch-src');
const batchDst = document.getElementById('batch-dst');
const batchIdCol = document.getElementById('batch-id-col');
const batchXCol = document.getElementById('batch-x-col');
const batchYCol = document.getElementById('batch-y-col');
const btnBatch = document.getElementById('btn-batch');
const batchResult = document.getElementById('batch-result');
const batchSummary = document.getElementById('batch-summary');
const btnDownload = document.getElementById('btn-download');

let lastCsv = '';

async function runBatch() {
  const file = fileInput.files[0];
  if (!file) {
    toast('Choose a CSV file first', 'error');
    return;
  }
  const source = batchSrc.value.trim();
  const target = batchDst.value.trim();
  if (!source || !target) {
    toast('Enter both source and target CRS', 'error');
    return;
  }

  btnBatch.disabled = true;
  btnBatch.textContent = 'Transforming…';
  try {
    const res = await transformBatch(file, {
      source,
      target,
      id_col: batchIdCol.value.trim(),
      x_col: batchXCol.value.trim(),
      y_col: batchYCol.value.trim(),
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

export function setupBatch() {
  btnBatch.addEventListener('click', runBatch);
  btnDownload.addEventListener('click', downloadCsv);
}
