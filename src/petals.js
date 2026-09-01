const BLOSSOM_COUNT = 18;
const PETAL = '#d06068';
const PISTIL = '#c9a45c';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 宣纸底上的梅花飘落。减动效时不启动循环。
 */
export function initPetals(canvas) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx || prefersReducedMotion()) {
    return;
  }

  let W = 0;
  let H = 0;
  let dpr = 1;
  let blossoms = [];

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

  function drawBlossom(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = PETAL;

    const r = b.size;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.7, r * 0.45, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = PISTIL;
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
}
