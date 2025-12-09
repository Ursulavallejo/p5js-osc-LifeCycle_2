// === TouchOSC Beatmachine Mk2 → p5.js ( faders +  buttons) ===
// fader1: controls CoreEnergy radius (smoke moon size)
// fader2: controls Atoms openness (0..1)
// faderVolume: controls Background Music Volume (0..1)
// faderThree: controls CoreEnergy Three size
// buttons A/B/C: CoreEnergy tint overrides (Burgundy/Turquoise/Yellow) // Same Three

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
let showAtoms = false // true: draw atoms, false: hide atoms
let showAtomsNestBackground = false
let showCoreEnergy = false
let showCoreEnergyThree = false // Three js

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

  // Intro ON/OFF desde TouchOSC (1 = ON, 0 = OFF)
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
  // atoms movement
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

  // Toggles show/hide Atoms and atomNetBackground + Three core
  if (addr === '/2/multitoggle/1/5') {
    showCoreEnergyThree = val === 1 // Three.js core ON/OFF
    if (window.ThreeCore && window.ThreeCore.setVisible) {
      window.ThreeCore.setVisible(showCoreEnergyThree)
    }
  }

  if (addr === '/2/multitoggle/1/3') showCoreEnergy = val === 1 // CoreEnergy
  if (addr === '/2/multitoggle/1/2') showAtomsNestBackground = val === 1 // atomNetBackground
  if (addr === '/2/multitoggle/1/4') showAtoms = val === 1 // atoms
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

  // Smooth the faders
  s1 += (fader1 - s1) * ALPHA
  s2 += (fader2 - s2) * ALPHA
  s3 += (faderThree - s3) * ALPHA

  // Volume Fader
  if (window.bgMusic && window.bgMusic.isPlaying()) {
    window.bgMusic.setVolume(faderVolume)
  }

  // --- INTRO FIRST ---
  if (!Intro_isDone() && showIntro) {
    Intro_updateAndDraw(deltaTime / 1000)
    // no return: intro puede convivir con el resto si quieres
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

  // --- Atoms driven by fader2 (openness 0..1) ---
  if (showAtoms) {
    drawAtomsAtCenter(s2, frameCount * 0.02)
  }

  // HUD (opcional)
  fill(255)
  noStroke()
  // text(`bass:${micBass.toFixed(2)} mid:${micMid.toFixed(2)} tre:${micTre.toFixed(2)}`,
  //   width / 2, height - 28)
}

// -------------------- sound -------------------
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

// Simple Atoms that opens with p in [0..1]
// function drawAtomsAtCenter(p, t) {
//   push()
//   translate(width / 2, height / 2)

//   const radius = lerp(30, 140, easeOutCubic(p))
//   const petals = 8

//   for (let i = 0; i < petals; i++) {
//     const a = (i * TWO_PI) / petals + 0.3 * sin(t * 1.5)
//     const px = radius * cos(a)
//     const py = radius * sin(a)

//     fill(255, 140 + 50 * sin(t + i), 180)
//     ellipse(px, py, 40, 90)
//   }

//   fill(255, 220, 120)
//   circle(0, 0, lerp(30, 55, p))
//   pop()
// }

// Organic "micro-organism" atoms that open with p in [0..1]
function drawAtomsAtCenter(p, t) {
  push()
  translate(width / 2, height / 2)

  // how many blobs around the center
  const numBlobs = 6

  // base radius for how far they sit from the center (open/close)
  const orbitRadius = lerp(40, 180, easeOutCubic(p))

  for (let i = 0; i < numBlobs; i++) {
    const angle = (i * TWO_PI) / numBlobs + 0.4 * sin(t * 0.6 + i)

    // position of each blob around the center
    const bx = orbitRadius * cos(angle)
    const by = orbitRadius * sin(angle)

    push()
    translate(bx, by)

    // base size: grows with p
    const baseR = lerp(25, 70, 0.4 + 0.6 * p)

    // slight breathing/organic vibration
    const wobble = 1 + 0.2 * sin(t * 0.7 + i)

    // color: deep midnight blue → electric ice-blue
    // puedes ajustar estos valores RGB para matizar los tonos
    const coreColor = {
      r: 40 + 30 * i,
      g: 120 + 10 * i,
      b: 200 + 20 * sin(t * 0.4 + i),
    }

    drawOrganicBlob(baseR * wobble, t + i * 10.0, coreColor)
    circle(0, 0, lerp(30, 55, p))
    pop()
  }

  pop()
}

// One organic, semi-transparent "bacteria-like" blob
function drawOrganicBlob(baseRadius, t, rgb) {
  const points = 80 // detail for the contour

  noStroke()

  // main body (semi-transparent liquid glass feeling)
  fill(rgb.r, rgb.g, rgb.b, 180)
  beginShape()
  for (let i = 0; i < points; i++) {
    const a = (TWO_PI * i) / points

    // noise-based deformation of radius
    // feel free to tweak the 0.8 / 0.3 / 0.25 factors
    const n = noise(cos(a) * 0.8 + t * 0.12, sin(a) * 0.8 + t * 0.12)

    const r = baseRadius * (0.7 + 0.35 * n)
    const x = r * cos(a)
    const y = r * sin(a)

    curveVertex(x, y)
  }
  endShape(CLOSE)

  // inner core / nucleus
  fill(255, 255, 255, 70)
  ellipse(0, 0, baseRadius * 0.8, baseRadius * 0.8)

  fill(min(255, rgb.r + 40), min(255, rgb.g + 40), min(255, rgb.b + 40), 210)
  ellipse(0, 0, baseRadius * 0.45, baseRadius * 0.45)

  // small highlight to fake "glossy liquid-glass"
  fill(255, 255, 255, 90)
  ellipse(
    -baseRadius * 0.3,
    -baseRadius * 0.35,
    baseRadius * 0.6,
    baseRadius * 0.4
  )
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
  if (typeof CoreEnergy_resize === 'function') CoreEnergy_resize()
  if (window.ThreeCore && window.ThreeCore.resize) {
    window.ThreeCore.resize()
  }
}
