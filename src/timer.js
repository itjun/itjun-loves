import { WEDDING_DATE } from './config.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 自结婚日起已过的天/时/分/秒；未到日期则全 0。 */
export function elapsedSince(from, now = Date.now()) {
  const diff = now - from.getTime();
  if (diff < 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function initTimer(root = document) {
  const daysEl = root.getElementById('days-num');
  const hoursEl = root.getElementById('hours-num');
  const minutesEl = root.getElementById('minutes-num');
  const secondsEl = root.getElementById('seconds-num');

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
    return;
  }

  function update() {
    const { days, hours, minutes, seconds } = elapsedSince(WEDDING_DATE);
    daysEl.textContent = String(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
  }

  update();
  return setInterval(update, 1000);
}
