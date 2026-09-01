import './style.css';
import {
  LOVE_WORDS,
  SINCE_TEXT,
  END_TITLE,
  END_HINT,
  NAME_TEXT,
  LETTER,
  TIMELINE,
  LOVE_NOTES,
} from './config.js';
import { initPageScroll } from './scroll.js';
import { initTimer } from './timer.js';
import { initPetals } from './petals.js';

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = text;
  }
}

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

function hydrate() {
  setText('love-words', LOVE_WORDS);
  setText('since', SINCE_TEXT);
  setText('footer-since', SINCE_TEXT);
  setText('end-title', END_TITLE);
  setText('end-hint', END_HINT);
  setText('name-mark', NAME_TEXT);
  setText('letter-body', LETTER.body);
  setText('letter-sign', LETTER.sign);

  const timelineEl = document.getElementById('timeline');
  if (timelineEl) {
    for (const item of TIMELINE) {
      const li = el('li', 'timeline__item');
      const content = el('div', 'timeline__content');
      content.append(el('h3', null, item.title), el('p', null, item.desc));
      li.append(el('time', 'timeline__date', item.date), content);
      timelineEl.appendChild(li);
    }
  }

  const notesEl = document.getElementById('notes-grid');
  if (notesEl) {
    for (const note of LOVE_NOTES) {
      notesEl.appendChild(el('span', 'notes__item', note));
    }
  }
}

hydrate();
initTimer();
initPageScroll(
  Array.from(document.querySelectorAll('.page')),
  document.getElementById('page-nav'),
  document.getElementById('back-top'),
);
initPetals(document.getElementById('petals'));
