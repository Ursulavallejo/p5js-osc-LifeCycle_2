// === TouchOSC Beatmachine Mk2 → p5.js ( faders +  buttons) ===
// fader1: controls CoreEnergy radius (smoke moon size)
// fader2: controls Atoms openness (0..1)
// faderVolume: controls Background Music Volume (0..1)
// faderThree: controls CoreEnergy Three size
// buttons A/B/C: CoreEnergy tint overrides (Burgundy/Turquoise/Yellow) // Same Three
// Cells-Micro: MediaPipe hand controls (open/close + rotation) + Processing audio shaping.

window.bgMusic = null
let socket

// UI state (from OSC)
let fader1 = 0 // 0..1  (core size)
let faderThree = 0 // 0..1  (core size Three)
let faderVolume = 0.5 // 0..1 (Background Music Volume, default value)

let fader2 = 0 // 0..1  (atoms openness)
let btnA = 0, // Core Energy
  btnB = 0,
  btnC = 0
// Three js Core
let btnAThree = 0,
  btnBThree = 0,
  btnCThree = 0

// --- Audio from Processing /uv/eq (mic) ---
let micBass = 0
let micMid = 0
let micTre = 0

// smoothing for mic values
const MIC_SMOOTH = 0.25

// toggle state to show/hide
// Convention: 1 → show, 0 → hide
let showIntro = false
let showCellsMicro = false // true: draw cells / bacteria, false: hide cells
let showAtomsNestBackground = false
let showCoreEnergy = false
let showCoreEnergyThree = false // Three js

// --- Hand / MediaPipe ---
let video, hands, mpCamera

let handOpenness = 0 // 0..1 (0 = closed hand, 1 = open Hand)
let useHandForCells = false // Control mode: false = fader, true = hand

let handTwist = 0 // -1..1 (left/right twist of the hand)
let sHandTwist = 0
// Smoothing for nicer motion
let s1 = 0,
  s2 = 0,
  s3 = 0
const ALPHA = 0.25

// Particles for a tiny "bloom puff" when tapped
let particles = []
let puffT = 0

// Intro
let img
let bgMusic

// -------------------- preload --------------------
function preload() {
  CoreEnergy_preload('./assets/texture.png')
  soundFormats('mp3', 'wav', 'ogg')
  window.bgMusic = loadSound('./assets/metamorphosis-experimental.mp3')
}

// -------------------- setup --------------------
function setup() {
  createCanvas(windowWidth, windowHeight)

  pixelDensity(1)
  noStroke()
  textAlign(CENTER, CENTER)
  textSize(18)
  fill(255)

  // === p5 video capture (this triggers the camera popup) ===
  video = createCapture(VIDEO)
  video.size(640, 480)
  video.hide() // we don't want to draw the raw video on the canvas

  // === initialize MediaPipe Hands ===
  initHands()

  // Connect to local bridge
  socket = io('http://127.0.0.1:8081')

  // Let the bridge know the OSC ports (server = bridge listens; client = bridge sends back)
  socket.emit('config', {
    server: { host: '0.0.0.0', port: 12000 }, // TouchOSC → bridge
    client: { host: '127.0.0.1', port: 9000 }, // optional OSC OUT (not used now)
  })

  socket.on('connected', (ok) => console.log('Bridge connected?', ok))

  // TouchOSC messages → our variables
  socket.on('message', handleOscMessage)

  // Mic audio from Processing: /uv/eq [bass, mid, tre]
  socket.on('osc-eq', onOscEq)

  // Initialize intro
  Intro_init({
    fontPath: './assets/MomoTrustDisplay.ttf',
    fadeSec: 3.5,
    holdSec: 2.0,
  })

  // Initialize CoreEnergy (2D smoke moon)
  CoreEnergy_init()

  // Initialize Three.js sphere (ThreeCore), start hidden
  if (window.ThreeCore && window.ThreeCore.init) {
    window.ThreeCore.init()
    window.ThreeCore.setVisible(false) // start hidden
  }
}

// -------------------- OSC handlers --------------------

// TouchOSC → faders + toggles
function handleOscMessage(msg) {
  console.log('📩 OSC →', msg)
  // msg shape: ['/addr', value]
  const [addr, valRaw] = msg
  const val = Number(valRaw)

  // Intro ON/OFF from TouchOSC (1 = ON, 0 = OFF)
  if (addr === '/2/multitoggle/1/1') {
    showIntro = val === 1
    if (showIntro) {
      if (typeof Intro_reset === 'function') Intro_reset()
    } else {
      if (typeof Intro_skip === 'function') Intro_skip()
    }
  }

  // Faders
  // fader Three.js
  if (addr === '/2/multifader/5') faderThree = constrain(val, 0, 1)
  // fader CoreEnergy
  if (addr === '/2/multifader/3') fader1 = constrain(val, 0, 1)
  // cells movement / openness
  if (addr === '/2/multifader/4') fader2 = constrain(val, 0, 1)
  // Sound volume
  if (addr === '/2/multifader/6') faderVolume = constrain(val, 0, 1)

  // Toggles A/B/C Three.js core color
  if (addr === '/2/multitoggle/3/5') btnAThree = val
  if (addr === '/2/multitoggle/4/5') btnBThree = val
  if (addr === '/2/multitoggle/5/5') btnCThree = val

  // Toggles A/B/C CoreEnergy (2D)
  if (addr === '/2/multitoggle/3/3') btnA = val
  if (addr === '/2/multitoggle/4/3') btnB = val
  if (addr === '/2/multitoggle/5/3') btnC = val

  // Small puff when 1 is pressed
  if (addr === '/2/led1' && val === 1) {
    particles = makeParticles(320)
    puffT = 0
  }

  // Toggles show/hide Cells, molecular nest background + Three core
  if (addr === '/2/multitoggle/1/5') {
    showCoreEnergyThree = val === 1 // Three.js core ON/OFF
    if (window.ThreeCore && window.ThreeCore.setVisible) {
      window.ThreeCore.setVisible(showCoreEnergyThree)
    }
  }

  if (addr === '/2/multitoggle/1/3') showCoreEnergy = val === 1 // CoreEnergy
  if (addr === '/2/multitoggle/1/2') showAtomsNestBackground = val === 1 // atomNetBackground
  if (addr === '/2/multitoggle/1/4') showCellsMicro = val === 1 // cells-micro
  if (addr === '/2/multitoggle/2/4') useHandForCells = val === 1 // hand control ON/OFF
}

// Processing → /uv/eq [bass, mid, tre]
function onOscEq(pkt) {
  if (!pkt || pkt.address !== '/uv/eq' || !pkt.args || pkt.args.length < 3) {
    return
  }

  const bass = Number(pkt.args[0]) || 0
  const mid = Number(pkt.args[1]) || 0
  const tre = Number(pkt.args[2]) || 0

  // extra smoothing on the p5 side (Processing already smooths a bit)
  micBass = lerp(micBass, bass, MIC_SMOOTH)
  micMid = lerp(micMid, mid, MIC_SMOOTH)
  micTre = lerp(micTre, tre, MIC_SMOOTH)
}

// -------------------- draw --------------------
function draw() {
  background(30)

  let targetOpen = fader2

  if (useHandForCells) {
    // only hand gesture
    targetOpen = handOpenness
    // alternative mix:  targetOpen = 0.5 * fader2 + 0.5 * handOpenness
  }
  // Smooth the faders
  s1 += (fader1 - s1) * ALPHA
  s2 += (targetOpen - s2) * ALPHA
  s3 += (faderThree - s3) * ALPHA

  // Smooth the twist gesture
  sHandTwist += (handTwist - sHandTwist) * 0.2 // 0.2 = how fast it reacts

  // Volume Fader
  if (window.bgMusic && window.bgMusic.isPlaying()) {
    window.bgMusic.setVolume(faderVolume)
  }

  // --- INTRO FIRST ---
  if (!Intro_isDone() && showIntro) {
    Intro_updateAndDraw(deltaTime / 1000)
    // no return: intro can coexist with the rest if you want
  }

  // --- Background: rotating molecular nest ---
  if (showAtomsNestBackground) {
    drawMolecularNestBackground(frameCount * 0.002)
  }

  // --- Optional puff particles when '/2/led1' is tapped ---
  if (particles.length) {
    puffT += deltaTime / 1000
    drawPuff(puffT)
    if (puffT > 1.5) particles = []
  }

  // --- CoreEnergy (smoke moon) driven by fader1 ---
  if (showCoreEnergy) {
    const coreR = map(s1, 0, 1, 50, 300)
    CoreEnergy_draw({ R: coreR, btnA, btnB, btnC })
  }

  // --- Three.js Core driven by faderThree + mic audio (Processing) ---
  if (showCoreEnergyThree && window.ThreeCore && window.ThreeCore.update) {
    // baseline radius from faderThree
    const radiusBase = map(s3, 0, 1, 0.8, 3.0)

    // overall audio energy (0..1)
    const audioEnergy = constrain((micBass + micMid + micTre) / 3, 0, 1)

    // let bass/energy gently “breathe” the sphere
    const radiusReactive = radiusBase * (1.0 + 0.4 * audioEnergy)

    // same color logic as before
    let rgb = { r: 100, g: 200, b: 255 } // blue default
    if (btnAThree) rgb = { r: 255, g: 80, b: 80 } // red
    if (btnBThree) rgb = { r: 80, g: 255, b: 120 } // greenish
    if (btnCThree) rgb = { r: 255, g: 255, b: 100 } // yellow

    window.ThreeCore.update({
      radius: radiusReactive,
      color: rgb,
      audio: {
        bass: micBass,
        mid: micMid,
        tre: micTre,
      },
    })
  }

  // --- Cells Micro Organism ring driven by fader2 / hand (openness 0..1) ---
  if (showCellsMicro) {
    drawCellRing(s2, frameCount * 0.02)
  }

  // HUD (optional)
  fill(255)
  noStroke()
  textAlign(LEFT, TOP)
  text(
    `open: ${handOpenness.toFixed(2)}\n` +
      `twist: ${handTwist.toFixed(2)}\n` +
      `sTwist: ${sHandTwist.toFixed(2)}`,
    10,
    10
  )
  // text(`bass:${micBass.toFixed(2)} mid:${micMid.toFixed(2)} tre:${micTre.toFixed(2)}`,
  //   width / 2, height - 28)
}

// -------------------- sound --------------------
async function unlockAudio() {
  try {
    if (getAudioContext().state !== 'running') {
      await userStartAudio()
    }

    if (window.bgMusic && !window.bgMusic.isPlaying()) {
      window.bgMusic.setVolume(faderVolume)
      window.bgMusic.loop()
    }
  } catch (e) {
    console.warn('Cant initiate audio:', e)
  }
}

// -------------------- Visuals --------------------

// Ring of organic cells that opens with p in [0..1]
function drawCellRing(p, t) {
  push()
  translate(width / 2, height / 2)

  const numCells = 7

  // how far from center (open/close)
  const orbitRadius = lerp(0, 210, easeOutCubic(p))

  // overall audio energy 0..1 (uses globals from Processing)
  const audioEnergy = constrain((micBass + micMid + micTre) / 3, 0, 1)
  // twist factor from the hand (-PI..PI approx)
  const ringTwistAngle = sHandTwist * PI // try up to 180º

  // rotate the whole ring of cells according to the hand twist
  rotate(ringTwistAngle)

  for (let i = 0; i < numCells; i++) {
    // base angle plus small wobble
    const angle = (i * TWO_PI) / numCells + 0.25 * sin(t * 0.7 + i * 1.3)

    // break the perfect circle a bit
    const localOrbit =
      orbitRadius * (0.9 + 0.12 * sin(t * 0.9 + i * 0.8) + 0.08 * audioEnergy)

    const bx = localOrbit * cos(angle)
    const by = localOrbit * sin(angle)

    push()
    translate(bx, by)

    // base size also depends on openness + audio
    const baseR = lerp(26, 80, 0.4 + 0.6 * p) * (0.9 + 0.3 * audioEnergy)

    // small beating motion
    const wobble = 1 + 0.18 * sin(t * 0.9 + i * 0.7)

    // deep blue → more cyan on some
    const coreColor = {
      r: 40 + 10 * i,
      g: 110 + 30 * sin(t * 0.3 + i),
      b: 200 + 25 * cos(t * 0.4 + i),
    }

    drawCell(baseR * wobble, t + i * 8.7, coreColor, audioEnergy)

    pop()
  }

  pop()
}

// One organic, glowing "cell-like" organism
function drawCell(baseRadius, t, rgb, audioEnergy = 0) {
  const points = 95

  // softer, layered noise
  noiseDetail(3, 0.55)

  push()

  // --- outer halo (breathes with audio) ---
  drawingContext.save()
  drawingContext.shadowBlur = baseRadius * (0.7 + 0.8 * audioEnergy)
  drawingContext.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`

  noStroke()
  fill(rgb.r, rgb.g, rgb.b, 28 + 40 * audioEnergy)
  ellipse(
    0,
    0,
    baseRadius * (2.1 + 0.7 * audioEnergy),
    baseRadius * (2.1 + 0.7 * audioEnergy)
  )

  drawingContext.restore()

  // --- membrane (wobbly contour) ---
  noStroke()
  fill(rgb.r, rgb.g, rgb.b, 125)

  beginShape()
  for (let i = 0; i < points; i++) {
    const a = (TWO_PI * i) / points

    // layered noise for more organic edge
    const n1 = noise(cos(a) * 0.8 + t * 0.18, sin(a) * 0.8 + t * 0.18)
    const n2 = noise(cos(a + 1.7) * 1.3 + t * 0.1, sin(a + 3.1) * 1.3 + t * 0.1)

    const n = lerp(n1, n2, 0.5 + 0.5 * audioEnergy)
    const r = baseRadius * (0.78 + 0.35 * n + 0.15 * audioEnergy * n)

    const x = r * cos(a)
    const y = r * sin(a)

    curveVertex(x, y)
  }
  endShape(CLOSE)

  // --- soft inner halo ---
  fill(255, 190, 90, 80 + 60 * audioEnergy)
  ellipse(0, 0, baseRadius * 1.15, baseRadius * 1.15)

  // --- main core ---
  fill(255, 190, 70, 235)
  ellipse(0, 0, baseRadius * 0.8, baseRadius * 0.8)

  // --- spark-like granules inside ---
  const dots = 55
  for (let i = 0; i < dots; i++) {
    // noise instead of pure random → twinkle, but not totally chaotic
    const k = noise(i * 0.37, t * 1.1)

    const r = lerp(baseRadius * 0.1, baseRadius * 0.36, k)
    const a = i * (TWO_PI / dots) + t * 0.15

    const x = r * cos(a)
    const y = r * sin(a)

    const size = lerp(1.5, 4, k) * (1.0 + 0.6 * audioEnergy)
    const alpha = 120 + 80 * k + 40 * audioEnergy

    fill(255, 215, 140, alpha)
    circle(x, y, size)
  }

  // --- glossy highlight ---
  fill(255, 255, 255, 135)
  ellipse(
    -baseRadius * 0.35,
    -baseRadius * 0.42,
    baseRadius * 0.7,
    baseRadius * 0.46
  )

  pop()
}

function drawMolecularNestBackground(theta) {
  push()
  translate(width / 2, height / 2)
  const rings = 4
  for (let r = 0; r < rings; r++) {
    const rad = 60 + r * 55
    const n = 10 + r * 6
    for (let i = 0; i < n; i++) {
      const a = theta * 0.4 + (i * TWO_PI) / n + r * 0.3
      const x = rad * cos(a)
      const y = rad * sin(a)
      const s = 4 + r * 1.2
      fill(180 - r * 25, 180 - r * 25, 220, 150)
      circle(x, y, s)

      if (i % 3 === 0) {
        const a2 = a + 0.25 + 0.1 * sin(theta * 1.5 + r)
        const x2 = (rad + 25) * cos(a2)
        const y2 = (rad + 25) * sin(a2)
        stroke(120, 130, 200, 70)
        line(x, y, x2, y2)
        noStroke()
      }
    }
  }
  pop()
}

// Tiny particle puff
function makeParticles(n) {
  const arr = []
  for (let i = 0; i < n; i++) {
    arr.push({
      x: width / 2,
      y: height / 2,
      vx: random(-2, 2),
      vy: random(-2, 2),
      life: random(1.0, 1.5),
    })
  }
  return arr
}

function drawPuff(tp) {
  for (const pa of particles) {
    pa.x += pa.vx
    pa.y += pa.vy
    const k = 1 - tp / pa.life
    if (k > 0) {
      fill(255, 200 * k)
      circle(pa.x, pa.y, 2 + 2 * k)
    }
  }
}

// Easing
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

function CoreEnergy_resize() {
  if (!CE_layer) return
  CE_layer.remove()
  CE_layer = createGraphics(width, height)
  CE_layer.pixelDensity(1)
  CE_layer.imageMode(CENTER)
  CE_layer.colorMode(HSB, 360, 100, 100, 255)
}

// -------------------- Hands --------------------

function initHands() {
  hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    },
  })

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5,
  })

  hands.onResults(onHandsResults)

  // use MediaPipe Camera utility to feed frames from p5 video
  mpCamera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt })
    },
    width: 640,
    height: 480,
  })

  mpCamera.start()
}

function onHandsResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0]
    updateHandGesturesFromLandmarks(landmarks)
  }
}

// landmarks: array of 21 points {x,y,z} in normalized 0..1 coords
function updateHandGesturesFromLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 21) return

  const wrist = landmarks[0]
  const middleTip = landmarks[12]
  const middleMcp = landmarks[9]

  // --- hand scale (approx size of detected hand) ---
  const sx = middleMcp.x - wrist.x
  const sy = middleMcp.y - wrist.y
  const handScale = Math.sqrt(sx * sx + sy * sy) + 1e-6

  // --- openness: wrist ↔ middle fingertip distance, normalized by hand scale ---
  const dx = middleTip.x - wrist.x
  const dy = middleTip.y - wrist.y
  const d = Math.sqrt(dx * dx + dy * dy) // 0..~0.4 approx

  const dNorm = d / handScale

  const MIN_D = 0.8 // closed fist
  const MAX_D = 1.6 // fully open hand

  let open = map(dNorm, MIN_D, MAX_D, 0, 1)
  open = constrain(open, 0, 1)
  handOpenness = open

  // --- twist of the hand (orientation from wrist → index base) ---
  const indexMcp = landmarks[5] // base of index finger

  const vx = indexMcp.x - wrist.x
  const vy = indexMcp.y - wrist.y

  // angle of that vector in radians
  const angle = Math.atan2(vy, vx) // ~[-PI, PI]

  // you can calibrate these values by logging console.log(angle)
  const MIN_A = -1.2 // hand rotated to one side
  const MAX_A = 1.2 // hand rotated to the other side

  let twist = map(angle, MIN_A, MAX_A, -1, 1)
  twist = constrain(twist, -1, 1)

  handTwist = twist
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
  if (typeof CoreEnergy_resize === 'function') CoreEnergy_resize()
  if (window.ThreeCore && window.ThreeCore.resize) {
    window.ThreeCore.resize()
  }
}
