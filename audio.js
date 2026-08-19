// ===============================
// Audio Engine (Preload & Auto-Wait Fix)
// ===============================
let audioCtx = null;
let startBuffer = null;
let engineBuffer = null;
let crashBuffer = null;
let passBuffer = null;
let gameOverBuffer = null;

let isAudioRunning = false;
let loopTimer = null;
let activeEngineNodes = [];
let audioLoadPromise = null;

// กำหนดช่วงเวลาลูปเสียงเครื่องยนต์
const FIRST_START_TIME   = 0.0;
const LOOP_START_TIME    = 4.0;
const LOOP_END_TIME      = 20.0;
const CROSSFADE_TIME     = 0.6;
const IGNITION_CROSSFADE = 0.4;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if (!audioLoadPromise) {
    audioLoadPromise = loadAllAudio();
  }
}

// โหลดไฟล์เสียง
async function loadAudioBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    return null;
  }
}

async function loadAllAudio() {
  if (!audioCtx) return;
  const [start, engine, crash, pass, gameOver] = await Promise.all([
    loadAudioBuffer("sounds/start.mp3"),
    loadAudioBuffer("sounds/drive.mp3"),
    loadAudioBuffer("sounds/crash.mp3"),
    loadAudioBuffer("sounds/pass.mp3"),
    loadAudioBuffer("sounds/gameover.mp3")
  ]);

  startBuffer    = start;
  engineBuffer   = engine;
  crashBuffer    = crash;
  passBuffer     = pass;
  gameOverBuffer = gameOver;
}

// 1. เสียงสตาร์ตและต่อเข้าสู่เสียงขับ (รอโหลดไฟล์ให้พร้อมก่อนเล่นเสมอ)
async function playIgnitionAndDrive() {
  initAudio();
  stopEngineSound();

  // หากไฟล์ยังโหลดไม่เสร็จ ให้รอจนกว่าจะโหลดเสร็จ
  if (audioLoadPromise) {
    await audioLoadPromise;
  }

  if (!startBuffer || !engineBuffer) {
    return;
  }

  isAudioRunning = true;
  const now = audioCtx.currentTime;
  const startDuration = startBuffer.duration;

  // เสียงสตาร์ต
  const startNode = audioCtx.createBufferSource();
  const startGain = audioCtx.createGain();
  startNode.buffer = startBuffer;

  startGain.gain.setValueAtTime(0.6, now);
  startGain.gain.setValueAtTime(0.6, now + startDuration - IGNITION_CROSSFADE);
  startGain.gain.linearRampToValueAtTime(0.001, now + startDuration);

  startNode.connect(startGain);
  startGain.connect(audioCtx.destination);
  startNode.start(now);
  activeEngineNodes.push({ source: startNode, gainNode: startGain });

  // เชื่อมต่อเข้าเสียงขับ
  const engineStartTime = now + Math.max(0, startDuration - IGNITION_CROSSFADE);
  const driveDuration = LOOP_END_TIME - FIRST_START_TIME;

  const engineNode = audioCtx.createBufferSource();
  const engineGain = audioCtx.createGain();
  engineNode.buffer = engineBuffer;

  engineGain.gain.setValueAtTime(0.001, engineStartTime);
  engineGain.gain.linearRampToValueAtTime(0.35, engineStartTime + IGNITION_CROSSFADE);
  engineGain.gain.setValueAtTime(0.35, engineStartTime + driveDuration - CROSSFADE_TIME);
  engineGain.gain.linearRampToValueAtTime(0.001, engineStartTime + driveDuration);

  engineNode.connect(engineGain);
  engineGain.connect(audioCtx.destination);
  engineNode.start(engineStartTime, FIRST_START_TIME, driveDuration);
  activeEngineNodes.push({ source: engineNode, gainNode: engineGain });

  const nextTriggerMs = (engineStartTime - now + driveDuration - CROSSFADE_TIME) * 1000;
  loopTimer = setTimeout(() => {
    if (isAudioRunning) {
      playCrossfadeSegment(LOOP_START_TIME);
    }
  }, nextTriggerMs);
}

function playCrossfadeSegment(startTime) {
  if (!isAudioRunning || !audioCtx || !engineBuffer) return;

  const duration = LOOP_END_TIME - startTime;
  const now = audioCtx.currentTime;

  const source = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();
  source.buffer = engineBuffer;

  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.linearRampToValueAtTime(0.35, now + CROSSFADE_TIME);
  gainNode.gain.setValueAtTime(0.35, now + duration - CROSSFADE_TIME);
  gainNode.gain.linearRampToValueAtTime(0.001, now + duration);

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  source.start(now, startTime, duration);
  activeEngineNodes.push({ source, gainNode });

  source.onended = () => {
    activeEngineNodes = activeEngineNodes.filter(n => n.source !== source);
  };

  const nextTriggerTime = (duration - CROSSFADE_TIME) * 1000;
  loopTimer = setTimeout(() => {
    if (isAudioRunning) {
      playCrossfadeSegment(LOOP_START_TIME);
    }
  }, nextTriggerTime);
}

// 2. เสียงตอนแซงรถคันอื่นพ้น
function playScoreSound() {
  initAudio();
  if (!audioCtx) return;

  if (passBuffer) {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = passBuffer;
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
    return;
  }

  const oscPing = audioCtx.createOscillator();
  const gainPing = audioCtx.createGain();
  oscPing.type = "sine";
  oscPing.frequency.setValueAtTime(587.33, audioCtx.currentTime);
  oscPing.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15);

  gainPing.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gainPing.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

  oscPing.connect(gainPing);
  gainPing.connect(audioCtx.destination);
  oscPing.start();
  oscPing.stop(audioCtx.currentTime + 0.15);
}

// 3. เสียงรถชน -> รอจบ -> ต่อด้วยเสียง Game Over
function playCrashSound() {
  initAudio();
  stopEngineSound();

  if (crashBuffer) {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = crashBuffer;
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    
    src.onended = () => {
      triggerGameOverSound();
    };
    
    src.start();
    return;
  }

  const crashDuration = 0.5;
  const bufferSize = audioCtx.sampleRate * crashDuration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + crashDuration);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.45, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + crashDuration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.onended = () => {
    triggerGameOverSound();
  };

  noise.start();
  noise.stop(audioCtx.currentTime + crashDuration);
}

// 4. เล่นไฟล์เสียง Game Over
function triggerGameOverSound() {
  if (gameOverBuffer && audioCtx) {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = gameOverBuffer;
    gain.gain.setValueAtTime(0.75, audioCtx.currentTime);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  }
}

// 5. เสียงนับถอยหลัง (3 2 1 GO)
function playCountdownBeep(isGo = false) {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  const freq = isGo ? 880 : 440;
  const duration = isGo ? 0.35 : 0.12;

  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

// 6. หยุดเสียงและเคลียร์หน่วยความจำ
function stopEngineSound() {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  activeEngineNodes.forEach(({ source, gainNode }) => {
    try {
      gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      setTimeout(() => {
        source.stop();
        source.disconnect();
      }, 90);
    } catch (e) {}
  });

  activeEngineNodes = [];
  isAudioRunning = false;
}

// สั่ง Preload ไฟล์เสียงทันทีเมื่อเปิดหน้าเว็บ
window.addEventListener("DOMContentLoaded", () => {
  initAudio();
});