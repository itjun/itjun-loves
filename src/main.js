import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  NAME_TEXT,
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
  DONE: 4,
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
let running = true;
let resizeTimer = null;

function setPhase(next, now) {
  phase = next;
  phaseStart = now;
}

function layoutConfig() {
  isPhone = W < 768 || W / H < 0.85;
  if (isPhone) {
    bubbleCount = 200;
    bubbleFont = 13;
    bubblePadX = 18;
    bubbleH = 28;
    heartScale = 0.022;
    heartCenterY = 0.56;
    hint.textContent = '轻触屏幕，再看一次';
  } else {
    bubbleCount = 320;
    bubbleFont = 15;
    bubblePadX = 22;
    bubbleH = 32;
    heartScale = 0.028;
    heartCenterY = 0.58;
    hint.textContent = '点击屏幕，再看一次';
  }
}

function shapeOptions() {
  return {
    isPhone,
    heartScale,
    heartCenterY,
    nameText: NAME_TEXT,
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

function createBubbles() {
  layoutConfig();
  const targets = buildTargets(bubbleCount);
  bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    const text = BUBBLE_PHRASES[i % BUBBLE_PHRASES.length];
    const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const size = measureBubble(text);
    const startX = Math.random() * W;
    const startY = H * (isPhone ? 0.28 : 0.22) + Math.random() * H * (isPhone ? 0.55 : 0.62);
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
      ex: W * 0.5 + (Math.random() - 0.5) * W * 2.6,
      ey: H * 0.5 + (Math.random() - 0.5) * H * 2.6,
      rot: (Math.random() - 0.5) * 0.35,
      delay: Math.random() * 0.35,
      trail: [],
    });
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

function switchEffect(effect) {
  if (!EFFECT_BUILDERS[effect] || effect === currentEffect) {
    if (effect === currentEffect) {
      createBubbles();
      restart();
    }
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

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('#effects')) {
    return;
  }
  if (phase === PHASE.DONE || phase === PHASE.EXPLODE) {
    createBubbles();
    restart();
  }
});

resize(true);
requestAnimationFrame(loop);
