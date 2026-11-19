// Colour grades for the cover: each one is a sunset / neon mood made of a sky
// gradient, a sun, a photo tint and a title fill. No external assets — every
// colour here is our own palette.

/** One grade: the colours a render pass uses, in order top to bottom. */
export const GRADES = {
  sunset: {
    label: 'Sunset Strip',
    skyTop: '#2b1055',
    skyMid: '#b83a6e',
    skyLow: '#ff7a3d',
    sunTop: '#ffe259',
    sunLow: '#ff5e62',
    tint: 'rgba(255, 90, 60, 0.16)',
    tintMode: 'overlay',
    titleTop: '#fff7d6',
    titleLow: '#ffb347',
    outline: '#1c0a2e',
    frame: '#14081f',
    accent: '#ff2e88',
  },
  neon: {
    label: 'Neon Nights',
    skyTop: '#0d0221',
    skyMid: '#5b2a9d',
    skyLow: '#ff2e88',
    sunTop: '#7df9ff',
    sunLow: '#ff2e88',
    tint: 'rgba(255, 46, 136, 0.20)',
    tintMode: 'overlay',
    titleTop: '#e8fbff',
    titleLow: '#7df9ff',
    outline: '#0d0221',
    frame: '#0d0221',
    accent: '#7df9ff',
  },
  gold: {
    label: 'Golden Hour',
    skyTop: '#3d1e0a',
    skyMid: '#c96f2e',
    skyLow: '#ffc93d',
    sunTop: '#fff3b0',
    sunLow: '#ff9a3d',
    tint: 'rgba(255, 170, 40, 0.18)',
    tintMode: 'overlay',
    titleTop: '#fffbe8',
    titleLow: '#ffc93d',
    outline: '#2b1404',
    frame: '#1d0f02',
    accent: '#ff9a3d',
  },
  midnight: {
    label: 'Midnight Drive',
    skyTop: '#050914',
    skyMid: '#14264d',
    skyLow: '#2e6f8e',
    sunTop: '#dfe9ff',
    sunLow: '#7fa8d9',
    tint: 'rgba(60, 120, 200, 0.20)',
    tintMode: 'overlay',
    titleTop: '#f2f6ff',
    titleLow: '#9fc4ff',
    outline: '#050914',
    frame: '#050914',
    accent: '#7fa8d9',
  },
};

/** The grade names, in the order the editor offers them. */
export const GRADE_NAMES = Object.keys(GRADES);

/** Returns the grade for `name`, falling back to sunset for unknown names. */
export function gradeOf(name) {
  return GRADES[name] ?? GRADES.sunset;
}
