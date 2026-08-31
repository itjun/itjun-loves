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
import { EFFECT_BUILDERS, EFFECT_ORDER, clampTargets } from './shapes.js';
import './timer.js';

document.getElementById('love-words').textContent = LOVE_WORDS;
document.getElementById('since').textContent = SINCE_TEXT;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const PHASE = {
  GATHER: 0,
  HOLD: 1,
  EXPLODE: 2,
  WAIT: 3,
};

const TIMING = {
  gather: 3.0,
  hold: 2.0,
  explode: 1.8,
  wait: 0.5,
};

/** 手机用更短文案，气泡更窄，形状更清晰 */
const PHONE_PHRASES = BUBBLE_PHRASES.filter((p) => p.length <= 4);

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
let trailChance = 0.4;
let trailMax = 6;
let effectIndex = 0;
let currentEffect = EFFECT_ORDER[0];
let bubbles = [];
let phase = PHASE.GATHER;
let phaseStart = 0;
let resizeTimer = null;

function setPhase(next, now) {
  phase = next;
  phaseStart = now;
}

function detectPhone() {
  // 窄屏，或竖屏手机/平板
  return W < 768 || (W <= 1024 && W / H < 0.85);
}

function isGlyphEffect() {
  return currentEffect === 'name' || currentEffect === 'note' || currentEffect === 'romance';
}

function layoutConfig() {
  isPhone = detectPhone();
  const glyph = isGlyphEffect();
  if (isPhone) {
    // 降数量保帧率，字形效果略多一点
    bubbleCount = glyph ? 180 : 140;
    bubbleFont = glyph ? 11 : 11;
    bubblePadX = glyph ? 8 : 12;
    bubbleH = glyph ? 18 : 22;
    heartScale = 0.026;
    heartCenterY = 0.6;
    trailChance = 0.18;
    trailMax = 3;
  } else {
    bubbleCount = glyph ? 420 : 320;
    bubbleFont = glyph ? 13 : 15;
    bubblePadX = glyph ? 10 : 20;
    bubbleH = glyph ? 22 : 32;
    heartScale = 0.028;
    heartCenterY = 0.58;
    trailChance = 0.4;
    trailMax = 6;
  }
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

function randomInView() {
  const top = isPhone ? 0.32 : 0.22;
  const span = isPhone ? 0.52 : 0.62;
  return {
    x: W * 0.04 + Math.random() * W * 0.92,
    y: H * top + Math.random() * H * span,
  };
}

function randomExplodePoint() {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.max(W, H) * (isPhone ? 0.7 : 0.55 + Math.random() * 0.75);
  return {
    x: W * 0.5 + Math.cos(angle) * dist,
    y: H * 0.58 + Math.sin(angle) * dist,
  };
}

function bubbleTextForIndex(i) {
  if (currentEffect === 'name') {
    return NAME_TEXT;
  }
  if (currentEffect === 'note') {
    return i % 3 === 0 ? NOTE_SYMBOLS[i % NOTE_SYMBOLS.length] : '♫';
  }
  const pool = isPhone ? PHONE_PHRASES : BUBBLE_PHRASES;
  if (currentEffect === 'romance') {
    return i % 4 === 0 ? '爱' : pool[i % pool.length];
  }
  return pool[i % pool.length];
}

function createBubbles() {
  layoutConfig();
  const targets = clampTargets(buildTargets(bubbleCount), W, H, isPhone);
  bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    const text = bubbleTextForIndex(i);
    const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const size = measureBubble(text);
    const start = randomInView();
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
      rot: (Math.random() - 0.5) * (isPhone ? 0.2 : 0.3),
      delay: Math.random() * 0.35,
      trail: [],
    });
  }
}

function applyCanvasSize() {
  const app = document.getElementById('app');
  const rect = app.getBoundingClientRect();
  const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  W = Math.max(1, Math.floor(rect.width || vw));
  H = Math.max(1, Math.floor(rect.height || vh));
  isPhone = detectPhone();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    restartCycle();
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

function restartCycle() {
  for (const b of bubbles) {
    const start = randomInView();
    b.sx = start.x;
    b.sy = start.y;
    b.x = start.x;
    b.y = start.y;
    b.delay = Math.random() * 0.35;
    b.trail = [];
  }
  setPhase(PHASE.GATHER, performance.now());
}

function beginExplode(now) {
  for (const b of bubbles) {
    const end = randomExplodePoint();
    b.sx = b.x;
    b.sy = b.y;
    b.ex = end.x;
    b.ey = end.y;
    b.delay = Math.random() * 0.3;
    b.trail = [];
  }
  setPhase(PHASE.EXPLODE, now);
}

/** 散开结束后切换到下一个效果并再次聚合 */
function advanceToNextEffect(now) {
  const prevPositions = bubbles.map((b) => ({ x: b.x, y: b.y }));

  effectIndex = (effectIndex + 1) % EFFECT_ORDER.length;
  currentEffect = EFFECT_ORDER[effectIndex];
  createBubbles();

  for (let i = 0; i < bubbles.length; i++) {
    const p = prevPositions[i % prevPositions.length];
    bubbles[i].sx = p.x;
    bubbles[i].sy = p.y;
    bubbles[i].x = p.x;
    bubbles[i].y = p.y;
    bubbles[i].delay = Math.random() * 0.3;
    bubbles[i].trail = [];
  }

  setPhase(PHASE.GATHER, now);
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

  if (phase === PHASE.GATHER) {
    const duration = TIMING.gather;
    for (const b of bubbles) {
      const local = Math.min(1, Math.max(0, (elapsed - b.delay) / duration));
      const k = easeInOutCubic(local);
      b.x = b.sx + (b.hx - b.sx) * k;
      b.y = b.sy + (b.hy - b.sy) * k;
      if (local > 0.05 && local < 0.95 && Math.random() < trailChance) {
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > trailMax) {
          b.trail.shift();
        }
      }
    }
    if (elapsed > duration + 0.4) {
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
    if (elapsed > TIMING.hold) {
      beginExplode(now);
    }
  } else if (phase === PHASE.EXPLODE) {
    const duration = TIMING.explode;
    for (const b of bubbles) {
      const local = Math.min(1, Math.max(0, (elapsed - b.delay) / duration));
      const k = easeInOutCubic(local);
      b.x = b.sx + (b.ex - b.sx) * k;
      b.y = b.sy + (b.ey - b.sy) * k;
    }
    if (elapsed > duration + 0.4) {
      setPhase(PHASE.WAIT, now);
    }
  } else if (phase === PHASE.WAIT) {
    if (elapsed > TIMING.wait) {
      advanceToNextEffect(now);
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

function frame(now) {
  update(now);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resize(true), 280);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', onResize);
}

resize(true);
requestAnimationFrame(frame);
