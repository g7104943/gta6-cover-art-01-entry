// Vice Cover Studio — wires the editor: photo slots, layout/grade/size choices,
// per-panel crop sliders, live preview, PNG export, and the ?shot= scenes
// for screenshots (./shots.js).
import { drawCover, defaultPanelPhotos, panelAt } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const sizeLabel = document.getElementById('sizeLabel');

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

// Three photo slots; each holds {img} or null. Each panel crops its own photo.
const state = {
  layout: 'hero',
  grade: 'sunset',
  lettering: 'block',
  size: '1080x1080',
  title: 'VICE CITY',
  tagline: 'SUNSET HEIST · LEONIDA',
  photos: [null, null, null],
  panelPhotos: defaultPanelPhotos('hero'),
  panelCrops: [{ zoom: 1, panX: 0, panY: 0 }],
  activeSlot: 0,
  selectedPanel: 0,
};

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });
}

/** Sizes the preview canvas to the chosen post size, capped for the screen. */
function fitPreview() {
  const [w, h] = SIZES[state.size];
  const scale = Math.min(1, 640 / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  sizeLabel.textContent = `${w} × ${h}`;
}

function redraw() {
  fitPreview();
  drawCover(canvas, state);
  syncPanelControls();
}

/** The crop sliders always edit the selected panel's crop of its photo. */
function syncPanelControls() {
  const photoIndex = state.panelPhotos[state.selectedPanel] ?? 0;
  const crop = state.panelCrops[state.selectedPanel] || { zoom: 1, panX: 0, panY: 0 };
  document.getElementById('panelLabel').textContent =
    `Selected panel: ${state.selectedPanel + 1} · photo ${'ABC'[photoIndex]}`;
  document.getElementById('panelPhoto').value = String(photoIndex);
  const zoom = document.getElementById('zoom');
  const panX = document.getElementById('panX');
  const panY = document.getElementById('panY');
  zoom.value = crop.zoom;
  panX.value = crop.panX;
  panY.value = crop.panY;
  document.getElementById('zoomVal').textContent = `${Number(zoom.value).toFixed(2)}×`;
  document.getElementById('panXVal').textContent = Number(panX.value).toFixed(2);
  document.getElementById('panYVal').textContent = Number(panY.value).toFixed(2);
}

function markPressed(group, attr, value) {
  document.querySelectorAll(`#${group} [data-${attr}]`).forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
  });
}

function setLayout(layout) {
  state.layout = layout;
  state.panelPhotos = defaultPanelPhotos(layout);
  state.panelCrops = state.panelPhotos.map(() => ({ zoom: 1, panX: 0, panY: 0 }));
  state.selectedPanel = 0;
  markPressed('layouts', 'layout', layout);
  redraw();
}

function setGrade(grade) {
  state.grade = grade;
  markPressed('grades', 'grade', grade);
  redraw();
}

function setLettering(lettering) {
  state.lettering = lettering;
  markPressed('lettering', 'lettering', lettering);
  redraw();
}

function setSize(size) {
  state.size = size;
  markPressed('sizes', 'size', size);
  redraw();
}

function setActiveSlot(slot) {
  state.activeSlot = slot;
  document.querySelectorAll('#slots .slot').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.slot) === slot));
  });
}

async function putPhotoInSlot(slot, img) {
  state.photos[slot] = { img };
  redraw();
}

document.querySelectorAll('#slots .slot').forEach((b) => {
  b.addEventListener('click', () => setActiveSlot(Number(b.dataset.slot)));
});
document.getElementById('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await putPhotoInSlot(state.activeSlot, await loadImage(URL.createObjectURL(file)));
    status.textContent = `Loaded ${file.name} into photo ${'ABC'[state.activeSlot]}.`;
  } catch {
    status.textContent = 'That file could not be read as a photo.';
  }
});
document.getElementById('samplePier').addEventListener('click', async () => {
  await putPhotoInSlot(state.activeSlot, await loadImage('samples/pier.jpg'));
  status.textContent = `Sample pier photo loaded into photo ${'ABC'[state.activeSlot]}.`;
});
document.getElementById('sampleBlvd').addEventListener('click', async () => {
  await putPhotoInSlot(state.activeSlot, await loadImage('samples/boulevard.jpg'));
  status.textContent = `Sample boulevard photo loaded into photo ${'ABC'[state.activeSlot]}.`;
});

document.querySelectorAll('#layouts [data-layout]').forEach((b) => {
  b.addEventListener('click', () => setLayout(b.dataset.layout));
});
document.querySelectorAll('#grades [data-grade]').forEach((b) => {
  b.addEventListener('click', () => setGrade(b.dataset.grade));
});
document.querySelectorAll('#lettering [data-lettering]').forEach((b) => {
  b.addEventListener('click', () => setLettering(b.dataset.lettering));
});
document.querySelectorAll('#sizes [data-size]').forEach((b) => {
  b.addEventListener('click', () => setSize(b.dataset.size));
});

document.getElementById('panelPhoto').addEventListener('change', (e) => {
  state.panelPhotos[state.selectedPanel] = Number(e.target.value);
  redraw();
});

function bindCrop(id, label, apply) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    const crop = state.panelCrops[state.selectedPanel];
    if (!crop) return;
    apply(crop, Number(el.value));
    document.getElementById(label).textContent =
      id === 'zoom' ? `${Number(el.value).toFixed(2)}×` : Number(el.value).toFixed(2);
    drawCover(canvas, state);
  });
}
bindCrop('zoom', 'zoomVal', (photo, v) => { photo.zoom = v; });
bindCrop('panX', 'panXVal', (photo, v) => { photo.panX = v; });
bindCrop('panY', 'panYVal', (photo, v) => { photo.panY = v; });

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  drawCover(canvas, state);
});
document.getElementById('tagline').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  drawCover(canvas, state);
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const hit = panelAt(x, y, canvas.width, canvas.height, state.layout);
  if (hit >= 0) {
    state.selectedPanel = hit;
    syncPanelControls();
    drawCover(canvas, state);
  }
});

/** Exports the cover at the chosen post size as a PNG download. */
export function exportCover() {
  const [w, h] = SIZES[state.size];
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  drawCover(out, state);
  return new Promise((resolve) => {
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-cover-${w}x${h}.png`;
      a.click();
      status.textContent = `Saved vice-cover-${w}x${h}.png`;
      resolve(blob);
    }, 'image/png');
  });
}
document.getElementById('export').addEventListener('click', exportCover);

// Expose the painter for the screenshot scenes and for debugging.
window.__vice = { state, drawCover, exportCover, SIZES, loadImage };

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, { redraw, putPhotoInSlot, loadImage, canvas, setLayout, setGrade, setLettering, setSize });
} else {
  setLayout('hero');
  setGrade('sunset');
  setLettering('block');
  setSize('1080x1080');
  setActiveSlot(0);
  // Start with the two kit samples loaded, so the first paint already shows art.
  loadImage('samples/pier.jpg').then((img) => putPhotoInSlot(0, img)).catch(() => {});
  loadImage('samples/boulevard.jpg').then((img) => putPhotoInSlot(1, img)).catch(() => {});
  redraw();
}
