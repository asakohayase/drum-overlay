'use strict';

const panel       = document.getElementById('panel');
const dragHandle  = document.getElementById('drag-handle');
const uploadBtn   = document.getElementById('upload-btn');
const playBtn     = document.getElementById('play-btn');
const trackName   = document.getElementById('track-name');
const timeDisplay = document.getElementById('time-display');
const progressBar = document.getElementById('progress-bar');
const progressFill= document.getElementById('progress-fill');
const progressThumb=document.getElementById('progress-thumb');
const padLeft     = document.getElementById('pad-left');
const padRight    = document.getElementById('pad-right');

// ── Web Audio context (lazy init to avoid autoplay block) ──
let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── Synthesised drum sounds ─────────────────────────────

function playKick() {
  const c = ctx();
  // Pitched sine sweep (bass drum body)
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  gain.gain.setValueAtTime(1.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.45);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.45);

  // Click transient
  const click = c.createOscillator();
  const cGain = c.createGain();
  click.type = 'square';
  click.frequency.value = 900;
  cGain.gain.setValueAtTime(0.4, c.currentTime);
  cGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.02);
  click.connect(cGain);
  cGain.connect(c.destination);
  click.start(c.currentTime);
  click.stop(c.currentTime + 0.02);
}

function playSnare() {
  const c = ctx();

  // White noise body
  const bufLen = Math.floor(c.sampleRate * 0.22);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;

  const noise = c.createBufferSource();
  noise.buffer = buf;

  const bpf = c.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 2200;
  bpf.Q.value = 0.6;

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.7, c.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);

  noise.connect(bpf);
  bpf.connect(noiseGain);
  noiseGain.connect(c.destination);
  noise.start();
  noise.stop(c.currentTime + 0.22);

  // Tonal crack
  const tone = c.createOscillator();
  const tGain = c.createGain();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(300, c.currentTime);
  tone.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.08);
  tGain.gain.setValueAtTime(0.4, c.currentTime);
  tGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
  tone.connect(tGain);
  tGain.connect(c.destination);
  tone.start(c.currentTime);
  tone.stop(c.currentTime + 0.08);
}

// ── Hit animation ───────────────────────────────────────
function hitPad(pad, soundFn) {
  soundFn();
  pad.classList.add('active');
  setTimeout(() => pad.classList.remove('active'), 130);
}

// ── Keyboard controls ───────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'f' || e.key === 'F') hitPad(padLeft, playKick);
  if (e.key === 'j' || e.key === 'J') hitPad(padRight, playSnare);
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

// Mouse clicks on pads (also works as fallback)
padLeft.addEventListener('mousedown',  (e) => { e.stopPropagation(); hitPad(padLeft,  playKick);  });
padRight.addEventListener('mousedown', (e) => { e.stopPropagation(); hitPad(padRight, playSnare); });

// ── Music upload ────────────────────────────────────────
uploadBtn.addEventListener('click', async () => {
  if (!window.api) return;
  const result = await window.api.pickMusic();
  if (!result) return;
  audio.src = result.dataUrl;
  audio.load();
  trackName.textContent = result.name;
  playBtn.disabled = false;
});

// ── Audio element ───────────────────────────────────────
const audio = new Audio();

audio.addEventListener('timeupdate', () => {
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progressFill.style.width = pct + '%';
  progressThumb.style.left = pct + '%';
  timeDisplay.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
});

audio.addEventListener('ended', () => {
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
});

audio.addEventListener('play',  () => { playBtn.textContent = '⏸'; playBtn.classList.add('playing'); });
audio.addEventListener('pause', () => { playBtn.textContent = '▶'; playBtn.classList.remove('playing'); });

function fmt(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Play / pause ────────────────────────────────────────
playBtn.addEventListener('click', togglePlay);

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) audio.play();
  else audio.pause();
}

// ── Progress bar seek ───────────────────────────────────
let isSeeking = false;

function seekTo(e) {
  if (!audio.duration) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
}

progressBar.addEventListener('mousedown', (e) => { isSeeking = true; seekTo(e); e.stopPropagation(); });
document.addEventListener('mousemove',    (e) => { if (isSeeking) seekTo(e); });
document.addEventListener('mouseup',      ()  => { isSeeking = false; });

// ── Drag panel ──────────────────────────────────────────
let isDragging = false;
let dragOffX = 0, dragOffY = 0;

dragHandle.addEventListener('mousedown', (e) => {
  isDragging = true;
  const rect = panel.getBoundingClientRect();
  dragOffX = e.clientX - rect.left;
  dragOffY = e.clientY - rect.top;
  // Switch from bottom/transform to top/left absolute positioning
  panel.style.bottom    = 'auto';
  panel.style.transform = 'none';
  panel.style.left      = rect.left + 'px';
  panel.style.top       = rect.top  + 'px';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    panel.style.left = (e.clientX - dragOffX) + 'px';
    panel.style.top  = (e.clientY - dragOffY) + 'px';
  }

  // Click-through: interactive only when over the panel
  const r = panel.getBoundingClientRect();
  const pad = 10;
  const over = isDragging || isSeeking ||
    (e.clientX >= r.left - pad && e.clientX <= r.right  + pad &&
     e.clientY >= r.top  - pad && e.clientY <= r.bottom + pad);

  if (window.api) window.api.setInteractive(over);
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  isSeeking  = false;
});
