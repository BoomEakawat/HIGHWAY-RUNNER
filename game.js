// ===============================
// Game Variables & State
// ===============================
const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");

let isDayMode = true;
let gameRunning = false;
let gameOver = false;
let isCountingDown = false;
let countdownText = "";
let countdownTimer = null;

let carsPassed = 0; // จำนวนรถที่แซงพ้น
let frame = 0;
let roadScroll = 0;

const lanes = [75, 225, 375]; 
let currentLane = 1;

const player = {
  x: 225 - 22,
  y: 400,
  width: 44,
  height: 60
};
const playerColors = { body: "#1d3557", window: "#bcd4e6" };

let obstacles = [];
let obstacleSpeed = 6;
let roadMarks = [];

// ===============================
// Day / Night Environment System
// ===============================
function updateThemeVisuals() {
  document.body.classList.toggle("day-theme", isDayMode);
}

// ===============================
// Vehicle Presets
// ===============================
const CAR_TYPES = [
  { type: "sedan",  width: 44, height: 60, weight: 5 },
  { type: "suv",    width: 50, height: 68, weight: 3 },
  { type: "pickup", width: 46, height: 74, weight: 3 },
  { type: "truck",  width: 56, height: 98, weight: 2 }
];
const SEDAN_COLORS  = ["#e63946", "#f4a261", "#e9ecef", "#2a9d8f", "#ffd166"];
const SUV_COLORS    = ["#264653", "#1b1b1f", "#3a5a40"];
const PICKUP_COLORS = ["#d62828", "#e07a5f", "#457b9d"];

function pick(arr) { 
  return arr[Math.floor(Math.random() * arr.length)]; 
}

function pickCarType() {
  const total = CAR_TYPES.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of CAR_TYPES) {
    if (r < c.weight) return c;
    r -= c.weight;
  }
  return CAR_TYPES[0];
}

function randomColorsFor(type) {
  switch (type) {
    case "suv":    return { body: pick(SUV_COLORS), window: "#cfe8ff" };
    case "pickup": return { body: pick(PICKUP_COLORS), window: "#cfe8ff" };
    case "truck":  return { body: "#dee2e6", cab: "#495057", window: "#cfe8ff" };
    default:       return { body: pick(SEDAN_COLORS), window: "#bcd4e6" };
  }
}

// ===============================
// Game Management
// ===============================
function setPlayerLane(laneIndex) {
  if (isCountingDown || !gameRunning || gameOver) return;
  currentLane = laneIndex;
}

function createRoadMarks() {
  roadMarks = [];
  for (let i = 0; i < 10; i++) {
    roadMarks.push({
      x: 10 + Math.random() * (gameCanvas.width - 20),
      y: Math.random() * gameCanvas.height,
      w: 14 + Math.random() * 22,
      alpha: 0.05 + Math.random() * 0.07
    });
  }
}

function startGame() {
  if (countdownTimer) clearInterval(countdownTimer);

  gameRunning = true;
  gameOver = false;
  carsPassed = 0;
  frame = 0;
  roadScroll = 0;
  obstacleSpeed = 6;
  obstacles = [];

  isDayMode = true;
  updateThemeVisuals();

  currentLane = 1;
  player.x = lanes[1] - (player.width / 2);

  createRoadMarks();

  if (typeof playIgnitionAndDrive === "function") playIgnitionAndDrive();

  isCountingDown = true;
  countdownText = "3";
  if (typeof playCountdownBeep === "function") playCountdownBeep(false);

  document.getElementById("gameStatus").innerHTML = "READY...";
  document.getElementById("gameScore").innerHTML = "OVERTAKEN: 0";

  let count = 3;
  countdownTimer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownText = count.toString();
      if (typeof playCountdownBeep === "function") playCountdownBeep(false);
    } else if (count === 0) {
      countdownText = "GO!";
      if (typeof playCountdownBeep === "function") playCountdownBeep(true);
    } else {
      clearInterval(countdownTimer);
      countdownTimer = null;
      isCountingDown = false;
      countdownText = "";
      document.getElementById("gameStatus").innerHTML = "RACING!";
    }
  }, 1000);
}

function endGame() {
  if (countdownTimer) clearInterval(countdownTimer);
  gameOver = true;
  gameRunning = false;
  isCountingDown = false;

  if (typeof playCrashSound === "function") playCrashSound();

  document.getElementById("gameStatus").innerHTML = "CRASHED!";
}

function restartGame() {
  startGame();
}

// ===============================
// Physics & Collision
// ===============================
function updateGame() {
  if (!gameRunning || gameOver) return;

  const targetX = lanes[currentLane] - (player.width / 2);
  player.x += (targetX - player.x) * 0.15;

  if (isCountingDown) return;

  frame++;
  roadScroll += obstacleSpeed;

  if (frame % 600 === 0) obstacleSpeed += 0.5;
  if (frame % 40 === 0) createObstacle();

  for (const m of roadMarks) {
    m.y += obstacleSpeed;
    if (m.y > gameCanvas.height) {
      m.y = -20;
      m.x = 10 + Math.random() * (gameCanvas.width - 20);
    }
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += obstacleSpeed;

    if (checkCollision(player, obstacles[i])) {
      endGame();
    }

    if (obstacles[i].y > gameCanvas.height) {
      obstacles.splice(i, 1);
      carsPassed++; // นับจำนวนรถที่แซงพ้น

      // สลับ Day/Night ทุกๆ 10 คัน
      if (carsPassed % 10 === 0) {
        isDayMode = !isDayMode;
        updateThemeVisuals();
      }

      if (typeof playScoreSound === "function") playScoreSound();
      document.getElementById("gameScore").innerHTML = "OVERTAKEN: " + carsPassed;
    }
  }
}

function createObstacle() {
  const randomLane = Math.floor(Math.random() * 3);
  const chosen = pickCarType();

  obstacles.push({
    x: lanes[randomLane] - chosen.width / 2,
    y: -chosen.height,
    width: chosen.width,
    height: chosen.height,
    type: chosen.type,
    colors: randomColorsFor(chosen.type)
  });
}

function checkCollision(a, b) {
  const padding = 8;
  return (
    a.x + padding < b.x + b.width &&
    a.x + a.width - padding > b.x &&
    a.y + padding < b.y + b.height &&
    a.y + a.height - padding > b.y
  );
}

// ===============================
// Graphic Helpers
// ===============================
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }
  ctx.closePath();
}

function drawHeadlightBeams(ctx, x, y, w, h) {
  if (isDayMode) return;

  const beamLength = 175;
  const beamSpread = 38;

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const createSoftBeamGradient = (originX) => {
    const grad = ctx.createLinearGradient(0, y, 0, y - beamLength);
    grad.addColorStop(0, "rgba(255, 245, 180, 0.28)");
    grad.addColorStop(0.25, "rgba(255, 238, 160, 0.15)");
    grad.addColorStop(0.6, "rgba(255, 230, 140, 0.05)");
    grad.addColorStop(0.85, "rgba(255, 225, 130, 0.015)");
    grad.addColorStop(1, "rgba(255, 220, 120, 0)");
    return grad;
  };

  const leftX = x + 6;
  ctx.fillStyle = createSoftBeamGradient(leftX);
  ctx.beginPath();
  ctx.moveTo(leftX - 3, y);
  ctx.lineTo(leftX + 4, y);
  ctx.quadraticCurveTo(leftX + 5, y - beamLength * 0.4, leftX + beamSpread * 0.55, y - beamLength + 12);
  ctx.quadraticCurveTo(leftX, y - beamLength - 4, leftX - beamSpread * 0.65, y - beamLength + 12);
  ctx.quadraticCurveTo(leftX - 4, y - beamLength * 0.4, leftX - 3, y);
  ctx.closePath();
  ctx.fill();

  const rightX = x + w - 10;
  ctx.fillStyle = createSoftBeamGradient(rightX);
  ctx.beginPath();
  ctx.moveTo(rightX - 4, y);
  ctx.lineTo(rightX + 3, y);
  ctx.quadraticCurveTo(rightX + 4, y - beamLength * 0.4, rightX + beamSpread * 0.65, y - beamLength + 12);
  ctx.quadraticCurveTo(rightX, y - beamLength - 4, rightX - beamSpread * 0.55, y - beamLength + 12);
  ctx.quadraticCurveTo(rightX - 5, y - beamLength * 0.4, rightX - 4, y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCar(ctx, x, y, w, h, type, colors) {
  ctx.save();

  ctx.fillStyle = isDayMode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.45)";
  drawRoundedRect(ctx, x - 1, y + 3, w + 2, h, 8);
  ctx.fill();

  const wheelW = 4;
  const wheelH = 10;
  ctx.fillStyle = "#111214";
  drawRoundedRect(ctx, x - 1, y + 8, wheelW, wheelH, 2); ctx.fill();
  drawRoundedRect(ctx, x + w - wheelW + 1, y + 8, wheelW, wheelH, 2); ctx.fill();
  drawRoundedRect(ctx, x - 1, y + h - 18, wheelW, wheelH, 2); ctx.fill();
  drawRoundedRect(ctx, x + w - wheelW + 1, y + h - 18, wheelW, wheelH, 2); ctx.fill();

  ctx.fillStyle = colors.body;
  drawRoundedRect(ctx, x, y, w, h, 10);
  ctx.fill();

  const glassColor = colors.window || "#bcd4e6";
  ctx.fillStyle = "#1c222b";
  drawRoundedRect(ctx, x + 4, y + 10, w - 8, h - 22, 5);
  ctx.fill();

  ctx.fillStyle = glassColor;
  drawRoundedRect(ctx, x + 6, y + 12, w - 12, 10, 3);
  ctx.fill();

  ctx.fillStyle = colors.body;
  drawRoundedRect(ctx, x + 6, y + 24, w - 12, h - 46, 2);
  ctx.fill();

  ctx.fillStyle = glassColor;
  drawRoundedRect(ctx, x + 6, y + h - 20, w - 12, 6, 2);
  ctx.fill();

  ctx.fillStyle = "#fff4c2";
  ctx.fillRect(x + 4, y + 1, 5, 2);
  ctx.fillRect(x + w - 9, y + 1, 5, 2);

  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(x + 4, y + h - 3, 5, 2);
  ctx.fillRect(x + w - 9, y + h - 3, 5, 2);

  ctx.restore();
}

// ===============================
// Main Draw Loop
// ===============================
function drawGame() {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  const roadGradient = gameCtx.createLinearGradient(0, 0, 0, gameCanvas.height);
  if (isDayMode) {
    roadGradient.addColorStop(0, "#737a85");
    roadGradient.addColorStop(1, "#525760");
  } else {
    roadGradient.addColorStop(0, "#1e2127");
    roadGradient.addColorStop(1, "#111316");
  }
  gameCtx.fillStyle = roadGradient;
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  for (const m of roadMarks) {
    gameCtx.fillStyle = isDayMode ? `rgba(0,0,0,${m.alpha * 1.5})` : `rgba(0,0,0,${m.alpha})`;
    gameCtx.beginPath();
    gameCtx.ellipse(m.x, m.y, m.w / 2, m.w / 6, 0, 0, Math.PI * 2);
    gameCtx.fill();
  }

  gameCtx.strokeStyle = isDayMode ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)";
  gameCtx.lineWidth = 3;
  gameCtx.beginPath();
  gameCtx.moveTo(6, 0); gameCtx.lineTo(6, gameCanvas.height);
  gameCtx.moveTo(gameCanvas.width - 6, 0); gameCtx.lineTo(gameCanvas.width - 6, gameCanvas.height);
  gameCtx.stroke();

  gameCtx.strokeStyle = "#ffffff";
  gameCtx.lineWidth = 4;
  gameCtx.setLineDash([22, 18]);
  gameCtx.lineDashOffset = -roadScroll;
  if (!isDayMode) {
    gameCtx.shadowColor = "#ffcc00";
    gameCtx.shadowBlur = 6;
  }

  gameCtx.beginPath();
  gameCtx.moveTo(150, 0); gameCtx.lineTo(150, gameCanvas.height);
  gameCtx.moveTo(300, 0); gameCtx.lineTo(300, gameCanvas.height);
  gameCtx.stroke();
  gameCtx.setLineDash([]);
  gameCtx.shadowBlur = 0;

  for (const obs of obstacles) {
    drawHeadlightBeams(gameCtx, obs.x, obs.y, obs.width, obs.height);
  }
  drawHeadlightBeams(gameCtx, player.x, player.y, player.width, player.height);

  for (const obs of obstacles) {
    drawCar(gameCtx, obs.x, obs.y, obs.width, obs.height, obs.type, obs.colors);
  }

  drawCar(gameCtx, player.x, player.y, player.width, player.height, "sedan", playerColors);

  if (isCountingDown) {
    gameCtx.save();
    gameCtx.fillStyle = "rgba(0, 0, 0, 0.35)";
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    gameCtx.textAlign = "center";
    gameCtx.fillStyle = countdownText === "GO!" ? "#39ff9d" : "#ffd166";
    gameCtx.font = "bold 80px 'Kanit', sans-serif";
    gameCtx.shadowColor = countdownText === "GO!" ? "#39ff9d" : "#ffd166";
    gameCtx.shadowBlur = 16;
    gameCtx.fillText(countdownText, gameCanvas.width / 2, gameCanvas.height / 2 + 25);
    gameCtx.restore();
  }

  if (!gameRunning && !gameOver) {
    gameCtx.fillStyle = isDayMode ? "rgba(255, 255, 255, 0.85)" : "rgba(10, 10, 14, 0.82)";
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = isDayMode ? "#1e293b" : "#ffd166";
    gameCtx.font = "bold 22px Arial";
    gameCtx.textAlign = "center";
    gameCtx.fillText("CLICK 'START ENGINE' ABOVE", gameCanvas.width / 2, 250);
    gameCtx.textAlign = "left";
  }

  if (gameOver) {
    gameCtx.fillStyle = isDayMode ? "rgba(255, 255, 255, 0.90)" : "rgba(10, 10, 14, 0.88)";
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    gameCtx.textAlign = "center";
    gameCtx.fillStyle = "#e63946";
    gameCtx.font = "bold 40px Arial";
    gameCtx.fillText("GAME OVER", gameCanvas.width / 2, 220);

    gameCtx.fillStyle = isDayMode ? "#1e293b" : "#f1f1f1";
    gameCtx.font = "24px Arial";
    gameCtx.fillText("CARS OVERTAKEN: " + carsPassed, gameCanvas.width / 2, 270);
    
    gameCtx.fillStyle = isDayMode ? "#d97706" : "#ffd166";
    gameCtx.font = "18px Arial";
    gameCtx.fillText("PRESS 'PIT STOP' TO RETRY", gameCanvas.width / 2, 320);
    gameCtx.textAlign = "left";
  }
}

updateThemeVisuals();
drawGame();