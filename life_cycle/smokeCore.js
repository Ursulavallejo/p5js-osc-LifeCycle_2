// === SmokeCore ULTRA-OPTIMIZED ===
// Strategy: Minimize draw calls, pre-compute expensive operations, use WebGL

let SC_tex = null
let SC_buffer = null
const SC_particles = []

// Performance settings
const NOISE_TIME = 1.8
const MIN_PARTS = 600 // Reduced for better performance
const MAX_PARTS = 1800 // Reduced but still looks good
const TRAIL_ALPHA = 55

// Noise field cache (pre-computed grid)
const NOISE_GRID_SIZE = 40 // 40x40 grid instead of per-pixel
let noiseField = []
let noiseFieldTime = 0

// Adaptive LOD
let targetParts = MAX_PARTS
let fpsEMA = 60

// ---------- NOISE FIELD PRE-COMPUTATION ----------
// Instead of calculating noise for EVERY particle, we sample a grid
function updateNoiseField() {
  const t = millis() * 0.001 * NOISE_TIME
  noiseFieldTime = t

  // Only update every other frame for speed
  if (frameCount % 2 !== 0) return

  noiseField = []
  for (let gy = 0; gy < NOISE_GRID_SIZE; gy++) {
    noiseField[gy] = []
    for (let gx = 0; gx < NOISE_GRID_SIZE; gx++) {
      const x = gx / NOISE_GRID_SIZE
      const y = gy / NOISE_GRID_SIZE

      // Curl noise calculation
      const e = 0.01
      const n1 = noise(x, y + e, t)
      const n2 = noise(x, y - e, t)
      const n3 = noise(x + e, y, t)
      const n4 = noise(x - e, y, t)

      noiseField[gy][gx] = {
        x: -(n1 - n2) / (2 * e),
        y: (n3 - n4) / (2 * e),
      }
    }
  }
}

// Sample from pre-computed grid (bilinear interpolation)
function sampleNoiseField(px, py) {
  const gx = (px / width) * (NOISE_GRID_SIZE - 1)
  const gy = (py / height) * (NOISE_GRID_SIZE - 1)

  const gxi = Math.floor(gx) | 0
  const gyi = Math.floor(gy) | 0

  if (
    gxi < 0 ||
    gyi < 0 ||
    gxi >= NOISE_GRID_SIZE - 1 ||
    gyi >= NOISE_GRID_SIZE - 1
  ) {
    return { x: 0, y: 0 }
  }

  // Bilinear interpolation
  const fx = gx - gxi
  const fy = gy - gyi

  const n00 = noiseField[gyi][gxi]
  const n10 = noiseField[gyi][gxi + 1]
  const n01 = noiseField[gyi + 1][gxi]
  const n11 = noiseField[gyi + 1][gxi + 1]

  const nx =
    (n00.x * (1 - fx) + n10.x * fx) * (1 - fy) +
    (n01.x * (1 - fx) + n11.x * fx) * fy
  const ny =
    (n00.y * (1 - fx) + n10.y * fx) * (1 - fy) +
    (n01.y * (1 - fx) + n11.y * fx) * fy

  return { x: nx, y: ny }
}

// ---------- PARTICLE SYSTEM ----------
function addParticle(R) {
  const a = Math.random() * TWO_PI
  const r = Math.sqrt(Math.random()) * R * 0.96
  const cx = width / 2
  const cy = height / 2

  SC_particles.push({
    x: cx + Math.cos(a) * r,
    y: cy + Math.sin(a) * r,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    life: 150 + Math.random() * 120,
    size: 6 + Math.random() * 5,
    alpha: 0.15 + Math.random() * 0.1,
  })
}

function stepParticle(p, R, spin, drift) {
  const cx = width / 2
  const cy = height / 2

  // Sample noise field (much faster than computing per particle!)
  const n = sampleNoiseField(p.x, p.y)
  let ax = n.x * 2.5
  let ay = n.y * 2.5

  // Tangential spin
  const dx = p.x - cx
  const dy = p.y - cy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const invDist = 1 / dist

  ax += -dy * invDist * spin
  ay += dx * invDist * spin

  // Inward drift
  ax += -dx * invDist * drift
  ay += -dy * invDist * drift

  // Update velocity with damping
  p.vx = (p.vx + ax) * 0.95
  p.vy = (p.vy + ay) * 0.95

  // Clamp velocity
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
  if (speed > 2.5) {
    p.vx *= 2.5 / speed
    p.vy *= 2.5 / speed
  }

  // Update position
  p.x += p.vx * 2.5
  p.y += p.vy * 2.5

  // Micro jitter
  p.x += (Math.random() - 0.5) * 0.15
  p.y += (Math.random() - 0.5) * 0.15

  // Keep inside circle (fast squared distance check)
  const distSq = dx * dx + dy * dy
  const edgeSq = R * 0.98 * (R * 0.98)
  if (distSq > edgeSq) {
    const pushBack = 1 - Math.sqrt(edgeSq / distSq)
    p.x -= dx * pushBack
    p.y -= dy * pushBack
    p.vx *= 0.3
    p.vy *= 0.3
  }

  // Life decay
  p.life -= 1
  return p.life > 0
}

// ---------- RENDERING ----------
function renderParticles(R, tint) {
  SC_buffer.push()
  SC_buffer.noStroke()
  SC_buffer.imageMode(CENTER)

  // Apply tint once for all particles
  SC_buffer.tint(tint.h, tint.s, tint.b, 255)

  // Clip to circle ONCE before drawing all particles
  const cx = width / 2
  const cy = height / 2
  SC_buffer.drawingContext.save()
  SC_buffer.drawingContext.beginPath()
  SC_buffer.drawingContext.arc(cx, cy, R, 0, TWO_PI)
  SC_buffer.drawingContext.clip()

  // Batch draw all particles with individual alpha
  for (const p of SC_particles) {
    SC_buffer.tint(tint.h, tint.s, tint.b, p.alpha * 255)
    SC_buffer.image(SC_tex, p.x, p.y, p.size, p.size)
  }

  SC_buffer.drawingContext.restore()
  SC_buffer.pop()
}

// ---------- COLOR SELECTION ----------
function getColor(btnA, btnB, btnC) {
  if (btnA) return { h: 340, s: 90, b: 100 }
  if (btnB) return { h: 180, s: 85, b: 100 }
  if (btnC) return { h: 50, s: 95, b: 100 }
  return { h: 220, s: 25, b: 100 }
}

// ---------- ADAPTIVE LOD ----------
function updateLOD(dt) {
  const fps = 1 / Math.max(dt, 1 / 120)
  fpsEMA = fpsEMA * 0.85 + fps * 0.15

  if (fpsEMA < 45) {
    targetParts = Math.max(MIN_PARTS, (targetParts * 0.92) | 0)
  } else if (fpsEMA > 55) {
    targetParts = Math.min(MAX_PARTS, (targetParts + 15) | 0)
  }
}

// ---------- PUBLIC API ----------
function SmokeCore_preload(path = './texture.png') {
  SC_tex = loadImage(path)
}

function SmokeCore_init() {
  // Use P2D renderer for better performance than default
  SC_buffer = createGraphics(width, height)
  SC_buffer.pixelDensity(1)
  SC_buffer.colorMode(HSB, 360, 100, 100, 255)
  SC_buffer.imageMode(CENTER)

  // Initialize particles
  SC_particles.length = 0
  for (let i = 0; i < targetParts; i++) {
    addParticle(220)
  }

  // Pre-compute noise field
  noiseDetail(3, 0.5)
  updateNoiseField()
}

let prevTime = 0

function SmokeCore_draw({ R = 220, btnA = 0, btnB = 0, btnC = 0 } = {}) {
  const now = millis()
  const dt = (now - prevTime) / 1000
  prevTime = now

  updateLOD(dt)

  const cx = width / 2
  const cy = height / 2

  // Update noise field (every other frame)
  updateNoiseField()

  // Smooth motion parameters
  const t = now * 0.001
  const w1 = Math.sin(t * 0.9) * 0.5 + 0.5
  const w3 = Math.sin(t * 0.7) * 0.5 + 0.5
  const spin = -0.25 + 0.5 * w1
  const drift = 0.06 + 0.08 * w3

  // Update particles
  for (let i = SC_particles.length - 1; i >= 0; i--) {
    if (!stepParticle(SC_particles[i], R, spin, drift)) {
      SC_particles.splice(i, 1)
    }
  }

  // Maintain particle count
  while (SC_particles.length < targetParts) {
    addParticle(R)
  }

  // Fade trail
  SC_buffer.push()
  SC_buffer.drawingContext.save()
  SC_buffer.drawingContext.beginPath()
  SC_buffer.drawingContext.arc(cx, cy, R, 0, TWO_PI)
  SC_buffer.drawingContext.clip()
  SC_buffer.fill(0, TRAIL_ALPHA)
  SC_buffer.noStroke()
  SC_buffer.rect(0, 0, width, height)
  SC_buffer.drawingContext.restore()
  SC_buffer.pop()

  // Render particles with color
  const tint = getColor(btnA, btnB, btnC)
  renderParticles(R, tint)

  // Composite to main canvas
  const prevBlend = drawingContext.globalCompositeOperation
  drawingContext.globalCompositeOperation = 'lighter'
  image(SC_buffer, 0, 0)
  drawingContext.globalCompositeOperation = prevBlend
}

function SmokeCore_resize() {
  if (!SC_buffer) return
  SC_buffer.remove()
  SC_buffer = createGraphics(width, height)
  SC_buffer.pixelDensity(1)
  SC_buffer.colorMode(HSB, 360, 100, 100, 255)
  SC_buffer.imageMode(CENTER)
  updateNoiseField()
}
