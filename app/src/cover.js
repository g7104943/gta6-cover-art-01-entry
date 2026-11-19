// Draws the cover: multi-panel poster art with a retro sun, a skyline, a
// halftone sky, a colour grade, grain, and a big outlined caption. Every
// measurement is a fraction of the canvas, so the same code renders the live
// preview and the exported PNG at any post size.

import { gradeOf } from './grades.js';

/** The post sizes the editor offers, as [width, height]. */
export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

/**
 * Panel layouts, each a list of rectangles as fractions [x, y, w, h] of the
 * canvas. Panel 0 is always the hero. A layout with fewer rectangles than
 * the state holds simply leaves the extra panels undrawn.
 */
export const LAYOUTS = {
  'hero-duo': [
    [0, 0, 1, 0.6],
    [0, 0.6, 0.5, 0.4],
    [0.5, 0.6, 0.5, 0.4],
  ],
  triptych: [
    [0, 0, 0.32, 1],
    [0.32, 0, 0.36, 1],
    [0.68, 0, 0.32, 1],
  ],
  'hero-strip': [
    [0, 0, 1, 0.66],
    [0, 0.66, 0.34, 0.34],
    [0.34, 0.66, 0.33, 0.34],
    [0.67, 0.66, 0.33, 0.34],
  ],
};

/** The layout names, in the order the editor offers them. */
export const LAYOUT_NAMES = Object.keys(LAYOUTS);

/** Panel rectangles for a layout, as absolute pixels for a W x H canvas. */
export function layoutRects(layout, w, h) {
  return (LAYOUTS[layout] ?? LAYOUTS['hero-duo']).map(([x, y, pw, ph]) => ({
    x: x * w,
    y: y * h,
    w: pw * w,
    h: ph * h,
  }));
}

/** Which panel (by index) holds the fractional point (fx, fy), or -1. */
export function panelAt(layout, w, h, fx, fy) {
  const rects = layoutRects(layout, w, h);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (fx >= r.x && fx < r.x + r.w && fy >= r.y && fy < r.y + r.h) return i;
  }
  return -1;
}

// ------------------------------------------------------------------ helpers

/** Where a photo lands inside a panel, cover-fit, zoomed and panned. */
function photoRect(img, rw, rh, zoom, panX, panY) {
  const scale = Math.max(rw / img.naturalWidth, rh / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const ox = dw > rw ? (panX * (dw - rw)) / 2 : 0;
  const oy = dh > rh ? (panY * (dh - rh)) / 2 : 0;
  return { x: (rw - dw) / 2 + ox, y: (rh - dh) / 2 + oy, w: dw, h: dh };
}

let noiseCanvas = null;
/** A small tile of random grey noise, made once and reused as grain. */
function grainTile() {
  if (noiseCanvas) return noiseCanvas;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 100 + Math.floor(Math.random() * 155);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noiseCanvas = tile;
  return tile;
}

// ------------------------------------------------------------------ scenery

/** A retro sun: a gradient disc with horizontal gaps cut out of its lower half. */
function drawSun(ctx, cx, cy, radius, grade) {
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.6);
  glow.addColorStop(0, grade.sunLow + '55');
  glow.addColorStop(1, grade.sunLow + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - radius * 1.6, cy - radius * 1.6, radius * 3.2, radius * 3.2);

  const disc = ctx.createLinearGradient(0, cy - radius, 0, cy + radius);
  disc.addColorStop(0, grade.sunTop);
  disc.addColorStop(1, grade.sunLow);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Cut the gaps: punch stripes out of the disc so the sky shows through.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  let gap = radius * 0.03;
  let y = cy + radius * 0.08;
  while (y < cy + radius) {
    ctx.fillRect(cx - radius, y, radius * 2, gap);
    y += gap + radius * 0.16;
    gap *= 1.6;
  }
  ctx.restore();
}

/** A dark city skyline along the bottom of a panel, with a few lit windows. */
function drawSkyline(ctx, x, y, w, h, grade) {
  const base = y + h;
  let cx = x;
  ctx.fillStyle = grade.frame;
  while (cx < x + w) {
    const bw = w * (0.05 + Math.random() * 0.07);
    const bh = h * (0.18 + Math.random() * 0.3);
    ctx.fillRect(cx, base - bh, bw, bh);
    // A lit window or two on some buildings.
    if (Math.random() < 0.5) {
      ctx.fillStyle = grade.accent;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(cx + bw * 0.3, base - bh * 0.6, Math.max(2, bw * 0.12), Math.max(2, bh * 0.1));
      ctx.globalAlpha = 1;
      ctx.fillStyle = grade.frame;
    }
    cx += bw + w * 0.012;
  }
}

/** Halftone dots fading down a band at the top of a panel. */
function drawHalftone(ctx, x, y, w, h, grade) {
  const step = Math.max(9, w * 0.022);
  ctx.fillStyle = grade.titleTop;
  for (let row = 0; row * step < h; row++) {
    for (let col = 0; col * step < w; col++) {
      const fade = 1 - (row * step) / h;
      const r = step * 0.32 * fade;
      if (r < 0.6) continue;
      ctx.globalAlpha = 0.16 + 0.3 * fade;
      ctx.beginPath();
      ctx.arc(x + col * step + step / 2, y + row * step + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ panels

/** A panel with no photo: sky, sun, skyline and halftone — pure drawn art. */
function drawArtPanel(ctx, rect, grade, hero) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, grade.skyMid);
  sky.addColorStop(1, grade.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  drawHalftone(ctx, x, y, w, h * 0.3, grade);
  drawSun(ctx, x + w * (hero ? 0.68 : 0.5), y + h * (hero ? 0.34 : 0.42), Math.min(w, h) * (hero ? 0.26 : 0.3), grade);
  drawSkyline(ctx, x, y + h * 0.72, w, h * 0.28, grade);
}

/** One panel: photo (graded) or drawn art, then a thin inner edge. */
function drawPanel(ctx, rect, img, panel, grade, hero) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const r = photoRect(img, w, h, panel.zoom, panel.panX, panel.panY);
    ctx.drawImage(img, x + r.x, y + r.y, r.w, r.h);
    ctx.globalCompositeOperation = grade.tintMode;
    ctx.fillStyle = grade.tint;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    // A warm wash from the bottom so the caption stays readable.
    const wash = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
    wash.addColorStop(0, 'rgba(20, 5, 30, 0)');
    wash.addColorStop(1, 'rgba(20, 5, 30, 0.45)');
    ctx.fillStyle = wash;
    ctx.fillRect(x, y, w, h);
  } else {
    drawArtPanel(ctx, rect, grade, hero);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.strokeRect(x, y, w, h);
}

// ------------------------------------------------------------------ caption

/** The big outlined title and its subtitle, over a soft scrim. */
function drawCaption(ctx, w, h, state, grade) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const sizeMul = state.titleSize ?? 1;
  const atTop = state.titlePos === 'top';

  let size = w * 0.088 * sizeMul;
  ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  try {
    ctx.letterSpacing = `${Math.round(size * 0.02)}px`;
  } catch {
    /* letterSpacing is Chrome-only; the caption works without it. */
  }
  while (title && ctx.measureText(title).width > w * 0.92 && size > 14) {
    size -= 2;
    ctx.font = `900 ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  }

  const bandH = size * (title ? 1.5 : 0.6) + (subtitle ? size * 0.42 : 0);
  const bandY = atTop ? 0 : h - bandH;
  const scrim = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (atTop) {
    scrim.addColorStop(0, 'rgba(10, 3, 18, 0.72)');
    scrim.addColorStop(1, 'rgba(10, 3, 18, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(10, 3, 18, 0)');
    scrim.addColorStop(1, 'rgba(10, 3, 18, 0.72)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY, w, bandH);

  // The title's centre sits a little inside the canvas edge so the whole line
  // — and the subtitle under it — stays on the cover.
  const subDrop = subtitle ? size * 0.42 : 0;
  const titleY = atTop ? size * 0.62 : h - size * 0.62 - subDrop;
  ctx.save();
  ctx.translate(w / 2, titleY);
  ctx.rotate(-0.018);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (title) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = grade.outline;
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.strokeText(title, 0, 0);
    const fill = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6);
    fill.addColorStop(0, grade.titleTop);
    fill.addColorStop(1, grade.titleLow);
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.04;
    ctx.fillText(title, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  if (subtitle) {
    const subSize = Math.max(12, size * 0.21);
    ctx.font = `700 ${subSize}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`;
    } catch {
      /* See above. */
    }
    ctx.fillStyle = grade.accent;
    const subY = title ? size * 0.72 : 0;
    ctx.fillText(subtitle, 0, subY);
  }
  ctx.restore();
  try {
    ctx.letterSpacing = '0px';
  } catch {
    /* See above. */
  }
}

// ------------------------------------------------------------------ render

/**
 * Renders the whole cover onto `canvas` (resized to the chosen post size).
 * `state` holds size, layout, grade, title, subtitle, titlePos, titleSize,
 * photos (up to three images, or null) and panels (one transform per panel).
 */
export function renderCover(canvas, state) {
  const [w, h] = SIZES[state.size] ?? SIZES['1080x1080'];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grade = gradeOf(state.grade);

  ctx.fillStyle = grade.frame;
  ctx.fillRect(0, 0, w, h);

  const rects = layoutRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: -1, zoom: 1, panX: 0, panY: 0 };
    const img = panel.photo >= 0 ? state.photos[panel.photo] ?? null : null;
    drawPanel(ctx, rect, img, panel, grade, i === 0);
  });

  // Poster gutters: a thick frame and a thin accent line inside it.
  const frameW = Math.max(6, w * 0.012);
  ctx.strokeStyle = grade.frame;
  ctx.lineWidth = frameW;
  ctx.strokeRect(frameW / 2, frameW / 2, w - frameW, h - frameW);
  ctx.strokeStyle = grade.accent;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(1.5, w * 0.002);
  ctx.strokeRect(frameW * 1.6, frameW * 1.6, w - frameW * 3.2, h - frameW * 3.2);
  ctx.globalAlpha = 1;

  // Grain over everything, then a soft vignette.
  const tile = grainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  drawCaption(ctx, w, h, state, grade);
}
