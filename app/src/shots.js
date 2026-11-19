// Fixed scenes for screenshots, driven by ?shot= in the URL.
//   ?shot=cover&photo=pier&caption=Sunset%20Heist&size=1920x1080
//       the cover alone, fitted to the viewport — the exported art itself.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//       the editor with a sample photo loaded and the caption edited.
//   ?shot=exportcheck&size=1080x1350
//       renders and exports a PNG in the page, then reports the PNG's
//       signature and size into #shotReport, so the export can be verified
//       without a download.
// Every scene sets window.__shotReady once it has painted.

import { SIZES } from './cover.js';

const SAMPLE_NAMES = ['pier', 'boulevard'];

/** Applies the scene's query values (size, layout, grade, captions) to state. */
function applyQuery(query, state) {
  if (SIZES[query.get('size')]) state.size = query.get('size');
  if (['hero-duo', 'triptych', 'hero-strip'].includes(query.get('layout'))) state.layout = query.get('layout');
  if (['sunset', 'neon', 'gold', 'midnight'].includes(query.get('grade'))) state.grade = query.get('grade');
  if (query.get('caption') !== null) {
    state.title = query.get('caption');
    document.getElementById('titleInput').value = state.title;
  }
  if (query.get('subtitle') !== null) {
    state.subtitle = query.get('subtitle');
    document.getElementById('subtitleInput').value = state.subtitle;
  }
  if (query.get('titlePos') === 'top' || query.get('titlePos') === 'bottom') {
    state.titlePos = query.get('titlePos');
    document.getElementById('titlePos').value = state.titlePos;
  }
  const sizeRadio = document.querySelector(`input[name="size"][value="${state.size}"]`);
  if (sizeRadio) sizeRadio.checked = true;
  const layoutRadio = document.querySelector(`input[name="layout"][value="${state.layout}"]`);
  if (layoutRadio) layoutRadio.checked = true;
  const gradeRadio = document.querySelector(`input[name="grade"][value="${state.grade}"]`);
  if (gradeRadio) gradeRadio.checked = true;
}

/** Fits the preview canvas into the viewport, keeping its aspect ratio. */
function fitCoverToViewport(canvas) {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}

function markReady() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

export async function runShot(shot, query, state, app) {
  applyQuery(query, state);
  const photo = SAMPLE_NAMES.includes(query.get('photo')) ? query.get('photo') : 'pier';
  const other = photo === 'pier' ? 'boulevard' : 'pier';
  try {
    app.setPhoto(0, await app.loadImage(`samples/${photo}.jpg`));
    app.setPhoto(1, await app.loadImage(`samples/${other}.jpg`));
  } catch (err) {
    document.getElementById('shotReport').textContent = `Sample did not load: ${err.message}`;
  }
  app.redraw();

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    fitCoverToViewport(document.getElementById('preview'));
    markReady();
    return;
  }
  if (shot === 'editor') {
    document.body.classList.add('shot-editor');
    markReady();
    return;
  }
  if (shot === 'exportcheck') {
    document.body.classList.add('shot-cover');
    const off = document.createElement('canvas');
    const { renderCover } = await import('./cover.js');
    renderCover(off, state);
    const report = document.getElementById('shotReport');
    off.toBlob(async (blob) => {
      if (!blob) {
        report.textContent = 'EXPORT FAIL: no blob';
        markReady();
        return;
      }
      const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
      const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const ok = pngMagic.every((b, i) => head[i] === b);
      const [w, h] = SIZES[state.size];
      report.textContent = ok
        ? `EXPORT OK: PNG ${w}x${h}, ${blob.size} bytes`
        : 'EXPORT FAIL: not a PNG';
      document.title = report.textContent;
      fitCoverToViewport(document.getElementById('preview'));
      markReady();
    }, 'image/png');
    return;
  }
  markReady();
}
