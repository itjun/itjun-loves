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

/* ── 花瓣动画（仅首页显示） ── */
const canvas = document.getElementById('petals');
const ctx = canvas.getContext('2d');

let W = 0;
let H = 0;
let dpr = 1;
let petals = [];
const PETAL_COUNT = 24;

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

function createPetal() {
  return {
    x: Math.random() * W,
    y: Math.random() * H - H,
    size: 5 + Math.random() * 8,
    speed: 0.3 + Math.random() * 0.6,
    drift: (Math.random() - 0.5) * 0.3,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
    alpha: 0.12 + Math.random() * 0.25,
  };
}

function initPetals() {
  petals = [];
  for (let i = 0; i < PETAL_COUNT; i++) {
    const p = createPetal();
    p.y = Math.random() * H;
    petals.push(p);
  }
}

function drawPetal(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = '#f0b090';

  ctx.beginPath();
  ctx.moveTo(0, -p.size);
  ctx.bezierCurveTo(p.size * 0.6, -p.size * 0.4, p.size * 0.6, p.size * 0.4, 0, p.size);
  ctx.bezierCurveTo(-p.size * 0.6, p.size * 0.4, -p.size * 0.6, -p.size * 0.4, 0, -p.size);
  ctx.fill();

  ctx.restore();
}

function animatePetals() {
  ctx.clearRect(0, 0, W, H);

  for (const p of petals) {
    p.y += p.speed;
    p.x += p.drift;
    p.rot += p.rotSpeed;

    if (p.y > H + p.size * 2) {
      p.y = -p.size * 2;
      p.x = Math.random() * W;
    }

    drawPetal(p);
  }

  requestAnimationFrame(animatePetals);
}

resizeCanvas();
initPetals();
animatePetals();

window.addEventListener('resize', () => {
  resizeCanvas();
  initPetals();
});
