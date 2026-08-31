/**
 * 各效果的目标点生成：气泡会汇聚到这些坐标。
 * 手机竖屏会下移中心、缩小尺寸，避免挡住顶部计时器。
 */

function heartPoint(t, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: x * scale, y: y * scale };
}

function jitterPoint(x, y, amount) {
  return {
    x: x + (Math.random() - 0.5) * amount,
    y: y + (Math.random() - 0.5) * amount,
  };
}

function centerY(H, options) {
  if (options.isPhone) {
    return H * (options.heartCenterY || 0.6);
  }
  return H * (options.heartCenterY || 0.56);
}

/** 把目标点夹在安全区域内，避免贴边或盖住顶部 UI */
export function clampTargets(points, W, H, isPhone) {
  const padX = isPhone ? Math.max(14, W * 0.04) : Math.max(20, W * 0.03);
  const top = H * (isPhone ? 0.32 : 0.26);
  const bottom = H * (isPhone ? 0.9 : 0.93);
  for (const p of points) {
    if (p.x < padX) {
      p.x = padX;
    } else if (p.x > W - padX) {
      p.x = W - padX;
    }
    if (p.y < top) {
      p.y = top;
    } else if (p.y > bottom) {
      p.y = bottom;
    }
  }
  return points;
}

export function buildHeartTargets(n, W, H, options) {
  const points = [];
  const scaleFactor = options.isPhone ? options.heartScale * 0.95 : options.heartScale;
  const base = Math.min(W, H) * scaleFactor;
  const rings = options.isPhone ? [1.0, 0.86, 0.72, 0.58] : [1.0, 0.88, 0.76, 0.64, 0.52];
  const perRing = Math.floor(n / rings.length);
  const cy = centerY(H, options);

  for (let r = 0; r < rings.length; r++) {
    const scale = base * rings[r];
    const count = r === rings.length - 1 ? n - points.length : perRing;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2 + r * 0.08;
      const p = heartPoint(t, scale);
      points.push(jitterPoint(W * 0.5 + p.x, cy + p.y, Math.min(W, H) * 0.008));
    }
  }
  return points;
}

function sampleGlyphTargets(glyphs, n, W, H, options) {
  const off = document.createElement('canvas');
  const oc = off.getContext('2d', { willReadFrequently: true });
  const single = glyphs.length === 1;
  const isMusic = single && (glyphs[0] === '♫' || glyphs[0] === '♪' || glyphs[0] === '♬');

  // 手机：字号略小，避免盖住计时器、左右溢出
  let fontRatio;
  if (single) {
    if (isMusic) {
      fontRatio = options.isPhone ? 0.42 : 0.5;
    } else {
      fontRatio = options.isPhone ? 0.4 : 0.46;
    }
  } else {
    fontRatio = options.isPhone ? 0.18 : 0.2;
  }
  const fontSize = Math.min(W, H) * fontRatio;
  off.width = Math.max(64, Math.floor(W));
  off.height = Math.max(64, Math.floor(H * (options.isPhone ? 0.5 : 0.6)));

  oc.clearRect(0, 0, off.width, off.height);
  oc.fillStyle = '#000';
  oc.strokeStyle = '#000';
  oc.lineWidth = Math.max(2, fontSize * 0.04);
  oc.lineJoin = 'round';
  oc.font = `900 ${fontSize}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Songti SC", sans-serif`;
  oc.textAlign = 'center';
  oc.textBaseline = 'middle';

  const gap = fontSize * (options.isPhone ? 1.0 : 1.2);
  const totalW = (glyphs.length - 1) * gap;
  const startX = off.width / 2 - totalW / 2;
  const midY = off.height / 2;
  for (let i = 0; i < glyphs.length; i++) {
    const x = startX + i * gap;
    oc.strokeText(glyphs[i], x, midY);
    oc.fillText(glyphs[i], x, midY);
  }

  const { data, width, height } = oc.getImageData(0, 0, off.width, off.height);
  const pixels = [];
  const step = Math.max(1, Math.floor(fontSize / (single ? (options.isPhone ? 48 : 56) : 48)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        pixels.push({ x, y });
      }
    }
  }

  if (pixels.length === 0) {
    return null;
  }

  for (let i = pixels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pixels[i];
    pixels[i] = pixels[j];
    pixels[j] = tmp;
  }

  const offsetY = H * (options.isPhone ? 0.6 : 0.58);
  const points = [];
  const jitterScale = Math.max(0.5, step * 0.22);
  for (let i = 0; i < n; i++) {
    const p = pixels[i % pixels.length];
    points.push(jitterPoint(
      p.x + (W - off.width) / 2,
      p.y + offsetY - midY,
      jitterScale,
    ));
  }
  return points;
}

export function buildNameTargets(n, W, H, options) {
  const text = options.nameText || '兰';
  return sampleGlyphTargets(Array.from(text), n, W, H, options) || buildHeartTargets(n, W, H, options);
}

export function buildNoteTargets(n, W, H, options) {
  const symbols = options.noteShapeSymbols || ['♫'];
  return sampleGlyphTargets(symbols, n, W, H, options) || buildHeartTargets(n, W, H, options);
}

export function buildRomanceTargets(n, W, H, options) {
  return sampleGlyphTargets(['爱'], n, W, H, options) || buildHeartTargets(n, W, H, options);
}

export function buildWaveTargets(n, W, H, options) {
  const rows = options.isPhone ? 4 : 6;
  const perRow = Math.floor(n / rows);
  const points = [];
  const top = H * (options.isPhone ? 0.4 : 0.36);
  const span = H * (options.isPhone ? 0.38 : 0.44);
  const amp = Math.min(W, H) * (options.isPhone ? 0.028 : 0.04);
  const marginX = options.isPhone ? 0.06 : 0.08;

  for (let r = 0; r < rows; r++) {
    const count = r === rows - 1 ? n - points.length : perRow;
    const baseY = top + (span * r) / Math.max(1, rows - 1);
    const phase = r * 0.9;
    const freq = 2.0 + r * 0.15;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = W * marginX + t * W * (1 - marginX * 2);
      const y = baseY + Math.sin(t * Math.PI * freq + phase) * amp;
      points.push(jitterPoint(x, y, 3));
    }
  }
  return points;
}

export function buildSquareTargets(n, W, H, options) {
  const cx = W * 0.5;
  const cy = centerY(H, options);
  const half = Math.min(W, H) * (options.isPhone ? 0.2 : 0.2);
  const rings = options.isPhone ? [1, 0.72, 0.46] : [1, 0.78, 0.56, 0.34];
  const points = [];
  const perRing = Math.floor(n / rings.length);

  for (let r = 0; r < rings.length; r++) {
    const count = r === rings.length - 1 ? n - points.length : perRing;
    const s = half * rings[r];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const edge = Math.floor(t * 4) % 4;
      const u = (t * 4) % 1;
      let x = cx;
      let y = cy;
      if (edge === 0) {
        x = cx - s + u * 2 * s;
        y = cy - s;
      } else if (edge === 1) {
        x = cx + s;
        y = cy - s + u * 2 * s;
      } else if (edge === 2) {
        x = cx + s - u * 2 * s;
        y = cy + s;
      } else {
        x = cx - s;
        y = cy + s - u * 2 * s;
      }
      points.push(jitterPoint(x, y, 2));
    }
  }
  return points;
}

export function buildDiamondTargets(n, W, H, options) {
  const cx = W * 0.5;
  const cy = centerY(H, options);
  const rx = Math.min(W, H) * (options.isPhone ? 0.24 : 0.26);
  const ry = Math.min(W, H) * (options.isPhone ? 0.28 : 0.32);
  const rings = options.isPhone ? [1, 0.7, 0.42] : [1, 0.75, 0.5, 0.28];
  const points = [];
  const perRing = Math.floor(n / rings.length);

  for (let r = 0; r < rings.length; r++) {
    const count = r === rings.length - 1 ? n - points.length : perRing;
    const sx = rx * rings[r];
    const sy = ry * rings[r];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const edge = Math.floor(t * 4) % 4;
      const u = (t * 4) % 1;
      let x = cx;
      let y = cy;
      if (edge === 0) {
        x = cx + (1 - u) * sx;
        y = cy - u * sy;
      } else if (edge === 1) {
        x = cx - u * sx;
        y = cy - (1 - u) * sy;
      } else if (edge === 2) {
        x = cx - (1 - u) * sx;
        y = cy + u * sy;
      } else {
        x = cx + u * sx;
        y = cy + (1 - u) * sy;
      }
      points.push(jitterPoint(x, y, 2));
    }
  }
  return points;
}

export function buildBubblesTargets(n, W, H, options) {
  const cy = centerY(H, options);
  const circles = options.isPhone
    ? [
        { x: 0.5, y: 0.0, r: 0.14 },
        { x: 0.3, y: 0.06, r: 0.09 },
        { x: 0.7, y: 0.05, r: 0.1 },
        { x: 0.4, y: -0.12, r: 0.07 },
        { x: 0.62, y: -0.1, r: 0.08 },
      ]
    : [
        { x: 0.5, y: 0.0, r: 0.15 },
        { x: 0.3, y: 0.06, r: 0.1 },
        { x: 0.7, y: 0.05, r: 0.11 },
        { x: 0.22, y: -0.1, r: 0.08 },
        { x: 0.78, y: -0.08, r: 0.09 },
        { x: 0.42, y: -0.16, r: 0.07 },
        { x: 0.58, y: 0.16, r: 0.08 },
        { x: 0.5, y: -0.22, r: 0.06 },
      ];

  const pool = [];
  const base = Math.min(W, H);
  for (const c of circles) {
    const cx = W * c.x;
    const yy = cy + H * c.y * (options.isPhone ? 0.28 : 0.35);
    const radius = base * c.r;
    const steps = Math.max(14, Math.floor(radius * (options.isPhone ? 1.0 : 1.2)));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pool.push({
        x: cx + Math.cos(a) * radius,
        y: yy + Math.sin(a) * radius,
      });
    }
  }

  const points = [];
  for (let i = 0; i < n; i++) {
    const p = pool[i % pool.length];
    points.push(jitterPoint(p.x, p.y, 3));
  }
  return points;
}

export function buildRisingTargets(n, W, H, options) {
  const cols = options.isPhone ? 4 : 7;
  const perCol = Math.floor(n / cols);
  const points = [];
  const top = H * (options.isPhone ? 0.38 : 0.34);
  const bottom = H * (options.isPhone ? 0.86 : 0.82);
  const base = Math.min(W, H);
  const side = options.isPhone ? 0.16 : 0.18;
  const span = 1 - side * 2;

  for (let c = 0; c < cols; c++) {
    const count = c === cols - 1 ? n - points.length : perCol;
    const x = W * (side + (span * c) / Math.max(1, cols - 1));
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const y = bottom + (top - bottom) * t;
      const wobble = Math.sin(t * Math.PI * 3 + c) * base * 0.015;
      const ring = ((i + c) % 5) / 5;
      const radius = base * (0.01 + ring * 0.025);
      const a = (i / count) * Math.PI * 2;
      points.push(jitterPoint(
        x + wobble + Math.cos(a) * radius,
        y + Math.sin(a) * radius * 0.55,
        2,
      ));
    }
  }
  return points;
}

export function buildSpiralTargets(n, W, H, options) {
  const cx = W * 0.5;
  const cy = centerY(H, options);
  const maxR = Math.min(W, H) * (options.isPhone ? 0.26 : 0.28);
  const turns = options.isPhone ? 2.8 : 3.2;
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * Math.PI * 2 * turns;
    const r = maxR * t;
    points.push(jitterPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2));
  }
  return points;
}

export function buildStarTargets(n, W, H, options) {
  const cx = W * 0.5;
  const cy = centerY(H, options);
  const outer = Math.min(W, H) * (options.isPhone ? 0.24 : 0.26);
  const inner = outer * 0.42;
  const rings = options.isPhone ? [1, 0.68] : [1, 0.72, 0.48];
  const points = [];
  const perRing = Math.floor(n / rings.length);

  for (let r = 0; r < rings.length; r++) {
    const count = r === rings.length - 1 ? n - points.length : perRing;
    const o = outer * rings[r];
    const inn = inner * rings[r];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const seg = Math.floor(t * 10) % 10;
      const u = (t * 10) % 1;
      const a0 = (-Math.PI / 2) + (seg * Math.PI) / 5;
      const a1 = (-Math.PI / 2) + ((seg + 1) * Math.PI) / 5;
      const r0 = seg % 2 === 0 ? o : inn;
      const r1 = seg % 2 === 0 ? inn : o;
      const x0 = cx + Math.cos(a0) * r0;
      const y0 = cy + Math.sin(a0) * r0;
      const x1 = cx + Math.cos(a1) * r1;
      const y1 = cy + Math.sin(a1) * r1;
      points.push(jitterPoint(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 2));
    }
  }
  return points;
}

export const EFFECT_BUILDERS = {
  heart: buildHeartTargets,
  name: buildNameTargets,
  note: buildNoteTargets,
  wave: buildWaveTargets,
  romance: buildRomanceTargets,
  square: buildSquareTargets,
  diamond: buildDiamondTargets,
  bubbles: buildBubblesTargets,
  rising: buildRisingTargets,
  spiral: buildSpiralTargets,
  star: buildStarTargets,
};

export const EFFECT_ORDER = [
  'heart',
  'name',
  'note',
  'wave',
  'romance',
  'square',
  'diamond',
  'bubbles',
  'rising',
  'spiral',
  'star',
];
