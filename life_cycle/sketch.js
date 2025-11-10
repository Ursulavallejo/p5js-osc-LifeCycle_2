// === TouchOSC Beatmachine Mk2 → p5.js (2 faders + 3 buttons) ===
// fader1: controls core radius (blue circle)
// fader2: controls atoms openness (0..1)
// buttons A/B/C: tint overrides (R/G/Y)
window.bgMusic = null
let socket

// UI state (from OSC)
let fader1 = 0 // 0..1  (core size)
let faderDemo = 0 // 0..1  (core size DEMO)
let faderVolume = 0.5 // 0..1 (Volumen de bgMusic, valor por defecto)

let fader2 = 0 // 0..1  (atoms openness)
let btnA = 0, // Core Energy
  btnB = 0,
  btnC = 0
//DEMO CIRCLES !!
let btnADemo = 0,
  btnBDemo = 0,
  btnCDemo = 0

// toggle state to show/hide the atoms (controlled by /1/toggle2)
// Convention: 1 → show, 0 → hide
let showIntro = false
let showAtoms = false // true: draw atoms, false: hide atoms
let showAtomsNestBackground = false
let showCoreEnergy = false
let showCoreEnergyDemo = false //DEMO CIRCLES !!

// Smoothing for nicer motion
let s1 = 0,
  s2 = 0,
  s3 = 0
const ALPHA = 0.25

// Particles for a tiny "bloom puff" when btnA is tapped (optional)
let particles = []
let puffT = 0

//Intro
let img
let bgMusic

// CoreEnergy
function preload() {
  CoreEnergy_preload('./assets/texture.png')
  soundFormats('mp3', 'wav', 'ogg')
  window.bgMusic = loadSound('./assets/metamorphosis-experimental.mp3')
}

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
    server: { host: '0.0.0.0', port: 12000 },
    client: { host: '127.0.0.1', port: 8000 },
  })

  socket.on('connected', (ok) => console.log('Bridge connected?', ok))

  // Map TouchOSC messages → our variables
  socket.on('message', (msg) => {
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

    //  {  while (!Intro_isDone()) Intro_updateAndDraw(999) // avanzar a done
    // }

    // Faders

    // fader CoreEnergy DEMO CORE
    if (addr === '/2/multifader/5') faderDemo = constrain(val, 0, 1)
    // fader CoreEnergy
    if (addr === '/2/multifader/3') fader1 = constrain(val, 0, 1)
    // atoms movement
    if (addr === '/2/multifader/4') fader2 = constrain(val, 0, 1)
    // Sound
    if (addr === '/2/multifader/6') faderVolume = constrain(val, 0, 1)

    //Toogles
    // DEMO CORE !!Handle  A / B / C  Toogle change color CoreEnergy
    if (addr === '/2/multitoggle/3/5') btnADemo = val
    if (addr === '/2/multitoggle/4/5') btnBDemo = val
    if (addr === '/2/multitoggle/5/5') btnCDemo = val

    // Handle  A / B / C  Toogle change color CoreEnergy
    if (addr === '/2/multitoggle/3/3') btnA = val
    if (addr === '/2/multitoggle/4/3') btnB = val
    if (addr === '/2/multitoggle/5/3') btnC = val

    // Small puff when 1 is pressed
    if (addr === '/2/led1' && val === 1) {
      particles = makeParticles(320)
      puffT = 0
    }

    // Toogles show/hide Atoms and atomNetBackground
    // hide when 0, show when 1

    if (addr === '/2/multitoggle/1/5') showCoreEnergyDemo = val === 1 //CoreEnergy DEMO CIRCLES !!
    if (addr === '/2/multitoggle/1/3') showCoreEnergy = val === 1 //CoreEnergy
    if (addr === '/2/multitoggle/1/2') showAtomsNestBackground = val === 1 //atomNetBackground
    if (addr === '/2/multitoggle/1/4') showAtoms = val === 1 //atoms

    // Debug log
    // console.log('OSC →', addr, val)
  })

  // Initialize intro (you can pass a texture path or let it auto-generate one)
  Intro_init({
    fontPath: './assets/MomoTrustDisplay.ttf',
    // yQuoteFrac: 0.55, // texto un poco más abajo
    // yAuthorFrac: 0.8,
    fadeSec: 3.5,
    holdSec: 2.0,
  })
  // Initialize CoreEnergy
  CoreEnergy_init()
}

function draw() {
  background(30)

  // Smooth the faders
  s1 += (fader1 - s1) * ALPHA
  s2 += (fader2 - s2) * ALPHA
  s3 += (faderDemo - s3) * ALPHA

  // Volume Fader
  if (window.bgMusic && window.bgMusic.isPlaying()) {
    window.bgMusic.setVolume(faderVolume)
  }

  // --- INTRO FIRST ---
  if (!Intro_isDone() && showIntro) {
    Intro_updateAndDraw(deltaTime / 1000)
    // return
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

  // --- Core (blue circle) driven by faderDEMO ---
  if (showCoreEnergyDemo) {
    ///  SIMPLE CIRCLES FORM
    let coreRDemo = map(s3, 0, 1, 50, 300)
    // Color override via buttons (momentary)
    let col = color(100, 200, 255) // default blue
    if (btnADemo) col = color(255, 80, 80) // red
    if (btnBDemo) col = color(80, 255, 120) // green
    if (btnCDemo) col = color(255, 255, 100) // yellow

    fill(col)
    ellipse(width / 2, height / 2, coreRDemo)
    // const coreRDemo = map(s3, 0, 1, 50, 300)
    // CoreEnergy_draw({ R: coreRDemo, btnADemo, btnBDemo, btnCDemo })
  }

  // --- Atoms driven by fader2 (openness 0..1) ---
  if (showAtoms) {
    drawAtomsAtCenter(s2, frameCount * 0.02)
  }

  // HUD
  fill(255)
  noStroke()

  //DEBUG >>>
  // text(
  //   `fader1(core): ${nf(fader1, 1, 2)}   fader2(flower): ${nf(
  //     fader2,
  //     1,
  //     2
  //   )}   A:${btnA} B:${btnB} C:${btnC}`,
  //   width / 2,
  //   height - 28
  // )
}
// -------------------- sound -------------------
// async function unlockAudio() {
//   try {
//     // Desbloquear el contexto (userStartAudio es una función global de p5.sound)
//     if (getAudioContext().state !== 'running') {
//       await userStartAudio()
//     }

//     // Reproducir la música si está cargada y no está sonando
//     if (window.bgMusic && !window.bgMusic.isPlaying()) {
//       window.bgMusic.setVolume(0)
//       window.bgMusic.loop()
//       // Fade-in suave
//       window.bgMusic.fade(0.6, 1200) // p5.sound.fade(targetVolume, duration)
//     }
//   } catch (e) {
//     console.warn('coundt start audio:', e)
//   }
// }
async function unlockAudio() {
  try {
    // Desbloquear el contexto
    if (getAudioContext().state !== 'running') {
      await userStartAudio()
    }

    // Reproducir la música si está cargada y no está sonando
    if (window.bgMusic && !window.bgMusic.isPlaying()) {
      // Establecer el volumen inicial al valor del fader
      window.bgMusic.setVolume(faderVolume)
      window.bgMusic.loop()
    }
  } catch (e) {
    console.warn('Cant iniciate audio:', e)
  }
}
// -------------------- Visuals --------------------

// Simple Atoms that opens with p in [0..1]
function drawAtomsAtCenter(p, t) {
  push()
  translate(width / 2, height / 2)

  // radius grows with p (ease for nicer feel)
  const radius = lerp(30, 140, easeOutCubic(p))
  const petals = 8

  for (let i = 0; i < petals; i++) {
    const a = (i * TWO_PI) / petals + 0.3 * sin(t * 1.5)
    const px = radius * cos(a)
    const py = radius * sin(a)

    // subtle animated color
    fill(255, 140 + 50 * sin(t + i), 180)
    ellipse(px, py, 40, 90)
  }

  // core
  fill(255, 220, 120)
  circle(0, 0, lerp(30, 55, p))
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

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
  if (typeof CoreEnergy_resize === 'function') CoreEnergy_resize()
}
