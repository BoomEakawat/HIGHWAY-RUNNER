// ===============================
// Configuration
// ===============================
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/wPLcLfk_6/"; 
const CONFIDENCE_LIMIT = 0.70;

let model, webcam, cameraCtx, maxPredictions;
let isRunning = false;
let currentPose = "center";

// ===============================
// Initialize AI & Camera
// ===============================
async function initAI() {
  const startBtn = document.getElementById("startBtn");
  const actionText = document.getElementById("action");

  try {
    startBtn.disabled = true;
    startBtn.innerHTML = "กำลังโหลดโมเดล AI...";
    actionText.innerHTML = "สถานะ: กำลังโหลด...";

    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const size = 400;
    const flip = true; 
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup(); 
    await webcam.play();

    const cameraCanvas = document.getElementById("cameraCanvas");
    cameraCtx = cameraCanvas.getContext("2d");

    isRunning = true;
    startBtn.innerHTML = "กล้องทำงานแล้ว";
    actionText.innerHTML = "สถานะ: พร้อมเล่น!";

    startGame();
    window.requestAnimationFrame(aiLoop);
  } catch (error) {
    console.error("AI Init Error:", error);
    startBtn.disabled = false;
    startBtn.innerHTML = "ลองเปิดกล้องใหม่";
    actionText.innerHTML = "เกิดข้อผิดพลาด: โปรดอนุญาตการใช้กล้อง";
  }
}

// ===============================
// AI Loop
// ===============================
async function aiLoop() {
  if (!isRunning) return;
  webcam.update();
  await predict();
  updateGame();
  drawGame();
  window.requestAnimationFrame(aiLoop);
}

// ===============================
// Pose Prediction
// ===============================
async function predict() {
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  const prediction = await model.predict(posenetOutput);

  for (let i = 0; i < maxPredictions; i++) {
    const el = document.getElementById("class" + (i + 1));
    if (el && prediction[i]) {
      el.innerHTML = prediction[i].className + ": " + (prediction[i].probability * 100).toFixed(0) + "%";
    }
  }

  let bestPrediction = prediction[0];
  for (let i = 1; i < prediction.length; i++) {
    if (prediction[i].probability > bestPrediction.probability) {
      bestPrediction = prediction[i];
    }
  }

  const resultName = bestPrediction.className.toLowerCase();
  const resultScore = bestPrediction.probability;

  document.getElementById("result").innerHTML = "ผลลัพธ์: " + bestPrediction.className;
  document.getElementById("confidence").innerHTML = "ความมั่นใจ: " + (resultScore * 100).toFixed(0) + "%";

  if (resultScore > CONFIDENCE_LIMIT) {
    currentPose = resultName;
    document.getElementById("action").innerHTML = "สถานะ: " + currentPose;
    
    if (currentPose.includes("left") || currentPose.includes("ซ้าย")) {
      setPlayerLane(0);
    } else if (currentPose.includes("right") || currentPose.includes("ขวา")) {
      setPlayerLane(2);
    } else {
      setPlayerLane(1);
    }
  }

  drawPose(pose);
}

function drawPose(pose) {
  const cameraCanvas = document.getElementById("cameraCanvas");
  if (!cameraCanvas || !cameraCtx) return;

  // 1. เคลียร์ภาพเก่าทิ้งทุกเฟรม ป้องกันภาพซ้อน
  cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);

  // 2. สั่งยืดภาพวิดีโอจากกล้องให้เต็มกรอบ Canvas (400x400) เสมอ
  if (webcam && webcam.canvas) {
    cameraCtx.drawImage(
      webcam.canvas, 
      0, 0, 
      cameraCanvas.width, 
      cameraCanvas.height
    );
  }

  // 3. วาดเส้นและจุดโครงร่างร่างกาย
  if (pose) {
    tmPose.drawKeypoints(pose.keypoints, 0.5, cameraCtx);
    tmPose.drawSkeleton(pose.keypoints, 0.5, cameraCtx);
  }
}