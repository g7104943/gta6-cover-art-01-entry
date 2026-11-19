// Fixed scenes for screenshots, driven by the ?shot= query:
//   ?shot=cover           the exported cover alone, 1920x1080 layout at 1280x720
//   ?shot=cover-portrait  the exported cover alone, 1080x1350 layout at 1024x1280
//   ?shot=editor          the editor with a sample photo loaded
// window.__shotReady is set once the scene has painted. The cover scenes draw
// with the app's own painter at the screenshot size, exactly as an export does.
import { drawCover } from './cover.js';

function ready() {
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/**
 * Sets up a screenshot scene. `state` is the editor state, `api` the helpers
 * main.js exposes (redraw, putPhotoInSlot, loadImage, canvas, setLayout,
 * setGrade, setLettering, setSize).
 */
export async function runShot(shot, query, state, api) {
  const caption = query.get('caption') ?? 'VICE CITY';
  const tagline = query.get('tagline') ?? 'SUNSET HEIST · LEONIDA';
  const photoName = query.get('photo') ?? 'pier';
  const layout = query.get('layout') ?? 'hero';
  const grade = query.get('grade') ?? 'sunset';
  const lettering = query.get('lettering') ?? 'block';

  state.title = caption;
  state.tagline = tagline;
  document.getElementById('title').value = caption;
  document.getElementById('tagline').value = tagline;

  if (shot === 'cover' || shot === 'cover-portrait') {
    document.body.classList.add('shot-cover');
    api.setLayout(layout);
    api.setGrade(grade);
    api.setLettering(lettering);
    const wide = shot === 'cover';
    api.canvas.width = wide ? 1280 : 1024;
    api.canvas.height = wide ? 720 : 1280;
    const first = await api.loadImage(`samples/${photoName}.jpg`);
    const second = await api.loadImage(`samples/${photoName === 'pier' ? 'boulevard' : 'pier'}.jpg`).catch(() => null);
    // The portrait cover's wide top panel crops a portrait photo hard; pan it
    // down so the subject's face stays in frame. Crops are per panel, so the
    // same photo in the small bottom panel keeps its own framing.
    const topPan = shot === 'cover-portrait' ? 0.30 : 0;
    state.photos[0] = { img: first };
    if (second) state.photos[1] = { img: second };
    state.panelCrops[0] = { zoom: 1.08, panX: 0, panY: topPan };
    if (state.panelCrops[1]) state.panelCrops[1] = { zoom: 1.05, panX: 0, panY: -0.04 };
    drawCover(api.canvas, state);
    ready();
    return;
  }

  if (shot === 'editor') {
    api.setLayout(layout);
    api.setGrade(grade);
    api.setLettering(lettering);
    api.setSize(query.get('size') ?? '1080x1080');
    const first = await api.loadImage(`samples/${photoName}.jpg`);
    const second = await api.loadImage(`samples/${photoName === 'pier' ? 'boulevard' : 'pier'}.jpg`).catch(() => null);
    state.photos[0] = { img: first };
    if (second) state.photos[1] = { img: second };
    state.panelCrops[0] = { zoom: 1.05, panX: 0, panY: 0 };
    if (state.panelCrops[1]) state.panelCrops[1] = { zoom: 1, panX: 0, panY: 0 };
    api.redraw();
    ready();
    return;
  }

  ready();
}
