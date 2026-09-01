import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  NAME_TEXT,
  LETTER,
  TIMELINE,
  LOVE_NOTES,
} from './config.js';
import { initPageScroll } from './scroll.js';
import './timer.js';

document.getElementById('love-words').textContent = LOVE_WORDS;
document.getElementById('since').textContent = SINCE_TEXT;
document.getElementById('footer-since').textContent = SINCE_TEXT;
document.getElementById('name-mark').textContent = NAME_TEXT;
document.getElementById('letter-body').textContent = LETTER.body;
document.getElementById('letter-sign').textContent = LETTER.sign;

const timelineEl = document.getElementById('timeline');
for (const item of TIMELINE) {
  const li = document.createElement('li');
  li.className = 'timeline__item';
  li.innerHTML = `
    <time class="timeline__date">${item.date}</time>
    <div class="timeline__content">
      <h3>${item.title}</h3>
      <p>${item.desc}</p>
    </div>
  `;
  timelineEl.appendChild(li);
}

const notesEl = document.getElementById('notes-grid');
for (const note of LOVE_NOTES) {
  const span = document.createElement('span');
  span.className = 'notes__item';
  span.textContent = note;
  notesEl.appendChild(span);
}

const pages = Array.from(document.querySelectorAll('.page'));
initPageScroll(pages, document.getElementById('page-nav'), document.getElementById('back-top'));

/* ── 梅花飘落 ── */
const canvas = document.getElementById('petals');
const ctx = canvas.getContext('2d');

let W = 0;
let H = 0;
let dpr = 1;
let blossoms = [];
const BLOSSOM_COUNT = 18;

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createBlossom() {
  return {
    x: Math.random() * W,
    y: Math.random() * H - H,
    size: 4 + Math.random() * 6,
    speed: 0.25 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.25,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.015,
    alpha: 0.1 + Math.random() * 0.22,
  };
}

function initBlossoms() {
  blossoms = [];
  for (let i = 0; i < BLOSSOM_COUNT; i++) {
    const b = createBlossom();
    b.y = Math.random() * H;
    blossoms.push(b);
  }
}

/** 五瓣梅花 */
function drawBlossom(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = b.alpha;
  ctx.fillStyle = '#d06068';

  const r = b.size;
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.7, r * 0.45, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#c9a45c';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function animateBlossoms() {
  ctx.clearRect(0, 0, W, H);

  for (const b of blossoms) {
    b.y += b.speed;
    b.x += b.drift;
    b.rot += b.rotSpeed;

    if (b.y > H + b.size * 3) {
      b.y = -b.size * 3;
      b.x = Math.random() * W;
    }

    drawBlossom(b);
  }

  requestAnimationFrame(animateBlossoms);
}

resizeCanvas();
initBlossoms();
animateBlossoms();

window.addEventListener('resize', () => {
  resizeCanvas();
  initBlossoms();
});
