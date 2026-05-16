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

function playStick(accent = false) {
  const c = ctx();
  const bufLen = Math.floor(c.sampleRate * 0.006);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const hpf = c.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 5500;
  const gain = c.createGain();
  gain.gain.value = accent ? 1.4 : 0.85;
  src.connect(hpf); hpf.connect(gain); gain.connect(c.destination);
  src.start();
}

// ── Hit animation ───────────────────────────────────────
function hitPad(pad, soundFn, type) {
  soundFn();
  pad.classList.add('active');
  setTimeout(() => pad.classList.remove('active'), 130);
  hitFlash[type] = 8;
  onHit(type);
}

// ── Keyboard controls ───────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'f' || e.key === 'F') hitPad(padLeft,  playKick,  'kick');
  if (e.key === 'j' || e.key === 'J') hitPad(padRight, playSnare, 'snare');
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

// Mouse clicks on pads (also works as fallback)
padLeft.addEventListener('mousedown',  (e) => { e.stopPropagation(); hitPad(padLeft,  playKick,  'kick');  });
padRight.addEventListener('mousedown', (e) => { e.stopPropagation(); hitPad(padRight, playSnare, 'snare'); });

// ── Music upload ────────────────────────────────────────
uploadBtn.addEventListener('click', async () => {
  if (!window.api) return;
  const result = await window.api.pickMusic();
  if (!result) return;
  audio.src = result.dataUrl;
  audio.load();
  trackName.textContent = result.name;
  playBtn.disabled = false;
  resetGame();
  analyzeSong(result.dataUrl);
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

// ── Count-in ────────────────────────────────────────────

function cancelCountIn() {
  countInTimers.forEach(clearTimeout);
  countInTimers = [];
  countInBeat  = -1;
  countInFlash = 0;
}

function startCountIn() {
  cancelCountIn();
  const beatMs = (60000 / bpm) * 1.5; // 1.5× slower than song tempo
  COUNT_LABELS.forEach((_, i) => {
    countInTimers.push(setTimeout(() => {
      countInBeat  = i;
      countInFlash = 1.0;
      playStick(i === 0 || i === 2); // accent "3" and "1"
    }, i * beatMs));
  });
  countInTimers.push(setTimeout(() => {
    countInBeat  = -1;
    countInFlash = 0;
    countInTimers = [];
    audio.currentTime = 0;
    audio.play().catch(err => console.error('play failed:', err));
  }, COUNT_LABELS.length * beatMs));
}

// ── Play / pause ────────────────────────────────────────
playBtn.addEventListener('click', togglePlay);

function togglePlay() {
  if (!audio.src) return;
  if (countInBeat >= 0) { cancelCountIn(); return; }
  if (audio.paused) {
    if (audio.currentTime < 0.5) {
      resetGame();
      startCountIn();
    } else {
      audio.play();
    }
  } else {
    audio.pause();
  }
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

// Whole panel is draggable — skip only the interactive controls
panel.addEventListener('mousedown', (e) => {
  if (e.target.closest('.pad') ||
      e.target.closest('.progress-bar') ||
      e.target.closest('.play-btn') ||
      e.target.closest('.icon-btn') ||
      e.target.closest('.taiko-row')) return;

  isDragging = true;
  const rect = panel.getBoundingClientRect();
  dragOffX = e.clientX - rect.left;
  dragOffY = e.clientY - rect.top;
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

// ── Taiko Lane ────────────────────────────────────────────

const taikoCanvas = document.getElementById('taiko-canvas');
const bpmInput    = document.getElementById('bpm-input');

const LANE_W    = 436;
const LANE_H    = 120;
const KICK_Y    = 30;
const SNARE_Y   = 90;
const DIVIDER_Y = 60;
const TARGET_X  = 58;
const NOTE_R    = 18;
const LOOKAHEAD = 2.0;

let bpm         = 120;
let songEvents  = null;   // null = metronome fallback; array = detected events
let isAnalyzing = false;
const hitFlash     = { kick: 0, snare: 0 };

let countInBeat    = -1;   // -1 = inactive, 0-5 = current beat
let countInFlash   = 0;    // 1→0, decays each frame for pulse effect
let countInTimers  = [];
const COUNT_LABELS = ['3','2','1'];

let missFlash  = 0;        // red flash intensity on miss
let failMode   = false;
let missCount  = 0;
let gameFailed = false;
const FAIL_LIMIT = 3;

const taikoCx = (() => {
  const dpr = window.devicePixelRatio || 1;
  taikoCanvas.width  = LANE_W * dpr;
  taikoCanvas.height = LANE_H * dpr;
  taikoCanvas.style.width  = LANE_W + 'px';
  taikoCanvas.style.height = LANE_H + 'px';
  const cx = taikoCanvas.getContext('2d');
  cx.scale(dpr, dpr);
  return cx;
})();

bpmInput.addEventListener('input', () => {
  const v = parseInt(bpmInput.value, 10);
  if (v >= 40 && v <= 300) bpm = v;
});
bpmInput.addEventListener('mousedown', e => e.stopPropagation());

const failBtn = document.getElementById('fail-btn');
failBtn.addEventListener('click', () => {
  failMode = !failMode;
  failBtn.textContent = failMode ? 'HARD' : 'NORMAL';
  failBtn.classList.toggle('active', failMode);
});
failBtn.addEventListener('mousedown', e => e.stopPropagation());

// ── Theme system ────────────────────────────────────────

const THEMES = [
  { name: 'Lime',    kick: { h: 88,  s: 100, l: 50 }, snare: { h: 215, s: 100, l: 58 } },
  { name: 'Classic', kick: { h: 18,  s: 100, l: 52 }, snare: { h: 215, s: 100, l: 58 } },
  { name: 'Forest',  kick: { h: 145, s: 100, l: 42 }, snare: { h: 215, s: 100, l: 58 } },
  { name: 'Neon',    kick: { h: 310, s: 100, l: 55 }, snare: { h: 185, s: 100, l: 50 } },
  { name: 'Dusk',    kick: { h: 275, s: 72,  l: 60 }, snare: { h: 170, s: 80,  l: 48 } },
];
let themeIdx = 0;

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function applyTheme(theme) {
  const root = document.documentElement;
  for (const [pre, c] of [['k', theme.kick], ['s', theme.snare]]) {
    const { h, s, l } = c;
    const lc  = (d) => Math.min(Math.max(l + d, 8), 92);
    const [r, g, b] = hslToRgb(h, s, l);
    root.style.setProperty(`--${pre}-rgb`,     `${r},${g},${b}`);
    root.style.setProperty(`--${pre}-bg1`,     `hsl(${h},${s}%,8%)`);
    root.style.setProperty(`--${pre}-bg2`,     `hsl(${h},${s}%,3%)`);
    root.style.setProperty(`--${pre}-act-bdr`, `hsla(${h},${s}%,${lc(15)}%,0.95)`);
    root.style.setProperty(`--${pre}-key`,     `hsl(${h},${s}%,${lc(10)}%)`);
    root.style.setProperty(`--${pre}-key-act`, `hsl(${h},${s}%,${lc(25)}%)`);
    root.style.setProperty(`--${pre}-ts1`,     `hsl(${h},${s}%,${lc(5)}%)`);
    root.style.setProperty(`--${pre}-ts2`,     `hsl(${h},${s}%,${lc(-10)}%)`);
  }
  root.style.setProperty('--prog-from', `hsl(${theme.snare.h},${theme.snare.s}%,${theme.snare.l}%)`);
  root.style.setProperty('--prog-to',   `hsl(${theme.kick.h},${theme.kick.s}%,${theme.kick.l}%)`);
}

// Derive all canvas colors from the current theme
function themeColor(isKick) {
  const { h, s, l } = THEMES[themeIdx][isKick ? 'kick' : 'snare'];
  const lc = (d) => Math.min(Math.max(l + d, 8), 92);
  return {
    glow:       `hsla(${h},${s}%,${l}%,0.25)`,
    light:      `hsl(${h},${s}%,${lc(22)}%)`,
    base:       `hsl(${h},${s}%,${l}%)`,
    dark:       `hsl(${h},${s}%,${lc(-15)}%)`,
    targetGlow: `hsla(${h},${s}%,${l}%,0.28)`,
    targetRing: `hsla(${h},${s}%,${lc(15)}%,0.95)`,
    targetText: `hsl(${h},${s}%,${lc(25)}%)`,
    laneTint:   `hsla(${h},${s}%,${l}%,0.04)`,
  };
}

// Build theme-picker dropdown
const themePicker = document.getElementById('theme-picker');
const themeSelect = document.createElement('select');
themeSelect.className = 'theme-select';
THEMES.forEach((theme, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = theme.name;
  themeSelect.appendChild(opt);
});
themeSelect.value = '0';
themeSelect.addEventListener('change', () => {
  themeIdx = parseInt(themeSelect.value, 10);
  applyTheme(THEMES[themeIdx]);
});
themeSelect.addEventListener('mousedown', e => e.stopPropagation());
themePicker.appendChild(themeSelect);

// ── Audio analysis ──────────────────────────────────────

async function detectOnsets(audioBuffer, filterType, freq, q, minGapSec = 0.12, percentile = 0.97) {
  const sr  = audioBuffer.sampleRate;
  const len = audioBuffer.length;

  const offCtx = new OfflineAudioContext(1, len, sr);
  const src = offCtx.createBufferSource();
  src.buffer = audioBuffer;

  const filt = offCtx.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = freq;
  filt.Q.value = q;
  src.connect(filt);
  filt.connect(offCtx.destination);
  src.start(0);

  const rendered = await offCtx.startRendering();
  const raw = rendered.getChannelData(0);

  // RMS energy: 10ms windows, 5ms hop for good time resolution
  const hop     = Math.floor(sr * 0.005);
  const win     = Math.floor(sr * 0.010);
  const nFrames = Math.floor((len - win) / hop);

  const energy = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    const s = i * hop;
    let e = 0;
    for (let j = 0; j < win; j++) e += raw[s + j] ** 2;
    energy[i] = Math.sqrt(e / win);
  }

  // Onset strength = half-wave rectified first difference of energy.
  // Drum hits are transients (sudden energy jumps), not sustained loud frames,
  // so diffing is far more robust than thresholding raw energy.
  const strength = new Float32Array(nFrames);
  for (let i = 1; i < nFrames; i++) {
    strength[i] = Math.max(0, energy[i] - energy[i - 1]);
  }

  // Percentile threshold on positive-only values.
  // More robust than mean+k*std: directly says "top X% of spikes count."
  const positives = [];
  for (let i = 0; i < nFrames; i++) if (strength[i] > 0) positives.push(strength[i]);
  positives.sort((a, b) => a - b);
  const threshold = positives.length
    ? positives[Math.floor(positives.length * percentile)]
    : 0;

  // Pick local maxima above threshold
  const minGap = Math.ceil(minGapSec / (hop / sr));
  const onsets  = [];
  let lastOnset = -minGap;

  for (let i = 1; i < nFrames - 1; i++) {
    if (strength[i] > threshold &&
        strength[i] >= strength[i - 1] &&
        strength[i] >  strength[i + 1] &&
        i - lastOnset >= minGap) {
      onsets.push(i * hop / sr);
      lastOnset = i;
    }
  }
  return onsets;
}

function estimateBPM(kickTimes) {
  if (kickTimes.length < 4) return 120;
  const scores = new Map();
  for (let i = 1; i < kickTimes.length; i++) {
    const ioi = kickTimes[i] - kickTimes[i - 1];
    if (ioi < 0.1 || ioi > 4.0) continue;
    // An IOI spanning n beats implies BPM = 60*n/ioi
    for (let n = 1; n <= 4; n++) {
      const b = Math.round(60 * n / ioi);
      if (b >= 60 && b <= 200) scores.set(b, (scores.get(b) || 0) + 1);
    }
  }
  let best = 120, top = 0;
  for (const [b, s] of scores) if (s > top) { top = s; best = b; }
  return best;
}

async function analyzeSong(dataUrl) {
  isAnalyzing = true;
  songEvents  = null;
  try {
    const resp = await fetch(dataUrl);
    const ab   = await resp.arrayBuffer();
    const buf  = await ctx().decodeAudioData(ab);

    // Kick: top 2% of low-freq spikes (< 100 Hz), 220ms min gap.
    // Snare: top 3% of mid-freq spikes (bandpass ~1.6-3.3 kHz), 220ms min gap.
    const [kickTimes, snareTimes] = await Promise.all([
      detectOnsets(buf, 'lowpass',  100, 1.0, 0.22, 0.98),
      detectOnsets(buf, 'bandpass', 2500, 1.5, 0.22, 0.97),
    ]);

    console.log(`[drum] kick: ${kickTimes.length}  snare: ${snareTimes.length}  duration: ${buf.duration.toFixed(1)}s`);

    // Drop snare onsets that coincide with a kick (within 60ms)
    const snareFiltered = snareTimes.filter(st =>
      !kickTimes.some(kt => Math.abs(kt - st) < 0.06)
    );

    songEvents = [
      ...kickTimes.map(t => ({ time: t, type: 'kick' })),
      ...snareFiltered.map(t => ({ time: t, type: 'snare' })),
    ].sort((a, b) => a.time - b.time);

    bpm = estimateBPM(kickTimes);
    bpmInput.value = bpm;
    console.log(`[drum] BPM: ${bpm}  total events: ${songEvents.length}`);
  } catch (err) {
    console.error('Audio analysis failed:', err);
    songEvents = null;
  }
  isAnalyzing = false;
}

// ── Note stream ─────────────────────────────────────────

function visibleNotes(t) {
  if (songEvents) {
    return songEvents.filter(e => e.time >= t - 0.4 && e.time <= t + LOOKAHEAD);
  }
  // Metronome fallback (used before analysis finishes or if it fails)
  const s  = 60 / bpm;
  const lo = Math.floor((t - 0.4) / s);
  const hi = Math.ceil( (t + LOOKAHEAD) / s);
  const notes = [];
  for (let b = lo; b <= hi; b++) {
    notes.push({ time: b * s, type: (((b % 2) + 2) % 2) === 0 ? 'kick' : 'snare' });
  }
  return notes;
}

// ── Drawing helpers ─────────────────────────────────────

function drawTarget(cx, x, y, key, isKick, active) {
  const c = themeColor(isKick);
  if (active) {
    cx.beginPath();
    cx.arc(x, y, NOTE_R + 14, 0, Math.PI * 2);
    cx.fillStyle = c.targetGlow;
    cx.fill();
  }
  cx.beginPath();
  cx.arc(x, y, NOTE_R + 4, 0, Math.PI * 2);
  cx.strokeStyle = active ? c.targetRing : 'rgba(255,255,255,0.22)';
  cx.lineWidth   = 2.5;
  cx.stroke();

  cx.beginPath();
  cx.arc(x, y, NOTE_R, 0, Math.PI * 2);
  cx.fillStyle = 'rgba(15,15,28,0.96)';
  cx.fill();

  cx.fillStyle    = active ? c.targetText : 'rgba(255,255,255,0.38)';
  cx.font         = 'bold 13px "Arial Black", Arial';
  cx.textAlign    = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(key, x, y);
}

function drawNote(cx, nx, ny, isKick, past) {
  const c = themeColor(isKick);
  cx.globalAlpha = past ? 0.28 : 1.0;

  cx.beginPath();
  cx.arc(nx, ny, NOTE_R + 7, 0, Math.PI * 2);
  cx.fillStyle = c.glow;
  cx.fill();

  cx.beginPath();
  cx.arc(nx, ny, NOTE_R, 0, Math.PI * 2);
  const g = cx.createRadialGradient(nx - 5, ny - 5, 2, nx, ny, NOTE_R);
  g.addColorStop(0, c.light);
  g.addColorStop(1, c.dark);
  cx.fillStyle = g;
  cx.fill();
  cx.strokeStyle  = 'rgba(255,255,255,0.38)';
  cx.lineWidth    = 1.5;
  cx.stroke();

  cx.fillStyle    = 'rgba(255,255,255,0.90)';
  cx.font         = 'bold 12px "Arial Black", Arial';
  cx.textAlign    = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(isKick ? 'F' : 'J', nx, ny);

  cx.globalAlpha = 1;
}

// ── Hit detection & scoring ─────────────────────────────

const HIT_PERFECT  = 0.065; // ±65 ms counts as perfect
const HIT_GOOD     = 0.130; // ±130 ms counts as good
const STREAK_BURST = 4;     // consecutive perfects before explosion

let score        = 0;
let streak       = 0;
let maxStreak    = 0;
let totalPerfect = 0;
let totalGood    = 0;
const hitNotes   = new Set();
let gameOver     = false;
let hitFeedback  = null; // { text, y, life }
let missIdx      = 0;    // pointer into songEvents for miss detection

function resetGame() {
  cancelCountIn();
  score = 0; streak = 0; maxStreak = 0;
  totalPerfect = 0; totalGood = 0;
  hitNotes.clear();
  particles.length = 0;
  gameOver    = false;
  gameFailed  = false;
  hitFeedback = null;
  missFlash   = 0;
  missCount   = 0;
  missIdx     = 0;
}

function tryHit(type, t) {
  if (!songEvents) return null;
  let best = null, bestDist = Infinity;
  for (const note of songEvents) {
    if (note.type !== type || hitNotes.has(note.time)) continue;
    const d = Math.abs(note.time - t);
    if (d < bestDist && d <= HIT_GOOD) { bestDist = d; best = note; }
  }
  if (!best) return null;
  hitNotes.add(best.time);
  return bestDist <= HIT_PERFECT ? 'perfect' : 'good';
}

function onHit(type) {
  if (!songEvents || gameOver) return;
  const result = tryHit(type, audio.currentTime);
  const ny = type === 'kick' ? KICK_Y : SNARE_Y;
  if (result === 'perfect') {
    score += 300;
    streak++;
    totalPerfect++;
    maxStreak = Math.max(maxStreak, streak);
    hitFeedback = { text: 'PERFECT!', y: ny, life: 1.0 };
    if (streak % STREAK_BURST === 0) triggerExplosion(TARGET_X, ny, streak);
  } else if (result === 'good') {
    score += 100;
    totalGood++;
    streak = 0;
    hitFeedback = { text: 'GOOD', y: ny, life: 1.0 };
  } else {
    streak = 0;
  }
}

// ── Particles ───────────────────────────────────────────

const BURST_COLORS = [
  '#FFD700','#7FFF00','#4ECDC4','#45B7D1',
  '#A8E6CF','#88FF88','#00FFAA','#88CCFF',
];
const particles = [];

function triggerExplosion(x, y, streakNow) {
  const count = Math.min(12 + streakNow * 3, 40);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.3;
    const speed = 1.5 + Math.random() * (2.5 + Math.min(streakNow * 0.25, 3.5));
    particles.push({
      x, y,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 1.2,
      life:  1.0,
      decay: 0.016 + Math.random() * 0.014,
      r:     2.5 + Math.random() * 3,
      color: BURST_COLORS[i % BURST_COLORS.length],
      star:  Math.random() < 0.45,
    });
  }
}

function drawStar(cx, x, y, r) {
  cx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a1 = (k * Math.PI * 2 / 5) - Math.PI / 2;
    const a2 = a1 + Math.PI / 5;
    k === 0
      ? cx.moveTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r)
      : cx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
    cx.lineTo(x + Math.cos(a2) * r * 0.42, y + Math.sin(a2) * r * 0.42);
  }
  cx.closePath();
  cx.fill();
}

function updateParticles(cx) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    cx.globalAlpha = p.life * p.life;
    cx.fillStyle   = p.color;
    if (p.star) drawStar(cx, p.x, p.y, p.r * p.life);
    else { cx.beginPath(); cx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); cx.fill(); }
  }
  cx.globalAlpha = 1;
}

// ── End-of-song score overlay ───────────────────────────

function drawScoreOverlay(cx) {
  if (gameFailed) {
    cx.fillStyle = 'rgba(18,4,4,0.93)';
    cx.fillRect(0, 0, LANE_W, LANE_H);
    cx.font         = 'bold 52px "Arial Black", Arial';
    cx.textAlign    = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle    = '#FF3333';
    cx.fillText('FAILED', LANE_W / 2, LANE_H / 2 - 10);
    cx.font         = '11px Arial';
    cx.fillStyle    = 'rgba(255,255,255,0.45)';
    cx.fillText(`missed ${missCount} of ${FAIL_LIMIT} allowed`, LANE_W / 2, LANE_H / 2 + 18);
    return;
  }

  const hit   = totalPerfect + totalGood;
  const total = songEvents ? songEvents.length : 0;
  const acc   = total > 0 ? Math.round(hit / total * 100) : 0;
  const rating = acc >= 95 ? 'S' : acc >= 80 ? 'A' : acc >= 65 ? 'B' : acc >= 45 ? 'C' : 'D';
  const rCol   = { S:'#FFD700', A:'#7FFF00', B:'#4ECDC4', C:'#88CCFF', D:'#AAAAAA' }[rating];

  cx.fillStyle = 'rgba(4,8,20,0.90)';
  cx.fillRect(0, 0, LANE_W, LANE_H);

  // Rating letter
  cx.font          = 'bold 62px "Arial Black", Arial';
  cx.textBaseline  = 'middle';
  cx.textAlign     = 'left';
  cx.fillStyle     = rCol;
  cx.fillText(rating, 18, LANE_H / 2);

  // Score + stats
  cx.textAlign = 'center';
  const cx2    = LANE_W * 0.57;

  cx.font      = 'bold 20px "Arial Black", Arial';
  cx.fillStyle = 'rgba(255,255,255,0.95)';
  cx.fillText(score.toLocaleString() + ' pts', cx2, LANE_H / 2 - 22);

  cx.font      = '11px Arial';
  cx.fillStyle = 'rgba(255,255,255,0.68)';
  cx.fillText(`${acc}% accuracy  ·  ${hit} / ${total} notes`, cx2, LANE_H / 2 + 2);
  cx.fillText(`perfect ${totalPerfect}  ·  good ${totalGood}  ·  max streak ×${maxStreak}`, cx2, LANE_H / 2 + 20);
}

// ── Main draw ───────────────────────────────────────────

function drawTaiko(t) {
  const cx    = taikoCx;
  const railX = TARGET_X + NOTE_R + 10;
  cx.clearRect(0, 0, LANE_W, LANE_H);

  // Song-ended: show score + let particles finish
  if (gameOver) {
    drawScoreOverlay(cx);
    updateParticles(cx);
    return;
  }

  // Advance miss pointer — notes that slipped past without a hit reset the streak
  if (songEvents && t > 0) {
    while (missIdx < songEvents.length &&
           songEvents[missIdx].time < t - HIT_GOOD) {
      if (!hitNotes.has(songEvents[missIdx].time)) {
        streak = 0;
        missFlash = 1.0;
        if (failMode) {
          missCount++;
          if (missCount >= FAIL_LIMIT) {
            gameOver   = true;
            gameFailed = true;
            audio.pause();
          }
        }
      }
      missIdx++;
    }
  }

  // Lane tints
  cx.fillStyle = themeColor(true).laneTint;
  cx.fillRect(0, 0, LANE_W, DIVIDER_Y);
  cx.fillStyle = themeColor(false).laneTint;
  cx.fillRect(0, DIVIDER_Y, LANE_W, LANE_H - DIVIDER_Y);

  // Miss flash — red overlay that fades out
  if (missFlash > 0) {
    cx.fillStyle = `rgba(220,20,20,${missFlash * 0.28})`;
    cx.fillRect(0, 0, LANE_W, LANE_H);
    missFlash = Math.max(0, missFlash - 0.07);
  }

  // Lane divider
  cx.strokeStyle = 'rgba(255,255,255,0.09)';
  cx.lineWidth   = 1;
  cx.beginPath();
  cx.moveTo(0, DIVIDER_Y); cx.lineTo(LANE_W, DIVIDER_Y);
  cx.stroke();

  // Dashed centerlines
  cx.strokeStyle = 'rgba(255,255,255,0.04)';
  cx.setLineDash([3, 9]);
  cx.beginPath();
  cx.moveTo(railX, KICK_Y);  cx.lineTo(LANE_W - 4, KICK_Y);
  cx.moveTo(railX, SNARE_Y); cx.lineTo(LANE_W - 4, SNARE_Y);
  cx.stroke();
  cx.setLineDash([]);

  // Target / scroll separator
  cx.strokeStyle = 'rgba(255,255,255,0.13)';
  cx.lineWidth   = 1;
  cx.beginPath();
  cx.moveTo(railX, 5); cx.lineTo(railX, LANE_H - 5);
  cx.stroke();

  // Targets
  drawTarget(cx, TARGET_X, KICK_Y,  'F', true,  hitFlash.kick  > 0);
  drawTarget(cx, TARGET_X, SNARE_Y, 'J', false, hitFlash.snare > 0);

  // Notes — skip ones already hit
  for (const note of visibleNotes(t)) {
    if (hitNotes.has(note.time)) continue;
    const nx = TARGET_X + (note.time - t) / LOOKAHEAD * (LANE_W - TARGET_X);
    if (nx < -NOTE_R || nx > LANE_W + NOTE_R) continue;
    drawNote(cx, nx, note.type === 'kick' ? KICK_Y : SNARE_Y,
             note.type === 'kick', note.time < t - 0.06);
  }

  // Particles (float over notes)
  updateParticles(cx);

  // Hit feedback text floats up from the target
  if (hitFeedback) {
    hitFeedback.life -= 0.038;
    if (hitFeedback.life <= 0) {
      hitFeedback = null;
    } else {
      const yOff = (1 - hitFeedback.life) * 14;
      cx.globalAlpha  = Math.min(1, hitFeedback.life * 2);
      cx.fillStyle    = hitFeedback.text === 'PERFECT!' ? '#FFD700' : '#4ECDC4';
      cx.font         = 'bold 11px "Arial Black", Arial';
      cx.textAlign    = 'left';
      cx.textBaseline = 'middle';
      cx.fillText(hitFeedback.text, railX + 4, hitFeedback.y - yOff);
      cx.globalAlpha  = 1;
    }
  }

  // Streak counter (top-right, shows when ≥ 2)
  if (streak >= 2) {
    cx.fillStyle    = '#FFD700';
    cx.font         = 'bold 10px "Arial Black", Arial';
    cx.textAlign    = 'right';
    cx.textBaseline = 'top';
    cx.fillText(`×${streak}`, LANE_W - 6, 5);
  }

  // Fail-mode miss counter (top-left)
  if (failMode && songEvents) {
    const remaining = FAIL_LIMIT - missCount;
    cx.fillStyle    = remaining <= 1 ? 'rgba(255,70,70,0.95)' : 'rgba(255,160,160,0.60)';
    cx.font         = 'bold 9px Arial';
    cx.textAlign    = 'left';
    cx.textBaseline = 'top';
    cx.fillText(`✕ ${remaining} left`, 6, 5);
  }

  // Analyzing badge
  if (isAnalyzing) {
    cx.fillStyle    = 'rgba(255,200,60,0.90)';
    cx.font         = 'bold 9px Arial';
    cx.textAlign    = 'right';
    cx.textBaseline = 'top';
    cx.fillText('ANALYZING…', LANE_W - 6, streak >= 2 ? 18 : 5);
  }

  // Count-in — ripple ring + colored glow per beat
  if (countInBeat >= 0) {
    const label  = COUNT_LABELS[countInBeat];
    const midX   = LANE_W / 2;
    const midY   = LANE_H / 2;
    // 3=cyan, 2=amber, 1=red
    const colBase = ['60,210,255', '255,185,40', '255,65,95'][countInBeat] || '255,255,255';
    const alpha   = countInFlash * countInFlash;

    // Expanding ripple ring (grows outward and fades)
    const rippleR = 26 + (1 - countInFlash) * 24;
    cx.strokeStyle = `rgba(${colBase},${countInFlash * 0.55})`;
    cx.lineWidth   = 2.5;
    cx.beginPath();
    cx.arc(midX, midY, rippleR, 0, Math.PI * 2);
    cx.stroke();

    // Dark backing circle
    cx.globalAlpha = alpha * 0.72;
    cx.fillStyle   = 'rgba(0,0,0,0.65)';
    cx.beginPath();
    cx.arc(midX, midY, 23, 0, Math.PI * 2);
    cx.fill();

    // Number with colored glow
    cx.globalAlpha  = alpha;
    cx.shadowColor  = `rgba(${colBase},0.9)`;
    cx.shadowBlur   = 24;
    cx.font         = 'bold 36px "Arial Black", Arial';
    cx.textAlign    = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle    = 'rgba(255,255,255,0.97)';
    cx.fillText(label, midX, midY + 1);
    cx.shadowBlur   = 0;
    cx.globalAlpha  = 1;

    countInFlash = Math.max(0, countInFlash - 0.055);
  }

  if (hitFlash.kick  > 0) hitFlash.kick--;
  if (hitFlash.snare > 0) hitFlash.snare--;
}

applyTheme(THEMES[0]);

// Reset miss pointer on seek; clear game-over on any seek
audio.addEventListener('seeked', () => {
  cancelCountIn();
  gameOver = false;
  missIdx  = 0;
});
audio.addEventListener('ended', () => { gameOver = true; });

(function animateTaiko() {
  drawTaiko(audio.currentTime || 0);
  requestAnimationFrame(animateTaiko);
})();
