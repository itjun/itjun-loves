import { WEDDING_DATE } from './config.js';

const daysEl = document.getElementById('days-num');
const hoursEl = document.getElementById('hours-num');
const minutesEl = document.getElementById('minutes-num');
const secondsEl = document.getElementById('seconds-num');

function pad(n) {
  return String(n).padStart(2, '0');
}

function update() {
  const diff = Date.now() - WEDDING_DATE.getTime();
  if (diff < 0) {
    daysEl.textContent = '0';
    hoursEl.textContent = '00';
    minutesEl.textContent = '00';
    secondsEl.textContent = '00';
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  daysEl.textContent = String(days);
  hoursEl.textContent = pad(hours);
  minutesEl.textContent = pad(minutes);
  secondsEl.textContent = pad(seconds);
}

update();
setInterval(update, 1000);
