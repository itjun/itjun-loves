import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  NAME_TEXT,
  NOTE_SYMBOLS,
  NOTE_SHAPE_SYMBOLS,
  BUBBLE_PHRASES,
  BUBBLE_COLORS,
} from './config.js';
import { EFFECT_BUILDERS } from './shapes.js';
import './timer.js';

document.getElementById('love-words').textContent = LOVE_WORDS;
document.getElementById('since').textContent = SINCE_TEXT;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const hint = document.getElementById('hint');
const effectsEl = document.getElementById('effects');

const PHASE = {
  SCATTER: 0,
  GATHER: 1,
  HOLD: 2,
  EXPLODE: 3,
};

let dpr = 1;
let W = 0;
let H = 0;
let isPhone = false;
let bubbleCount = 220;
let bubbleFont = 13;
let bubblePadX = 18;
let bubbleH = 28;
let heartScale = 0.022;
let heartCenterY = 0.55;
let currentEffect = 'heart';
let bubbles = [];
let phase = PHASE.SCATTER;
let phaseStart = 0;
let resizeTimer = null;

function setPhase(next, now) {
  phase = next;
  phaseStart = now;
}

function isCompactEffect() {
  return currentEffect === 'name' || currentEffect === 'note';
}

function layoutConfig() {
  isPhone = W < 768 || W / H < 0.85;
  const compact = isCompactEffect();
  if (isPhone) {
    bubbleCount = compact ? 280 : 200;
    bubbleFont = compact ? 12 : 13;
    bubblePadX = compact ? 10 : 18;
    bubbleH = compact ? 22 : 28;
    heartScale = 0.022;
    heartCenterY = 0.56;
  } else {
    bubbleCount = compact ? 400 : 320;
    bubbleFont = compact ? 14 : 15;
    bubblePadX = compact ? 12 : 22;
    bubbleH = compact ? 24 : 32;
    heartScale = 0.028;
    heartCenterY = 0.58;
  }
  hint.classList.remove('show');
}

function shapeOptions() {
  return {
    isPhone,
    heartScale,
    heartCenterY,
    nameText: NAME_TEXT,
    noteShapeSymbols: NOTE_SHAPE_SYMBOLS,
  };
}

function buildTargets(n) {
  const builder = EFFECT_BUILDERS[currentEffect] || EFFECT_BUILDERS.heart;
  return builder(n, W, H, shapeOptions());
}

function measureBubble(text) {
  ctx.font = `600 ${bubbleFont}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  const tw = ctx.measureText(text).width;
  return {
    w: Math.ceil(tw + bubblePadX),
    h: bubbleH,
  };
}

function randomScatterPoint() {
  return {
    x: Math.random() * W,
    y: H * (isPhone ? 0.28 : 0.22) + Math.random() * H * (isPhone ? 0.55 : 0.62),
  };
}

function bubbleTextForIndex(i) {
  if (currentEffect === 'name') {
    const chars = Array.from(NAME_TEXT);
    return chars[i % chars.length];
  }
  if (currentEffect === 'note') {
    return NOTE_SYMBOLS[i % NOTE_SYMBOLS.length];
  }
  return BUBBLE_PHRASES[i % BUBBLE_PHRASES.length];
}

function createBubbles() {
  layoutConfig();
  const targets = buildTargets(bubbleCount);
  bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    const text = bubbleTextForIndex(i);
    const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const size = measureBubble(text);
    const start = randomScatterPoint();
    bubbles.push({
      text,
      color,
      w: size.w,
      h: size.h,
      x: start.x,
      y: start.y,
      sx: start.x,
      sy: start.y,
      hx: targets[i].x,
      hy: targets[i].y,
      ex: 0,
      ey: 0,
      rot: (Math.random() - 0.5) * 0.35,
      delay: Math.random() * 0.35,
      trail: [],
    });
  }
  assignExplodeTargets();
}

function assignExplodeTargets() {
  for (const b of bubbles) {
    const scatter = randomScatterPoint();
    b.ex = scatter.x;
    b.ey = scatter.y;
  }
}

function applyCanvasSize() {
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
}

function resize(forceRestart) {
  const prevW = W;
  const prevH = H;
  applyCanvasSize();

  const sizeChanged =
    Math.abs(W - prevW) > 40 || Math.abs(H - prevH) > 40 || prevW === 0;

  if (forceRestart || sizeChanged) {
    createBubbles();
    restart();
  }
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resize(true);
  }, 180);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function restart() {
  setPhase(PHASE.SCATTER, performance.now());
  hint.classList.remove('show');
  for (const b of bubbles) {
    b.x = b.sx;
    b.y = b.sy;
    b.trail = [];
  }
}

/** 散开结束后：以当前位置为新起点，再次聚合 */
function loopToGather(now) {
  for (const b of bubbles) {
    b.sx = b.x;
    b.sy = b.y;
    b.trail = [];
    b.delay = Math.random() * 0.28;
  }
  setPhase(PHASE.GATHER, now);
}

function switchEffect(effect) {
  if (!EFFECT_BUILDERS[effect]) {
    return;
  }
  if (effect === currentEffect) {
    createBubbles();
    restart();
    return;
  }
  currentEffect = effect;
  for (const btn of effectsEl.querySelectorAll('.effect-btn')) {
    btn.classList.toggle('active', btn.dataset.effect === effect);
  }
  createBubbles();
  restart();
}

function drawBubble(b, alpha) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = alpha;

  const r = isPhone ? 8 : 10;
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
  ctx.font = `600 ${bubbleFont}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, 0, 1);

  ctx.restore();
}

function update(now) {
  const elapsed = (now - phaseStart) / 1000;

  if (phase === PHASE.SCATTER) {
    if (elapsed > 0.8) {
      setPhase(PHASE.GATHER, now);
    }
  } else if (phase === PHASE.GATHER) {
    const duration = 3.0;
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
    if (elapsed > duration + 0.3) {
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
    if (elapsed > 2.4) {
      assignExplodeTargets();
      for (const b of bubbles) {
        b.sx = b.x;
        b.sy = b.y;
        b.delay = Math.random() * 0.25;
      }
      setPhase(PHASE.EXPLODE, now);
    }
  } else if (phase === PHASE.EXPLODE) {
    const duration = 1.6;
    for (const b of bubbles) {
      const local = Math.min(1, Math.max(0, (elapsed - b.delay) / duration));
      const k = easeInOutCubic(local);
      b.x = b.sx + (b.ex - b.sx) * k;
      b.y = b.sy + (b.ey - b.sy) * k;
    }
    if (elapsed > duration + 0.25) {
      // 散开后立即再聚合，所有效果无限循环
      loopToGather(now);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

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
    drawBubble(b, 1);
  }
}

function loop(now) {
  update(now);
  render();
  requestAnimationFrame(loop);
}

effectsEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const btn = e.target.closest('.effect-btn');
  if (!btn) {
    return;
  }
  switchEffect(btn.dataset.effect);
});

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resize(true), 260);
});

resize(true);
requestAnimationFrame(loop);
