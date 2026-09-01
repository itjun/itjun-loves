import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  NAME_TEXT,
  LETTER,
  TIMELINE,
  LOVE_NOTES,
} from './config.js';
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

const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);
for (const el of revealEls) {
  revealObserver.observe(el);
}

const canvas = document.getElementById('petals');
const ctx = canvas.getContext('2d');

let W = 0;
let H = 0;
let dpr = 1;
let petals = [];
const PETAL_COUNT = 28;

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
    size: 6 + Math.random() * 10,
    speed: 0.4 + Math.random() * 0.8,
    drift: (Math.random() - 0.5) * 0.4,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
    alpha: 0.15 + Math.random() * 0.35,
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
  ctx.fillStyle = '#e8a0a8';

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
