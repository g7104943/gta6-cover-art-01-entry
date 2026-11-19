// Wires the studio: photos in, live preview out, PNG export, panel picking,
// and the ?shot= scenes the screenshots are taken from. Everything the page
// needs lives in this module and cover.js / grades.js / shots.js.

import { renderCover, panelAt, LAYOUTS, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const status = document.getElementById('status');
const panelLabel = document.getElementById('panelLabel');

/** A fresh cover: samples in slots 1 and 2, hero on photo 1. */
function freshState() {
  return {
    size: '1080x1080',
    layout: 'hero-duo',
    grade: 'sunset',
    title: 'Sunset Heist',
    subtitle: 'VICE CITY \u2022 EST. 2026',
    titlePos: 'bottom',
    titleSize: 1,
    photos: [null, null, null],
    panels: [
      // panY favours the top of a photo, where faces usually are: a wide
      // panel cover-fitting a portrait photo would otherwise cut them off.
      { photo: 0, zoom: 1, panX: 0, panY: 0.6 },
      { photo: 1, zoom: 1, panX: 0, panY: 0.6 },
      { photo: 0, zoom: 1.35, panX: 0, panY: 0.5 },
      { photo: 1, zoom: 1.2, panX: 0, panY: 0.6 },
    ],
    selected: 0,
  };
}

const state = freshState();

/** Redraws the preview canvas from the current state. */
export function redraw() {
  renderCover(canvas, state);
  const rects = LAYOUTS[state.layout] ?? LAYOUTS['hero-duo'];
  const names = ['hero', 'second', 'third', 'fourth'];
  panelLabel.textContent = `Panel ${state.selected + 1} — ${names[state.selected] ?? ''} (${state.selected + 1} of ${rects.length}). Click any panel in the preview to select it.`;
  syncPanelControls();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Puts an image into a photo slot and redraws. */
export function setPhoto(slot, img) {
  state.photos[slot] = img;
  redraw();
}

/** Loads a sample photo into a slot (the samples ship with the app). */
async function loadSample(slot, name) {
  try {
    setPhoto(slot, await loadImage(`samples/${name}.jpg`));
  } catch (err) {
    status.textContent = `Sample ${name} did not load: ${err.message}`;
  }
}

// ------------------------------------------------------------------ controls

function bindRadio(name, apply) {
  for (const input of document.querySelectorAll(`input[name="${name}"]`)) {
    input.addEventListener('change', () => {
      if (input.checked) {
        apply(input.value);
        redraw();
      }
    });
  }
}

bindRadio('layout', (v) => { state.layout = v; state.selected = 0; });
bindRadio('size', (v) => { state.size = v; });
bindRadio('grade', (v) => { state.grade = v; });

document.getElementById('titleInput').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitleInput').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('titlePos').addEventListener('change', (e) => {
  state.titlePos = e.target.value;
  redraw();
});
document.getElementById('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value);
  redraw();
});

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = [...(e.target.files ?? [])].slice(0, 3);
  for (let i = 0; i < files.length; i++) {
    try {
      setPhoto(i, await loadImage(URL.createObjectURL(files[i])));
    } catch {
      status.textContent = `Could not read ${files[i].name}.`;
    }
  }
  status.textContent = files.length ? `Loaded ${files.length} photo${files.length > 1 ? 's' : ''}.` : '';
});
document.getElementById('samplePier').addEventListener('click', () => loadSample(0, 'pier'));
document.getElementById('sampleBoulevard').addEventListener('click', () => loadSample(1, 'boulevard'));

// Panel picking: click the preview, select that panel, and mirror its
// transform into the sliders below.
canvas.addEventListener('click', (e) => {
  const box = canvas.getBoundingClientRect();
  const fx = ((e.clientX - box.left) / box.width) * canvas.width;
  const fy = ((e.clientY - box.top) / box.height) * canvas.height;
  const hit = panelAt(state.layout, canvas.width, canvas.height, fx, fy);
  if (hit >= 0) {
    state.selected = hit;
    redraw();
  }
});

function panelButton(slot, label) {
  document.getElementById(`panelPhoto${slot}`).addEventListener('click', () => {
    state.panels[state.selected].photo = slot;
    redraw();
  });
}
panelButton(0, 'Photo 1');
panelButton(1, 'Photo 2');
panelButton(2, 'Photo 3');
document.getElementById('panelPhotoArt').addEventListener('click', () => {
  state.panels[state.selected].photo = -1;
  redraw();
});

const zoomRange = document.getElementById('zoomRange');
const panXRange = document.getElementById('panXRange');
const panYRange = document.getElementById('panYRange');

function syncPanelControls() {
  const panel = state.panels[state.selected];
  zoomRange.value = String(panel.zoom);
  panXRange.value = String(panel.panX);
  panYRange.value = String(panel.panY);
  for (let slot = 0; slot < 3; slot++) {
    document.getElementById(`panelPhoto${slot}`).classList.toggle('active', panel.photo === slot);
  }
  document.getElementById('panelPhotoArt').classList.toggle('active', panel.photo === -1);
}

zoomRange.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomRange.value);
  redraw();
});
panXRange.addEventListener('input', () => {
  state.panels[state.selected].panX = Number(panXRange.value);
  redraw();
});
panYRange.addEventListener('input', () => {
  state.panels[state.selected].panY = Number(panYRange.value);
  redraw();
});

// ------------------------------------------------------------------ export

/** Renders the cover at the chosen post size and downloads it as a PNG. */
export function exportPng() {
  const [w, h] = SIZES[state.size] ?? SIZES['1080x1080'];
  const off = document.createElement('canvas');
  renderCover(off, state);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) {
        status.textContent = 'Export failed: the browser could not make a PNG.';
        resolve(null);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-cover-${w}x${h}.png`;
      a.click();
      status.textContent = `Saved vice-city-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KiB).`;
      resolve(blob);
    }, 'image/png');
  });
}
document.getElementById('exportBtn').addEventListener('click', exportPng);

// ------------------------------------------------------------------ start

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, state, { loadImage, setPhoto, redraw });
} else {
  // Samples in from the start, so the first thing you see is a finished cover.
  loadSample(0, 'pier');
  loadSample(1, 'boulevard');
  redraw();
}
