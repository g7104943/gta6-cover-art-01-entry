// Vice Cover Studio — the cover painter. One canvas, four layouts, four colour
// grades, three lettering styles. Everything is drawn with the 2D canvas API:
// no WebGL, no network, no fonts shipped — only system fonts.

/** Panel polygons as fractions of the canvas, one polygon per panel. */
export function layoutPanels(layout) {
  if (layout === 'triptych') {
    return [
      [[0, 0], [0.36, 0], [0.30, 1], [0, 1]],
      [[0.36, 0], [0.68, 0], [0.62, 1], [0.30, 1]],
      [[0.68, 0], [1, 0], [1, 1], [0.62, 1]],
    ];
  }
  if (layout === 'duo') {
    return [
      [[0, 0], [1, 0], [1, 0.30], [0, 0.72]],
      [[0, 0.72], [1, 0.30], [1, 1], [0, 1]],
    ];
  }
  if (layout === 'stack') {
    return [
      [[0, 0], [1, 0], [1, 0.60], [0, 0.60]],
      [[0, 0.60], [0.52, 0.60], [0.52, 1], [0, 1]],
      [[0.52, 0.60], [1, 0.60], [1, 1], [0.52, 1]],
    ];
  }
  return [[[0, 0], [1, 0], [1, 1], [0, 1]]]; // hero: one full-bleed panel
}

/** Which photos each layout shows by default (indexes into state.photos). */
export function defaultPanelPhotos(layout) {
  if (layout === 'triptych') return [0, 1, 0];
  if (layout === 'duo') return [0, 1];
  if (layout === 'stack') return [0, 1, 0];
  return [0];
}

/** Ray-casting hit test: index of the panel holding point (x, y), or -1. */
export function panelAt(x, y, w, h, layout) {
  const polys = layoutPanels(layout).map((poly) => poly.map(([fx, fy]) => [fx * w, fy * h]));
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [ax, ay] = poly[a];
      const [bx, by] = poly[b];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

function tracePoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Cover-fits one photo into a panel polygon, with the panel's own crop. */
function paintPhoto(ctx, poly, photo, crop, w, h) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pw = x1 - x0, ph = y1 - y0;
  ctx.save();
  tracePoly(ctx, poly);
  ctx.clip();
  if (!photo || !photo.img) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#3a1650');
    g.addColorStop(1, '#160a24');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, pw, ph);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let d = -ph; d < pw; d += 34) {
      ctx.beginPath();
      ctx.moveTo(x0 + d, y0);
      ctx.lineTo(x0 + d + ph, y1);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.max(14, pw * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ADD A PHOTO', x0 + pw / 2, y0 + ph / 2);
    ctx.restore();
    return;
  }
  const img = photo.img;
  const zoom = (crop && crop.zoom) || 1;
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const cx = x0 + pw / 2 + ((crop && crop.panX) || 0) * pw;
  const cy = y0 + ph / 2 + ((crop && crop.panY) || 0) * ph;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

/** The colour grade wash over the whole cover, drawn after the photos. */
function paintGrade(ctx, w, h, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (grade === 'neon') {
    sky.addColorStop(0, 'rgba(255, 0, 180, 0.16)');
    sky.addColorStop(0.55, 'rgba(120, 0, 255, 0.10)');
    sky.addColorStop(1, 'rgba(0, 230, 255, 0.22)');
  } else if (grade === 'palm') {
    sky.addColorStop(0, 'rgba(0, 140, 140, 0.20)');
    sky.addColorStop(0.6, 'rgba(0, 60, 90, 0.08)');
    sky.addColorStop(1, 'rgba(255, 176, 46, 0.30)');
  } else if (grade === 'noir') {
    sky.addColorStop(0, 'rgba(8, 8, 18, 0.30)');
    sky.addColorStop(1, 'rgba(8, 8, 18, 0.42)');
  } else {
    sky.addColorStop(0, 'rgba(255, 176, 46, 0.12)');
    sky.addColorStop(0.55, 'rgba(255, 94, 0, 0.10)');
    sky.addColorStop(1, 'rgba(255, 0, 120, 0.36)');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
}

/** A low sun disc glowing over the top of the cover (sunset and palm grades).
 * Only on single-photo layouts, where it reads as a sun in the sky — on the
 * slanted multi-panel layouts it lands on a face and reads as a blob. */
function paintSun(ctx, w, h, grade, layout) {
  if (grade !== 'sunset' && grade !== 'palm') return;
  if (layout !== 'hero' && layout !== 'stack') return;
  const cx = w * 0.76, cy = h * 0.17, r = Math.min(w, h) * 0.085;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
  glow.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
  ctx.fillStyle = grade === 'palm' ? '#ffd97a' : '#ffe9a8';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Faint retro scanlines plus a dark vignette around the edges. */
function paintFinish(ctx, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let y = 0; y < h; y += 5) ctx.fillRect(0, y, w, 1);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

/** The title + tagline block across the foot of the cover. */
function paintLettering(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  const tagline = (state.tagline || '').trim().toUpperCase();
  const scrim = ctx.createLinearGradient(0, h * 0.58, 0, h);
  scrim.addColorStop(0, 'rgba(10, 4, 18, 0)');
  scrim.addColorStop(1, 'rgba(10, 4, 18, 0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.58, w, h * 0.42);

  const baseline = h * 0.93;
  if (title) {
    let size = h * 0.115;
    const family = '"Arial Black", Impact, "Franklin Gothic Heavy", sans-serif';
    const setFont = () => { ctx.font = `900 ${size}px ${family}`; };
    setFont();
    try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
    while (ctx.measureText(title).width > w * 0.94 && size > 14) { size -= 3; setFont(); }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const x = w / 2;
    if (state.lettering === 'neon') {
      ctx.shadowColor = '#ff2e88';
      ctx.shadowBlur = size * 0.45;
      ctx.strokeStyle = '#2ee6ff';
      ctx.lineWidth = Math.max(3, size * 0.10);
      ctx.strokeText(title, x, baseline);
      ctx.shadowColor = '#2ee6ff';
      ctx.shadowBlur = size * 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(title, x, baseline);
    } else if (state.lettering === 'outline') {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = size * 0.18;
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(title, x, baseline);
      ctx.fillStyle = 'rgba(20, 4, 30, 0.55)';
      ctx.fillText(title, x, baseline);
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = size * 0.22;
      ctx.shadowOffsetY = size * 0.06;
      ctx.lineWidth = Math.max(4, size * 0.11);
      ctx.strokeStyle = '#14041e';
      ctx.strokeText(title, x, baseline);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(title, x, baseline);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    // Amber underline bar under the title.
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = state.grade === 'neon' ? '#2ee6ff' : '#ffb02e';
    ctx.fillRect(x - tw / 2, baseline + size * 0.10, tw, Math.max(4, size * 0.07));
  }

  if (tagline) {
    const size = Math.max(13, h * 0.028);
    ctx.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.28)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(tagline).width;
    const pad = size * 0.9;
    const chipY = baseline - (title ? h * 0.115 : 0) - size * 2.1;
    ctx.fillStyle = state.grade === 'noir' ? '#e8e8e8' : '#ff2e88';
    ctx.fillRect(w / 2 - tw / 2 - pad, chipY, tw + pad * 2, size * 1.9);
    ctx.fillStyle = state.grade === 'noir' ? '#111111' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(tagline, w / 2, chipY + size * 1.35);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/**
 * Draws the whole cover onto `canvas` (at its own pixel size) from `state`:
 * { layout, grade, lettering, title, tagline,
 *   photos: [{img}], panelPhotos: [photoIndex, ...],
 *   panelCrops: [{zoom, panX, panY}, ...] — one crop per panel }.
 * A photo drawn under the noir grade is desaturated with ctx.filter.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.filter = 'none';
  ctx.fillStyle = '#1c0b2e';
  ctx.fillRect(0, 0, w, h);

  const polys = layoutPanels(state.layout).map((poly) => poly.map(([fx, fy]) => [fx * w, fy * h]));
  const panelPhotos = state.panelPhotos || defaultPanelPhotos(state.layout);
  const panelCrops = state.panelCrops || [];
  polys.forEach((poly, i) => {
    const photo = state.photos[panelPhotos[i] ?? 0];
    const crop = panelCrops[i] || { zoom: 1, panX: 0, panY: 0 };
    if (state.grade === 'noir' && photo && photo.img) ctx.filter = 'grayscale(1) contrast(1.12) brightness(1.06)';
    paintPhoto(ctx, poly, photo, crop, w, h);
    ctx.filter = 'none';
  });

  // White poster seams between panels, then the outer frame.
  const seam = Math.max(4, Math.round(w * 0.006));
  ctx.lineJoin = 'round';
  polys.forEach((poly) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = seam;
    tracePoly(ctx, poly);
    ctx.stroke();
  });
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(6, Math.round(w * 0.009));
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  paintSun(ctx, w, h, state.grade, state.layout);
  paintGrade(ctx, w, h, state.grade);
  paintFinish(ctx, w, h);
  paintLettering(ctx, w, h, state);
}
