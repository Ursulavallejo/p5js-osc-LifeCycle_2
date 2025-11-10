// === Smooth smoke moon — p5.js + OSC (low-latency, smoother) ===

let particleTexture
// R (radius) is controlled live by an OSC fader
let R = 220
const centerVec = () => createVector(width / 2, height / 2)

// --- OSC state (always keep the latest values only) ---
let socket
let faderRaw = 0 // last raw fader value (0..1)
let faderSmoothed = 0 // (kept if you want smoothing again later)
let buttonA = 0,
  buttonB = 0,
  buttonC = 0

// --- Controls how fast the noise field evolves over time ---
const NOISE_TIME = 1.8

// --- Global speed multiplier for particle motion ---
const GLOBAL_SPEED = 3.5 // try 1.5..3.0

const system = { particles: [], img: null }

// --- Simple frame-time integrator (for frame-rate independence) ---
let prevMs = 0

function preload() {
  particleTexture = loadImage('./assets/texture.png')
}

function setup() {
  createCanvas(windowWidth, windowHeight)
  pixelDensity(1) // less work on HiDPI screens
  colorMode(HSB, 360, 100, 100, 255)
  noiseDetail(4, 0.35)

  system.img = particleTexture

  // Connect to the OSC bridge (no per-packet console spam)
  setupOSC()

  // Initial particle population
  for (let i = 0; i < 2600; i++) addParticle(system)

  background(0)

  // Set once per sketch (calling inside loops slows things down)
  imageMode(CENTER)
}

function setupOSC() {
  socket = io('http://127.0.0.1:8081', {
    transports: ['websocket'],
    upgrade: false,
  })

  // Tell bridge which OSC ports to use
  socket.emit('config', {
    server: { host: '0.0.0.0', port: 12000 }, // OSC → bridge (IN)
    client: { host: '127.0.0.1', port: 8000 }, // bridge → OSC (OUT)
  })

  socket.on('connected', (ok) => console.log('OSC bridge connected:', ok))

  // Keep only the latest values for each control
  socket.on('message', (msg) => {
    const [addr, val] = msg
    if (addr === '/2/multifader/2') faderRaw = val
    if (addr === '/2/multitoggle/3/2') buttonA = val
    if (addr === '/2/multitoggle/4/2') buttonB = val
    if (addr === '/2/multitoggle/5/2') buttonC = val
  })
}

function draw() {
  // --- Compute dt (seconds) for stable motion regardless of FPS ---
  const now = millis()
  const dt = constrain((now - prevMs) / 1000, 0, 0.033)
  prevMs = now

  // --- Fast/adaptive radius mapping from the fader ---
  const R_MIN = 50,
    R_MAX = 400
  const R_target = map(faderRaw, 0, 1, R_MIN, R_MAX)
  const dR = Math.abs(R_target - R)
  const kFast = dR > 40 ? 0.85 : dR > 15 ? 0.6 : 0.35 // bigger jump → faster catch-up
  R = lerp(R, R_target, kFast)

  // --- Trail + glow (ADD blending builds the soft smoke) ---
  blendMode(BLEND)
  background(0, 0, 0, 35) // higher alpha = shorter trail
  blendMode(ADD)

  // --- Clip drawing to the current circle (mask) ---
  drawingContext.save()
  drawingContext.beginPath()
  drawingContext.arc(width / 2, height / 2, R, 0, TWO_PI)
  drawingContext.clip()

  // --- Draw animated smoke using the current flow field ---
  runSystem(system, dt)

  drawingContext.restore()
}

/* ---------------- System (functional) ---------------- */

function runSystem(sys, dt) {
  // Time (seconds)
  const t = millis() * 0.001

  // Gentle continuous modulation of field parameters
  const w1 = sin(t * 0.9) * 0.5 + 0.5
  const w2 = sin(t * 1.1) * 0.5 + 0.5
  const w3 = sin(t * 0.7) * 0.5 + 0.5

  const spin = lerp(-0.28, 0.32, w1) // tangential swirl
  const turb = lerp(0.002, 0.0042, w2) // noise scale
  const drift = lerp(0.05, 0.15, w3) // soft inward pull

  // Decide color once per frame (don’t tint inside the loop)
  const tintColor = pickTintFromButtons()
  tint(tintColor.h, tintColor.s, tintColor.b, tintColor.a)

  // Update + render particles (iterate backwards so we can remove)
  for (let i = sys.particles.length - 1; i >= 0; i--) {
    const p = sys.particles[i]
    stepParticle(p, t, dt, turb, spin, drift)
    renderParticle(p, sys.img)
    if (p.dead) sys.particles.splice(i, 1)
  }

  // Keep density stable
  while (sys.particles.length < 2600) addParticle(sys)
}

function addParticle(sys) {
  // Spawn uniformly inside the current circle
  const a = random(TWO_PI)
  const rPos = sqrt(random()) * (R * 0.96)
  const pos = p5.Vector.fromAngle(a, rPos).add(centerVec())
  sys.particles.push(makeParticle(pos, sys.img))
}

/* ---------------- Particles (scalar, GC-friendly) ---------------- */

function makeParticle(pos, tex) {
  return {
    x: pos.x,
    y: pos.y, // position
    vx: random(-0.18, 0.18), // velocity
    vy: random(-0.18, 0.18),
    life: random(180, 320),
    tex,
    size: random(5, 9),
    dead: false,
  }
}

function renderParticle(p, tex) {
  image(tex, p.x, p.y, p.size, p.size)
}

function stepParticle(p, t, turb, spin, drift) {
  // Cache center
  const cx = width * 0.5,
    cy = height * 0.5

  // Flow field from curl-noise (numbers, not p5.Vector)
  const n = curlNoise(p.x * turb, p.y * turb, t * NOISE_TIME)
  let ax = n.x * 1.6
  let ay = n.y * 1.6

  // Vector to center
  const tx = cx - p.x,
    ty = cy - p.y
  const len = Math.hypot(tx, ty) || 1

  // Tangential spin (rotate toward 90° and set magnitude)
  const ux = -ty / len,
    uy = tx / len
  ax += ux * spin
  ay += uy * spin

  // Soft inward drift
  const k = drift / len
  ax += tx * k
  ay += ty * k

  // Integrate (fast) + global speed
  p.vx = Math.max(Math.min(p.vx + ax, 3.0), -3.0)
  p.vy = Math.max(Math.min(p.vy + ay, 3.0), -3.0)
  p.x += p.vx * 2.0 // tweak factor for overall motion
  p.y += p.vy * 2.0

  // Micro jitter fills interior softly
  p.x += (Math.random() - 0.5) * 0.1
  p.y += (Math.random() - 0.5) * 0.1

  // Keep inside circle (no sqrt)
  const dx = p.x - cx,
    dy = p.y - cy
  if (dx * dx + dy * dy > R * 0.985 * (R * 0.985)) {
    const invLen = 1 / (Math.hypot(dx, dy) || 1)
    p.x -= dx * 0.8 * invLen
    p.y -= dy * 0.8 * invLen
    p.vx *= 0.4
    p.vy *= 0.4
  }

  // Lifetime
  p.life -= 1
  p.dead = p.life <= 0
}

/* ---------------- Tint from OSC buttons (once per frame) ---------------- */

function pickTintFromButtons() {
  // Default: cool blue
  if (buttonA) return { h: 340, s: 90, b: 100, a: 60 } // red
  if (buttonB) return { h: 180, s: 85, b: 100, a: 55 } // green
  if (buttonC) return { h: 50, s: 95, b: 100, a: 65 } // yellow
  return { h: 220, s: 25, b: 100, a: 48 } // blue (default)
}

/* ---------------- Curl-noise utility ---------------- */
// Finite differences on Perlin noise gradient, rotated 90° → divergence-free field.
function curlNoise(x, y, z) {
  const e = 0.0005
  const n1 = noise(x, y + e, z),
    n2 = noise(x, y - e, z)
  const a = (n1 - n2) / (2 * e)
  const n3 = noise(x + e, y, z),
    n4 = noise(x - e, y, z)
  const b = (n3 - n4) / (2 * e)
  return { x: -a, y: b } // plain object (no p5.Vector allocations)
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}
