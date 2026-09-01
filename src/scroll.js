import { PAGE_LABELS } from './config.js';

/**
 * 全屏分页滚动：滚轮/触控板一次翻一页
 */
export function initPageScroll(pages, navEl, backTopBtn) {
  let currentIndex = 0;
  let isScrolling = false;
  let touchStartY = 0;

  function scrollToPage(index, smooth = true) {
    if (index < 0 || index >= pages.length) {
      return;
    }
    currentIndex = index;
    pages[index].scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
    updateNav();
    updateBackTop();
  }

  function updateNav() {
    const dots = navEl.querySelectorAll('.page-nav__dot');
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i === currentIndex);
    }
  }

  function updateBackTop() {
    backTopBtn.classList.toggle('is-visible', currentIndex > 0);
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
    if (isScrolling) {
      e.preventDefault();
      return;
    }

    const delta = e.deltaY;
    if (Math.abs(delta) < 30) {
      return;
    }

    e.preventDefault();
    isScrolling = true;

    if (delta > 0) {
      goNext();
    } else {
      goPrev();
    }

    setTimeout(() => {
      isScrolling = false;
    }, 900);
  }

  function onKeyDown(e) {
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

  // 构建右侧导航圆点
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

  // 同步当前页（例如浏览器刷新后位置）
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const idx = pages.indexOf(entry.target);
          if (idx >= 0 && idx !== currentIndex) {
            currentIndex = idx;
            updateNav();
            updateBackTop();
          }
        }
      }
    },
    { threshold: 0.5 }
  );

  for (const page of pages) {
    observer.observe(page);
  }

  updateNav();
  updateBackTop();
}
