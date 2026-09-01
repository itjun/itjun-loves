import { PAGE_LABELS, CHAPTER_ANIMS } from './config.js';

const ENTER_MS = {
  scroll: 820,
  flip: 720,
  fly: 780,
  fan: 700,
  seal: 920,
};
const LIGHT_ENTER_MS = 320;
const EXIT_FADE_MS = 220;
const EXIT_LIGHT_MS = 280;

const ENTER_CLASS_LIST = CHAPTER_ANIMS.map((name) => `chapter-enter--${name}`);
const ALL_PANEL_CLASSES = [
  'chapter-enter',
  'chapter-enter-light',
  'chapter-exit-fade',
  'chapter-exit-light',
  'is-playing',
  ...ENTER_CLASS_LIST,
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearPanelAnim(panel) {
  if (!panel) {
    return;
  }
  panel.classList.remove(...ALL_PANEL_CLASSES);
  panel.querySelectorAll('.stagger-in, .seal-stamp').forEach((el) => {
    el.classList.remove('stagger-in', 'seal-stamp');
    el.style.removeProperty('--stagger-i');
  });
}

function playStagger(panel, selector) {
  panel.querySelectorAll(selector).forEach((el, i) => {
    el.style.setProperty('--stagger-i', String(i));
    el.classList.add('stagger-in');
  });
}

/**
 * 章节模式翻页：每章专属进入动画；向前完整，向后轻退
 */
export function initPageScroll(pages, navEl, backTopBtn) {
  let currentIndex = 0;
  let isBusy = false;
  let touchStartY = 0;

  function updateNav() {
    const dots = navEl.querySelectorAll('.page-nav__dot');
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i === currentIndex);
    }
  }

  function updateBackTop() {
    backTopBtn.classList.toggle('is-visible', currentIndex > 0);
  }

  function playEnter(pageIndex, isLight) {
    const page = pages[pageIndex];
    const panel = page.querySelector('.scroll-panel');
    if (!panel) {
      return;
    }

    clearPanelAnim(panel);
    void panel.offsetWidth;
    panel.classList.add('chapter-enter', 'is-playing');

    if (isLight) {
      panel.classList.add('chapter-enter-light');
      return;
    }

    const anim = CHAPTER_ANIMS[pageIndex] || 'scroll';
    panel.classList.add(`chapter-enter--${anim}`);

    if (anim === 'flip') {
      playStagger(panel, '.timeline__item');
    }
    if (anim === 'fly') {
      playStagger(panel, '.notes__item');
    }
    if (anim === 'seal') {
      const seal = panel.querySelector('.end__seal');
      if (seal) {
        void seal.offsetWidth;
        seal.classList.add('seal-stamp');
      }
    }
  }

  async function scrollToPage(index) {
    if (index < 0 || index >= pages.length || index === currentIndex || isBusy) {
      return;
    }

    isBusy = true;
    const isForward = index > currentIndex;
    const isLight = !isForward;

    const oldPage = pages[currentIndex];
    const oldPanel = oldPage.querySelector('.scroll-panel');

    if (oldPanel) {
      oldPanel.classList.add(isLight ? 'chapter-exit-light' : 'chapter-exit-fade');
      await wait(isLight ? EXIT_LIGHT_MS : EXIT_FADE_MS);
    }

    oldPage.classList.remove('is-active');
    clearPanelAnim(oldPanel);

    currentIndex = index;
    pages[index].classList.add('is-active');
    playEnter(index, isLight);
    updateNav();
    updateBackTop();

    const anim = CHAPTER_ANIMS[index] || 'scroll';
    const dwell = isLight ? LIGHT_ENTER_MS : ENTER_MS[anim] || 700;
    await wait(dwell);

    const newPanel = pages[index].querySelector('.scroll-panel');
    if (newPanel) {
      newPanel.classList.remove('is-playing');
    }

    isBusy = false;
  }

  function goNext() {
    if (currentIndex < pages.length - 1) {
      scrollToPage(currentIndex + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      scrollToPage(currentIndex - 1);
    }
  }

  function onWheel(e) {
    const notes = e.target.closest('.notes');
    if (notes && notes.scrollHeight > notes.clientHeight) {
      const atTop = notes.scrollTop <= 0;
      const atBottom = notes.scrollTop + notes.clientHeight >= notes.scrollHeight - 1;
      if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
        return;
      }
    }

    e.preventDefault();
    if (isBusy) {
      return;
    }

    const delta = e.deltaY;
    if (Math.abs(delta) < 30) {
      return;
    }

    if (delta > 0) {
      goNext();
    } else {
      goPrev();
    }
  }

  function onKeyDown(e) {
    if (isBusy) {
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'Home') {
      e.preventDefault();
      scrollToPage(0);
    }
  }

  function onTouchStart(e) {
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (isBusy) {
      return;
    }
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) < 50) {
      return;
    }
    if (diff > 0) {
      goNext();
    } else {
      goPrev();
    }
  }

  for (let i = 0; i < pages.length; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-nav__dot';
    const label = PAGE_LABELS[i] || `第 ${i + 1} 页`;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.addEventListener('click', () => scrollToPage(i));
    navEl.appendChild(btn);
  }

  backTopBtn.addEventListener('click', () => scrollToPage(0));

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  document.documentElement.classList.add('is-stage');
  pages[0].classList.add('is-active');
  playEnter(0, false);
  updateNav();
  updateBackTop();
}
