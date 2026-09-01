import './style.css';
import { NAME, HINT, LETTER } from './config.js';

const cover = document.getElementById('cover');
const letterEl = document.getElementById('letter');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

function line(text) {
  return el('p', 'letter__line', text);
}

function renderCover() {
  const nameEl = document.getElementById('cover-name');
  const sealEl = document.getElementById('cover-seal');
  const hintEl = document.getElementById('cover-hint');
  if (nameEl) {
    nameEl.textContent = NAME;
  }
  if (sealEl) {
    for (const ch of NAME) {
      sealEl.appendChild(el('span', 'cover__seal-char', ch));
    }
  }
  if (hintEl) {
    hintEl.textContent = HINT;
  }
}

function renderLetter() {
  const greeting = el('p', 'letter__greeting letter__line', LETTER.greeting);
  const apology = el('section', 'letter__section');
  for (const text of LETTER.apology) {
    apology.appendChild(line(text));
  }
  const thanks = el('section', 'letter__section');
  for (const text of LETTER.thanks) {
    thanks.appendChild(line(text));
  }
  const sign = el('p', 'letter__sign letter__line', LETTER.sign);

  letterEl.append(greeting, apology, thanks, sign);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function revealLines() {
  const lines = letterEl.querySelectorAll('.letter__line');
  if (prefersReducedMotion()) {
    lines.forEach((node) => node.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.35, rootMargin: '0px 0px -10% 0px' },
  );

  lines.forEach((node) => io.observe(node));
}

function openLetter() {
  if (!document.body.classList.contains('is-closed')) {
    return;
  }

  const reduce = prefersReducedMotion();
  document.body.classList.remove('is-closed');
  document.body.classList.add(reduce ? 'is-open' : 'is-opening');
  cover.setAttribute('aria-hidden', 'true');
  cover.tabIndex = -1;

  let settled = false;
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    document.body.classList.remove('is-opening');
    document.body.classList.add('is-open');
    cover.hidden = true;
    letterEl.focus({ preventScroll: true });
  };

  revealLines();

  if (reduce) {
    finish();
    return;
  }

  cover.addEventListener('animationend', (event) => {
    if (event.target === cover) {
      finish();
    }
  });
  window.setTimeout(finish, 1100);
}

renderCover();
renderLetter();
cover.addEventListener('click', openLetter);
