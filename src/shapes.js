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

/** 从离屏文字像素采样，形成名字轮廓 */
export function buildNameTargets(n, W, H, options) {
  const text = options.nameText || '周桂兰';
  const off = document.createElement('canvas');
  const oc = off.getContext('2d');
  const fontSize = Math.min(W, H) * (options.isPhone ? 0.22 : 0.18);
  off.width = Math.max(64, Math.floor(W));
  off.height = Math.max(64, Math.floor(H * 0.55));

  oc.clearRect(0, 0, off.width, off.height);
  oc.fillStyle = '#000';
  oc.font = `700 ${fontSize}px "PingFang SC", "Hiragino Sans GB", "Songti SC", serif`;
  oc.textAlign = 'center';
  oc.textBaseline = 'middle';
  oc.fillText(text, off.width / 2, off.height / 2);

  const { data, width, height } = oc.getImageData(0, 0, off.width, off.height);
  const pixels = [];
  const step = Math.max(2, Math.floor(fontSize / 28));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        pixels.push({ x, y });
      }
    }
  }

  if (pixels.length === 0) {
    return buildHeartTargets(n, W, H, options);
  }

  // 打乱采样点，避免按扫描线顺序挤在一起
  for (let i = pixels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pixels[i];
    pixels[i] = pixels[j];
    pixels[j] = tmp;
  }

  const offsetY = H * (options.isPhone ? 0.42 : 0.4);
  const points = [];
  for (let i = 0; i < n; i++) {
    const p = pixels[i % pixels.length];
    const jitter = (Math.random() - 0.5) * step * 0.8;
    points.push({
      x: p.x + (W - off.width) / 2 + jitter,
      y: p.y + offsetY - off.height / 2 + jitter,
    });
  }
  return points;
}

function noteOutline(cx, cy, scale) {
  const pts = [];
  // 符头（椭圆）
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push({
      x: cx + Math.cos(a) * 10 * scale + Math.sin(a) * 2 * scale,
      y: cy + Math.sin(a) * 7 * scale,
    });
  }
  // 符干
  const stemX = cx + 9 * scale;
  const stemTop = cy - 38 * scale;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push({
      x: stemX,
      y: cy + (stemTop - cy) * t,
    });
  }
  // 符尾
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push({
      x: stemX + Math.sin(t * Math.PI) * 14 * scale,
      y: stemTop + t * 18 * scale,
    });
  }
  return pts;
}

/** 多个音符轮廓点 */
export function buildNoteTargets(n, W, H, options) {
  const scale = Math.min(W, H) * (options.isPhone ? 0.012 : 0.011);
  const notes = options.isPhone
    ? [
        { x: 0.28, y: 0.52 },
        { x: 0.5, y: 0.46 },
        { x: 0.72, y: 0.54 },
        { x: 0.4, y: 0.66 },
        { x: 0.62, y: 0.64 },
      ]
    : [
        { x: 0.22, y: 0.5 },
        { x: 0.38, y: 0.44 },
        { x: 0.52, y: 0.52 },
        { x: 0.66, y: 0.46 },
        { x: 0.8, y: 0.54 },
        { x: 0.32, y: 0.66 },
        { x: 0.58, y: 0.68 },
        { x: 0.74, y: 0.64 },
      ];

  const pool = [];
  for (const note of notes) {
    const outline = noteOutline(W * note.x, H * note.y, scale);
    for (const p of outline) {
      pool.push(p);
    }
  }

  const points = [];
  for (let i = 0; i < n; i++) {
    const p = pool[i % pool.length];
    const jitter = (Math.random() - 0.5) * Math.min(W, H) * 0.008;
    points.push({
      x: p.x + jitter,
      y: p.y + jitter,
    });
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

export const EFFECT_LABELS = {
  heart: '爱心',
  name: '名字',
  note: '音符',
  wave: '波浪',
};
