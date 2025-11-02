// === TouchOSC Beatmachine Mk2 → p5.js (2 faders + 3 buttons) ===
// fader1: controls core radius (blue circle)
// fader2: controls flower openness (0..1)
// buttons A/B/C: tint overrides (R/G/Y)

let socket

// UI state (from OSC)
let fader1 = 0 // 0..1  (core size)
let fader2 = 0 // 0..1  (flower openness)
let btnA = 0,
  btnB = 0,
  btnC = 0

// Smoothing for nicer motion
let s1 = 0,
  s2 = 0
const ALPHA = 0.25

// Particles for a tiny "bloom puff" when btnA is tapped (optional)
let particles = []
let puffT = 0

function setup() {
  createCanvas(windowWidth, windowHeight)
  pixelDensity(1)
  noStroke()
  textAlign(CENTER, CENTER)
  textSize(16)
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

    // Faders (Beatmachine Mk2 typical addresses)
    if (addr === '/1/fader1') fader1 = constrain(val, 0, 1)
    if (
      addr === '/1/fader2' || // common
      addr === '/1/slider2' || // some templates
      addr === '/fader2' // fallback alias
    ) {
      fader2 = constrain(val, 0, 1)
    }

    // Buttons A / B / C (you already confirmed these in console)
    if (addr === '/1/push12') btnA = val
    if (addr === '/1/push11') btnB = val
    if (addr === '/1/push10') btnC = val

    // Optional: small puff when A is pressed
    if (addr === '/group7/push1' && val === 1) {
      particles = makeParticles(120)
      puffT = 0
    }

    // Debug log
    // console.log('OSC →', addr, val)
  })
}

function draw() {
  background(30)

  // Smooth the faders
  s1 += (fader1 - s1) * ALPHA
  s2 += (fader2 - s2) * ALPHA

  // --- Background: rotating molecular nest ---
  drawMolecularNest(frameCount * 0.002)

  // --- Core (blue circle) driven by fader1 ---
  let coreR = map(s1, 0, 1, 50, 300)

  // Color override via buttons (momentary)
  let col = color(100, 200, 255) // default blue
  if (btnA) col = color(255, 80, 80) // red
  if (btnB) col = color(80, 255, 120) // green
  if (btnC) col = color(255, 255, 100) // yellow

  fill(col)
  ellipse(width / 2, height / 2, coreR)

  // --- Flower driven by fader2 (openness 0..1) ---
  drawFlowerAtCenter(s2, frameCount * 0.02)

  // --- Optional puff particles when A is tapped ---
  if (particles.length) {
    puffT += deltaTime / 1000
    drawPuff(puffT)
    if (puffT > 1.5) particles = []
  }

  // HUD
  fill(255)
  noStroke()
  text(
    `fader1(core): ${nf(fader1, 1, 2)}   fader2(flower): ${nf(
      fader2,
      1,
      2
    )}   A:${btnA} B:${btnB} C:${btnC}`,
    width / 2,
    height - 28
  )
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

// -------------------- Visuals --------------------

// Simple flower that opens with p in [0..1]
function drawFlowerAtCenter(p, t) {
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

function drawMolecularNest(theta) {
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
