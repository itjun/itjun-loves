import './style.css';
import { LOVE_WORDS, SINCE_TEXT } from './config.js';
import { createScene } from './scene.js';
import './timer.js';

document.getElementById('love-words').textContent = LOVE_WORDS;
document.getElementById('since').textContent = SINCE_TEXT;

const canvas = document.getElementById('scene');
createScene(canvas);
