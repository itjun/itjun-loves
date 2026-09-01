import { PAGE_LABELS } from './config.js';

const CLOSE_MS = 480;
const OPEN_MS = 620;
const FAN_MS = 700;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 竹帘开合 + 扇面展开的全屏翻页
 */
export function initPageScroll(pages, navEl, backTopBtn) {
  let currentIndex = 0;
  let isBusy = false;
  let touchStartY = 0;
  const curtain = document.getElementById('curtain');
  const strips = curtain.querySelectorAll('.curtain__strip');

  // 条幅错开延迟，更有竹帘感
  strips.forEach((strip, i) => {
    const delay = Math.abs(i - (strips.length - 1) / 2) * 0.04;
    strip.style.setProperty('--strip-delay', `${delay}s`);
  });

  function updateNav() {
    const dots = navEl.querySelectorAll('.page-nav__dot');
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i === currentIndex);
    }
  }

  function updateBackTop() {
    backTopBtn.classList.toggle('is-visible', currentIndex > 0);
  }

  function setActivePage(index, direction) {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const panel = page.querySelector('.scroll-panel');
      const isActive = i === index;

      page.classList.toggle('is-active', isActive);
      page.classList.remove('fan-from-left', 'fan-from-right');

      if (panel) {
        panel.classList.remove('is-fanning');
      }

      if (isActive) {
        const fanClass = direction === 'prev' ? 'fan-from-left' : 'fan-from-right';
        page.classList.add(fanClass);
        if (panel) {
          // 强制重播扇面动画
          void panel.offsetWidth;
          panel.classList.add('is-fanning');
        }
      }
    }
  }

  async function scrollToPage(index, direction = 'next') {
    if (index < 0 || index >= pages.length || index === currentIndex || isBusy) {
      return;
    }

    isBusy = true;
    const dir = direction === 'prev' ? 'prev' : 'next';

    // 1. 竹帘落下盖住当前页
    curtain.classList.add('is-visible');
    void curtain.offsetWidth;
    curtain.classList.add('is-closed');
    await wait(CLOSE_MS);

    // 2. 切换页面，准备扇面展开
    currentIndex = index;
    setActivePage(index, dir);
    updateNav();
    updateBackTop();

    // 3. 竹帘掀开，露出新页扇面
    curtain.classList.remove('is-closed');
    await wait(OPEN_MS);

    curtain.classList.remove('is-visible');
    await wait(FAN_MS - 200);

    isBusy = false;
  }

  function goNext() {
    if (currentIndex < pages.length - 1) {
      scrollToPage(currentIndex + 1, 'next');
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      scrollToPage(currentIndex - 1, 'prev');
    }
  }

  function onWheel(e) {
    // 情话列表内部滚动时不翻页
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
      scrollToPage(0, 'prev');
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
    btn.addEventListener('click', () => {
      const dir = i < currentIndex ? 'prev' : 'next';
      scrollToPage(i, dir);
    });
    navEl.appendChild(btn);
  }

  backTopBtn.addEventListener('click', () => scrollToPage(0, 'prev'));

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  // 初始：只显示第一页，禁止原生滚动
  document.documentElement.classList.add('is-stage');
  setActivePage(0, 'next');
  updateNav();
  updateBackTop();
}
