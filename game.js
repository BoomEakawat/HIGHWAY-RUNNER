// ===============================
// Game Variables & State
// ===============================
const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");

let isDayMode = false; // ค่าเริ่มต้นเป็นกลางคืน (Night Mode)
let gameRunning = false;
let gameOver = false;
let score = 0;
let frame = 0;
let roadScroll = 0;

const lanes = [75, 225, 375]; 
let currentLane = 1;

const player = {
  x: 203,
  y: 400,
  width: 44,
  height: 60
};
const playerColors = { body: "#1d3557", window: "#bcd4e6" };

let obstacles = [];
let obstacleSpeed = 6;
let roadMarks = [];

// ===============================
// Theme Toggle Function
// ===============================
function toggleTheme() {
  isDayMode = !isDayMode;
  document.body.classList.toggle("day-theme", isDayMode);

  const themeBtn = document.getElementById("themeToggleBtn");
  if (isDayMode) {
    themeBtn.innerHTML = "🌙 โหมดกลางคืน";
    themeBtn.style.background = "linear-gradient(180deg, #475569, #1e293b)";
  } else {
    themeBtn.innerHTML = "☀️ โหมดกลางวัน";
    themeBtn.style.background = "linear-gradient(180deg, #3b82f6, #1d4ed8)";
  }

  if (!gameRunning) {
    drawGame();
  }
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
  gameRunning = true;
  gameOver = false;
  score = 0;
  frame = 0;
  roadScroll = 0;
  obstacleSpeed = 6;
  obstacles = [];
  currentLane = 1;
  createRoadMarks();

  document.getElementById("gameStatus").innerHTML = "สถานะเกม: กำลังวิ่ง!";
  document.getElementById("gameScore").innerHTML = "คะแนน: 0";
}

function restartGame() {
  if (isRunning) startGame();
}

function endGame() {
  gameOver = true;
  gameRunning = false;
  document.getElementById("gameStatus").innerHTML = "สถานะเกม: ชนแล้ว!";
}

// ===============================
// Physics & Collision
// ===============================
function updateGame() {
  if (!gameRunning || gameOver) return;
  frame++;
  roadScroll += obstacleSpeed;

  const targetX = lanes[currentLane] - (player.width / 2);
  player.x += (targetX - player.x) * 0.15;

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
      score += 10;
      document.getElementById("gameScore").innerHTML = "คะแนน: " + score;
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
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y + w, x, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, w, h, type, colors) {
  ctx.save();

  // เงา
  ctx.fillStyle = isDayMode ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.28)";
  roundRectPath(ctx, x - 1, y + 3, w + 2, h, 8);
  ctx.fill();

  // ล้อ
  const wheelW = 6, wheelH = h * 0.16;
  ctx.fillStyle = "#111214";
  roundRectPath(ctx, x - 2, y + h * 0.12, wheelW, wheelH, 2); ctx.fill();
  roundRectPath(ctx, x + w - wheelW + 2, y + h * 0.12, wheelW, wheelH, 2); ctx.fill();
  roundRectPath(ctx, x - 2, y + h * 0.70, wheelW, wheelH, 2); ctx.fill();
  roundRectPath(ctx, x + w - wheelW + 2, y + h * 0.70, wheelW, wheelH, 2); ctx.fill();

  if (type === "truck") {
    const boxH = h * 0.62;
    ctx.fillStyle = colors.body;
    roundRectPath(ctx, x, y + h - boxH, w, boxH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const ly = y + h - boxH + (boxH / 4) * i;
      ctx.beginPath(); ctx.moveTo(x + 3, ly); ctx.lineTo(x + w - 3, ly); ctx.stroke();
    }
    const cabH = h * 0.36;
    ctx.fillStyle = colors.cab;
    roundRectPath(ctx, x + w * 0.08, y, w * 0.84, cabH, 5);
    ctx.fill();
    ctx.fillStyle = colors.window;
    roundRectPath(ctx, x + w * 0.18, y + cabH * 0.15, w * 0.64, cabH * 0.5, 3);
    ctx.fill();
  } else if (type === "pickup") {
    const bedH = h * 0.55;
    ctx.fillStyle = colors.body;
    roundRectPath(ctx, x, y + h - bedH, w, bedH, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 4, y + h - bedH + 4, w - 8, bedH - 8, 2);
    ctx.stroke();
    const cabH = h * 0.5;
    ctx.fillStyle = colors.body;
    roundRectPath(ctx, x, y, w, cabH, 6);
    ctx.fill();
    ctx.fillStyle = colors.window;
    roundRectPath(ctx, x + w * 0.15, y + cabH * 0.2, w * 0.7, cabH * 0.45, 3);
    ctx.fill();
  } else if (type === "suv") {
    ctx.fillStyle = colors.body;
    roundRectPath(ctx, x, y, w, h, 9);
    ctx.fill();
    ctx.fillStyle = colors.window;
    roundRectPath(ctx, x + w * 0.12, y + h * 0.16, w * 0.76, h * 0.55, 5);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.16);
    ctx.lineTo(x + w * 0.5, y + h * 0.71);
    ctx.stroke();
  } else {
    ctx.fillStyle = colors.body;
    roundRectPath(ctx, x, y, w, h, 11);
    ctx.fill();
    ctx.fillStyle = colors.window;
    roundRectPath(ctx, x + w * 0.14, y + h * 0.14, w * 0.72, h * 0.28, 4);
    ctx.fill();
    roundRectPath(ctx, x + w * 0.16, y + h * 0.62, w * 0.68, h * 0.22, 4);
    ctx.fill();
  }

  // ไฟหน้า / ไฟท้าย
  ctx.fillStyle = isDayMode ? "#ffe680" : "#fff4c2";
  ctx.fillRect(x + 2, y + 1, 6, 3);
  ctx.fillRect(x + w - 8, y + 1, 6, 3);

  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(x + 2, y + h - 4, 6, 3);
  ctx.fillRect(x + w - 8, y + h - 4, 6, 3);

  ctx.restore();
}

// ===============================
// Main Draw Loop
// ===============================
function drawGame() {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  // สลับสีพื้นผิวถนนตามธีม
  const roadGradient = gameCtx.createLinearGradient(0, 0, 0, gameCanvas.height);
  if (isDayMode) {
    roadGradient.addColorStop(0, "#737a85");
    roadGradient.addColorStop(1, "#525760");
  } else {
    roadGradient.addColorStop(0, "#23262c");
    roadGradient.addColorStop(1, "#15171b");
  }
  gameCtx.fillStyle = roadGradient;
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // ลายรอยยาง
  for (const m of roadMarks) {
    gameCtx.fillStyle = isDayMode ? `rgba(0,0,0,${m.alpha * 1.5})` : `rgba(0,0,0,${m.alpha})`;
    gameCtx.beginPath();
    gameCtx.ellipse(m.x, m.y, m.w / 2, m.w / 6, 0, 0, Math.PI * 2);
    gameCtx.fill();
  }

  // แสงไฟหน้ารถ (กลางคืนจะชัดเจนกว่ากลางวัน)
  const headlightGlow = gameCtx.createRadialGradient(
    player.x + player.width / 2, player.y - 10, 10,
    player.x + player.width / 2, player.y - 10, isDayMode ? 140 : 220
  );
  headlightGlow.addColorStop(0, isDayMode ? "rgba(255,255,220,0.12)" : "rgba(255,230,150,0.18)");
  headlightGlow.addColorStop(1, "rgba(255,230,150,0)");
  gameCtx.fillStyle = headlightGlow;
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  // ขอบถนน
  gameCtx.strokeStyle = isDayMode ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)";
  gameCtx.lineWidth = 3;
  gameCtx.beginPath();
  gameCtx.moveTo(6, 0); gameCtx.lineTo(6, gameCanvas.height);
  gameCtx.moveTo(gameCanvas.width - 6, 0); gameCtx.lineTo(gameCanvas.width - 6, gameCanvas.height);
  gameCtx.stroke();

  // เส้นประแบ่งเลน
  gameCtx.strokeStyle = isDayMode ? "#ffffff" : "#ffcc00";
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

  // วาดสิ่งกีดขวาง
  for (const obs of obstacles) {
    drawCar(gameCtx, obs.x, obs.y, obs.width, obs.height, obs.type, obs.colors);
  }

  // วาดรถผู้เล่น
  drawCar(gameCtx, player.x, player.y, player.width, player.height, "sedan", playerColors);
  gameCtx.fillStyle = "#f1f1f1";
  gameCtx.fillRect(player.x + player.width / 2 - 3, player.y + 4, 2, player.height - 8);
  gameCtx.fillRect(player.x + player.width / 2 + 1, player.y + 4, 2, player.height - 8);

  // Overlay แจ้งเตือนสถานะ
  if (!gameRunning && !gameOver) {
    gameCtx.fillStyle = isDayMode ? "rgba(255, 255, 255, 0.85)" : "rgba(10, 10, 14, 0.82)";
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    gameCtx.fillStyle = isDayMode ? "#1e293b" : "#ffd166";
    gameCtx.font = "bold 22px Arial";
    gameCtx.textAlign = "center";
    gameCtx.fillText("กดปุ่ม 'สตาร์ทเครื่อง' ด้านบน", gameCanvas.width / 2, 250);
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
    gameCtx.fillText("คะแนนของคุณ: " + score, gameCanvas.width / 2, 270);
    
    gameCtx.fillStyle = isDayMode ? "#d97706" : "#ffd166";
    gameCtx.font = "18px Arial";
    gameCtx.fillText("กดปุ่ม 'เข้าพิท' เพื่อลองอีกครั้ง", gameCanvas.width / 2, 320);
    gameCtx.textAlign = "left";
  }
}

// Initial Canvas Draw
drawGame();