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
const WHEEL_THRESHOLD = 30;
const TOUCH_THRESHOLD = 50;

const ENTER_CLASS_PREFIX = 'chapter-enter--';
const PANEL_ANIM_CLASSES = [
  'chapter-enter',
  'chapter-enter-light',
  'chapter-exit-fade',
  'chapter-exit-light',
];
const SCROLL_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function chapterAnim(page) {
  return page?.dataset.chapter || 'scroll';
}

function pageLabel(page, index) {
  return page?.dataset.label || `第 ${index + 1} 页`;
}

function canScrollY(node) {
  const { overflowY } = getComputedStyle(node);
  if (!SCROLL_OVERFLOW.has(overflowY)) {
    return false;
  }
  return node.scrollHeight > node.clientHeight + 1;
}

/** 若手势发生在仍能沿 deltaY 方向滚动的内部容器内，则让内层消费，不翻章。 */
function innerScrollConsumes(start, deltaY) {
  if (!start || !deltaY) {
    return false;
  }

  let node = start instanceof Element ? start : start.parentElement;
  while (node && node !== document.documentElement) {
    if (canScrollY(node)) {
      const atTop = node.scrollTop <= 0;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
        return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function stamp(el) {
  if (!el) {
    return;
  }
  void el.offsetWidth;
  el.classList.add('seal-stamp');
}

function clearPanelAnim(panel) {
  if (!panel) {
    return;
  }

  panel.classList.remove(...PANEL_ANIM_CLASSES);
  for (const cls of [...panel.classList]) {
    if (cls.startsWith(ENTER_CLASS_PREFIX)) {
      panel.classList.remove(cls);
    }
  }

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
 * 章节模式翻页：动画名与导航文案读自每章 data-chapter / data-label。
 * 向前完整章动画，向后轻退；减动效时跳过等待。
 */
export function initPageScroll(pages, navEl, backTopBtn) {
  if (!pages.length || !navEl || !backTopBtn) {
    return;
  }

  let currentIndex = 0;
  let isBusy = false;
  let touchStartY = 0;
  let touchStartTarget = null;

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
      return 0;
    }

    clearPanelAnim(panel);
    void panel.offsetWidth;
    panel.classList.add('chapter-enter');

    if (isLight) {
      panel.classList.add('chapter-enter-light');
      return LIGHT_ENTER_MS;
    }

    const anim = chapterAnim(page);
    panel.classList.add(`${ENTER_CLASS_PREFIX}${anim}`);

    if (anim === 'flip') {
      playStagger(panel, '.timeline__item');
    }
    if (anim === 'fly') {
      playStagger(panel, '.notes__item');
    }
    if (anim === 'fan') {
      stamp(panel.querySelector('.letter__seal'));
    }
    if (anim === 'seal') {
      stamp(panel.querySelector('.end__seal'));
    }

    return ENTER_MS[anim] || 700;
  }

  async function scrollToPage(index) {
    if (index < 0 || index >= pages.length || index === currentIndex || isBusy) {
      return;
    }

    isBusy = true;
    const reduce = prefersReducedMotion();
    const isLight = index < currentIndex;

    const oldPage = pages[currentIndex];
    const oldPanel = oldPage.querySelector('.scroll-panel');

    if (!reduce && oldPanel) {
      oldPanel.classList.add(isLight ? 'chapter-exit-light' : 'chapter-exit-fade');
      await wait(isLight ? EXIT_LIGHT_MS : EXIT_FADE_MS);
    }

    oldPage.classList.remove('is-active');
    clearPanelAnim(oldPanel);

    currentIndex = index;
    pages[index].classList.add('is-active');
    const dwell = reduce ? 0 : playEnter(index, isLight);
    updateNav();
    updateBackTop();

    if (dwell) {
      await wait(dwell);
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
    if (innerScrollConsumes(e.target, e.deltaY)) {
      return;
    }

    e.preventDefault();
    if (isBusy) {
      return;
    }

    const delta = e.deltaY;
    if (Math.abs(delta) < WHEEL_THRESHOLD) {
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
    touchStartTarget = e.target;
  }

  function onTouchEnd(e) {
    if (isBusy) {
      return;
    }
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) < TOUCH_THRESHOLD) {
      return;
    }
    if (innerScrollConsumes(touchStartTarget, diff)) {
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
    const label = pageLabel(pages[i], i);
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
  if (!prefersReducedMotion()) {
    playEnter(0, false);
  }
  updateNav();
  updateBackTop();
}
