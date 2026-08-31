import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  BUBBLE_PHRASES,
  BUBBLE_COLORS,
} from './config.js';
import './timer.js';

document.getElementById('love-words').textContent = LOVE_WORDS;
document.getElementById('since').textContent = SINCE_TEXT;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');

const COUNT = 220;

const PHASE = {
  SCATTER: 0,
  GATHER: 1,
  HOLD: 2,
  EXPLODE: 3,
  DONE: 4,
};

let dpr = 1;
let W = 0;
let H = 0;
let bubbles = [];
let phase = PHASE.SCATTER;
let phaseStart = 0;
let running = true;
window.__lovePhases = [];

function setPhase(next, now) {
  phase = next;
  phaseStart = now;
  window.__lovePhases.push({ phase: next, t: Math.round(performance.now()) });
}

function heartPoint(t, scale) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y =
    -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x: x * scale, y: y * scale };
}

function buildHeartTargets(n) {
  const points = [];
  const base = Math.min(W, H) * 0.022;
  // 多层同心爱心，做出参考图那种「厚度 + 拖尾」感
  const rings = [1.0, 0.88, 0.76, 0.64, 0.52];
  const perRing = Math.floor(n / rings.length);
  for (let r = 0; r < rings.length; r++) {
    const scale = base * rings[r];
    const count = r === rings.length - 1 ? n - points.length : perRing;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2 + r * 0.08;
      const p = heartPoint(t, scale);
      const jitter = (Math.random() - 0.5) * Math.min(W, H) * 0.01;
      points.push({
        x: W * 0.5 + p.x + jitter,
        y: H * 0.55 + p.y + jitter,
      });
    }
  }
  return points;
}

function measureBubble(text) {
  ctx.font = '600 13px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const tw = ctx.measureText(text).width;
  return {
    w: Math.ceil(tw + 18),
    h: 28,
  };
}

function createBubbles() {
  const targets = buildHeartTargets(COUNT);
  bubbles = [];
  for (let i = 0; i < COUNT; i++) {
    const text = BUBBLE_PHRASES[i % BUBBLE_PHRASES.length];
    const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const size = measureBubble(text);
    const startX = Math.random() * W;
    const startY = H * 0.28 + Math.random() * H * 0.55;
    bubbles.push({
      text,
      color,
      w: size.w,
      h: size.h,
      x: startX,
      y: startY,
      sx: startX,
      sy: startY,
      hx: targets[i].x,
      hy: targets[i].y,
      // 爆炸目标：飞向屏幕四周外
      ex: W * 0.5 + (Math.random() - 0.5) * W * 2.4,
      ey: H * 0.5 + (Math.random() - 0.5) * H * 2.4,
      rot: (Math.random() - 0.5) * 0.35,
      delay: Math.random() * 0.35,
      trail: [],
    });
  }
}

function resize() {
  const app = document.getElementById('app');
  const rect = app.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, Math.floor(rect.width || window.innerWidth));
  H = Math.max(1, Math.floor(rect.height || window.innerHeight));
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  createBubbles();
  restart();
  window.__bubbles = bubbles;
  window.__loveDebug = () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const b of bubbles) {
      minX = Math.min(minX, b.hx);
      maxX = Math.max(maxX, b.hx);
      minY = Math.min(minY, b.hy);
      maxY = Math.max(maxY, b.hy);
    }
    return {
      W,
      H,
      phase,
      heartBox: {
        minX: Math.round(minX),
        maxX: Math.round(maxX),
        minY: Math.round(minY),
        maxY: Math.round(maxY),
      },
    };
  };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function restart() {
  setPhase(PHASE.SCATTER, performance.now());
  hint.classList.remove('show');
  running = true;
  for (const b of bubbles) {
    b.x = b.sx;
    b.y = b.sy;
    b.trail = [];
  }
}

function drawBubble(b, alpha) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = alpha;

  const r = 8;
  const x = -b.w / 2;
  const y = -b.h / 2;

  ctx.fillStyle = b.color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b.w, y, x + b.w, y + b.h, r);
  ctx.arcTo(x + b.w, y + b.h, x, y + b.h, r);
  ctx.arcTo(x, y + b.h, x, y, r);
  ctx.arcTo(x, y, x + b.w, y, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.font = '600 13px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, 0, 1);

  ctx.restore();
}

function update(now) {
  const elapsed = (now - phaseStart) / 1000;

  if (phase === PHASE.SCATTER) {
    if (elapsed > 1.0) {
      setPhase(PHASE.GATHER, now);
    }
  } else if (phase === PHASE.GATHER) {
    const duration = 3.2;
    for (const b of bubbles) {
      const local = Math.min(1, Math.max(0, (elapsed - b.delay) / duration));
      const k = easeInOutCubic(local);
      b.x = b.sx + (b.hx - b.sx) * k;
      b.y = b.sy + (b.hy - b.sy) * k;
      if (local > 0.05 && local < 0.95 && Math.random() < 0.45) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 6) {
          b.trail.shift();
        }
      }
    }
    if (elapsed > duration + 0.35) {
      for (const b of bubbles) {
        b.x = b.hx;
        b.y = b.hy;
        b.trail = [];
      }
      setPhase(PHASE.HOLD, now);
    }
  } else if (phase === PHASE.HOLD) {
    const breath = Math.sin(elapsed * 2.2) * 1.5;
    for (const b of bubbles) {
      b.x = b.hx + Math.sin(elapsed * 1.5 + b.delay * 6) * 0.6;
      b.y = b.hy + breath * 0.2;
    }
    if (elapsed > 3.2) {
      for (const b of bubbles) {
        b.sx = b.x;
        b.sy = b.y;
      }
      setPhase(PHASE.EXPLODE, now);
    }
  } else if (phase === PHASE.EXPLODE) {
    const duration = 1.8;
    for (const b of bubbles) {
      const local = Math.min(1, Math.max(0, (elapsed - b.delay * 0.35) / duration));
      const k = easeOutCubic(local);
      b.x = b.sx + (b.ex - b.sx) * k;
      b.y = b.sy + (b.ey - b.sy) * k;
    }
    if (elapsed > duration + 0.35) {
      setPhase(PHASE.DONE, now);
      hint.classList.add('show');
    }
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

  // 先画拖尾（更淡）
  if (phase === PHASE.GATHER) {
    for (const b of bubbles) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        const alpha = ((i + 1) / (b.trail.length + 1)) * 0.28;
        const oldX = b.x;
        const oldY = b.y;
        b.x = t.x;
        b.y = t.y;
        drawBubble(b, alpha);
        b.x = oldX;
        b.y = oldY;
      }
    }
  }

  for (const b of bubbles) {
    let alpha = 1;
    if (phase === PHASE.EXPLODE) {
      const dx = b.x - W * 0.5;
      const dy = b.y - H * 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      alpha = Math.max(0.15, 1 - dist / (Math.max(W, H) * 1.2));
    } else if (phase === PHASE.DONE) {
      alpha = 0.2;
    }
    drawBubble(b, alpha);
  }
}

function loop(now) {
  if (running) {
    update(now);
  }
  render();
  window.__lovePhase = phase;
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
window.addEventListener('pointerdown', () => {
  if (phase === PHASE.DONE || phase === PHASE.EXPLODE) {
    createBubbles();
    restart();
  }
});

resize();
requestAnimationFrame(loop);
