/**
 * 各效果的目标点生成：气泡会汇聚到这些坐标。
 */

function heartPoint(t, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: x * scale, y: y * scale };
}

export function buildHeartTargets(n, W, H, options) {
  const points = [];
  const base = Math.min(W, H) * options.heartScale;
  const rings = [1.0, 0.88, 0.76, 0.64, 0.52];
  const perRing = Math.floor(n / rings.length);
  const cy = H * options.heartCenterY;

  for (let r = 0; r < rings.length; r++) {
    const scale = base * rings[r];
    const count = r === rings.length - 1 ? n - points.length : perRing;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2 + r * 0.08;
      const p = heartPoint(t, scale);
      const jitter = (Math.random() - 0.5) * Math.min(W, H) * 0.01;
      points.push({
        x: W * 0.5 + p.x + jitter,
        y: cy + p.y + jitter,
      });
    }
  }
  return points;
}

function sampleGlyphTargets(glyphs, n, W, H, options) {
  const off = document.createElement('canvas');
  const oc = off.getContext('2d', { willReadFrequently: true });
  const single = glyphs.length === 1;
  const fontSize = Math.min(W, H) * (single
    ? (options.isPhone ? 0.5 : 0.46)
    : (options.isPhone ? 0.22 : 0.2));
  off.width = Math.max(64, Math.floor(W));
  off.height = Math.max(64, Math.floor(H * 0.6));

  oc.clearRect(0, 0, off.width, off.height);
  oc.fillStyle = '#000';
  oc.strokeStyle = '#000';
  oc.lineWidth = Math.max(2, fontSize * 0.04);
  oc.lineJoin = 'round';
  oc.font = `900 ${fontSize}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Songti SC", sans-serif`;
  oc.textAlign = 'center';
  oc.textBaseline = 'middle';

  const gap = fontSize * (options.isPhone ? 1.05 : 1.2);
  const totalW = (glyphs.length - 1) * gap;
  const startX = off.width / 2 - totalW / 2;
  const midY = off.height / 2;
  for (let i = 0; i < glyphs.length; i++) {
    const x = startX + i * gap;
    // 描边加粗，采样点更密，单字轮廓更清晰
    oc.strokeText(glyphs[i], x, midY);
    oc.fillText(glyphs[i], x, midY);
  }

  const { data, width, height } = oc.getImageData(0, 0, off.width, off.height);
  const pixels = [];
  const step = Math.max(1, Math.floor(fontSize / (single ? 56 : 48)));
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

  const offsetY = H * (options.isPhone ? 0.56 : 0.58);
  const points = [];
  const jitterScale = Math.max(0.6, step * 0.25);
  for (let i = 0; i < n; i++) {
    const p = pixels[i % pixels.length];
    const jitter = (Math.random() - 0.5) * jitterScale;
    points.push({
      x: p.x + (W - off.width) / 2 + jitter,
      y: p.y + offsetY - midY + jitter,
    });
  }
  return points;
}

/** 名字轮廓：默认「兰」 */
export function buildNameTargets(n, W, H, options) {
  const text = options.nameText || '兰';
  const points = sampleGlyphTargets(Array.from(text), n, W, H, options);
  if (!points) {
    return buildHeartTargets(n, W, H, options);
  }
  return points;
}

/** 音乐符号轮廓：♪ ♫ ♬ */
export function buildNoteTargets(n, W, H, options) {
  const symbols = options.noteShapeSymbols || ['♪', '♫', '♬'];
  const points = sampleGlyphTargets(symbols, n, W, H, {
    ...options,
    isPhone: options.isPhone,
  });
  if (!points) {
    return buildHeartTargets(n, W, H, options);
  }
  return points;
}

/** 多层正弦波浪 */
export function buildWaveTargets(n, W, H, options) {
  const rows = options.isPhone ? 5 : 6;
  const perRow = Math.floor(n / rows);
  const points = [];
  const top = H * (options.isPhone ? 0.38 : 0.36);
  const span = H * (options.isPhone ? 0.42 : 0.44);
  const amp = Math.min(W, H) * (options.isPhone ? 0.035 : 0.04);

  for (let r = 0; r < rows; r++) {
    const count = r === rows - 1 ? n - points.length : perRow;
    const baseY = top + (span * r) / (rows - 1);
    const phase = r * 0.9;
    const freq = 2.2 + r * 0.15;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const x = W * 0.08 + t * W * 0.84;
      const y = baseY + Math.sin(t * Math.PI * freq + phase) * amp;
      const jitter = (Math.random() - 0.5) * 4;
      points.push({ x: x + jitter, y: y + jitter });
    }
  }
  return points;
}

export const EFFECT_BUILDERS = {
  heart: buildHeartTargets,
  name: buildNameTargets,
  note: buildNoteTargets,
  wave: buildWaveTargets,
};
