// CoreEnergy.js — smoke core (optimized)
// Public API: CoreEnergy_preload(path), CoreEnergy_init(), CoreEnergy_draw({ R, btnA, btnB, btnC, trailAlpha })

let CE_tex = null
let CE_layer = null // off-screen buffer
const CE_sys = { particles: [], img: null }

// Tunables
const CE_NOISE_TIME = 1.8
const CE_MIN_PARTS = 800 // adaptive floor
const CE_MAX_PARTS = 2600 // adaptive ceiling (your old value)
const CE_STEP_SPEED = 2.0 // overall motion factor
const CE_ALPHA_DEFAULT = 32 // trail strength inside the circle

// Timing + auto LOD
let CE_prevMs = 0
let CE_fpsEMA = 60 // exponential moving average of fps
const CE_FPS_GOOD = 54 // if above → can increase density
const CE_FPS_BAD = 48 // if below → must reduce density
let CE_targetParts = CE_MAX_PARTS

// ---------- internal helpers ----------
function CE_addParticle(R) {
  const a = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * (R * 0.96)
  const cx = width * 0.5,
    cy = height * 0.5
  const x = cx + Math.cos(a) * r
  const y = cy + Math.sin(a) * r
  CE_sys.particles.push({
    x,
    y,
    vx: Math.random() * 0.36 - 0.18,
    vy: Math.random() * 0.36 - 0.18,
    life: 180 + Math.random() * 140,
    size: 5 + Math.random() * 4,
    dead: false,
  })
}

function CE_pickTint(btnA, btnB, btnC) {
  if (btnA) return { h: 340, s: 90, b: 100, a: 60 }
  if (btnB) return { h: 180, s: 85, b: 100, a: 55 }
  if (btnC) return { h: 50, s: 95, b: 100, a: 65 }
  return { h: 220, s: 25, b: 100, a: 48 }
}

function CE_curlNoise(x, y, z) {
  const e = 0.001 // a bit larger than 0.0005 → fewer fine ripples (cheaper feel)
  const n1 = noise(x, y + e, z),
    n2 = noise(x, y - e, z)
  const a = (n1 - n2) / (2 * e)
  const n3 = noise(x + e, y, z),
    n4 = noise(x - e, y, z)
  const b = (n3 - n4) / (2 * e)
  return { x: -a, y: b }
}

function CE_stepParticle(p, t, turb, spin, drift, R) {
  const cx = width * 0.5,
    cy = height * 0.5
  const n = CE_curlNoise(p.x * turb, p.y * turb, t * CE_NOISE_TIME)
  let ax = n.x * 1.6
  let ay = n.y * 1.6

  const tx = cx - p.x,
    ty = cy - p.y
  const lenInv = 1 / (Math.sqrt(tx * tx + ty * ty) || 1)

  // tangential spin
  const ux = -ty * lenInv
  const uy = tx * lenInv
  ax += ux * spin
  ay += uy * spin

  // inward drift
  const k = drift * lenInv
  ax += tx * k
  ay += ty * k

  // integrate
  p.vx = Math.max(Math.min(p.vx + ax, 3.0), -3.0)
  p.vy = Math.max(Math.min(p.vy + ay, 3.0), -3.0)
  p.x += p.vx * CE_STEP_SPEED
  p.y += p.vy * CE_STEP_SPEED

  // micro jitter (very small)
  p.x += (Math.random() - 0.5) * 0.08
  p.y += (Math.random() - 0.5) * 0.08

  // keep inside (no sqrt)
  const dx = p.x - cx,
    dy = p.y - cy
  const edge = R * 0.985,
    edge2 = edge * edge
  if (dx * dx + dy * dy > edge2) {
    const rinv = 1 / (Math.sqrt(dx * dx + dy * dy) || 1)
    p.x -= dx * 0.8 * rinv
    p.y -= dy * 0.8 * rinv
    p.vx *= 0.4
    p.vy *= 0.4
  }

  // life
  p.life -= 1
  p.dead = p.life <= 0
}

function CE_runSystem(R) {
  const t = millis() * 0.001
  // smooth field params
  const w1 = Math.sin(t * 0.9) * 0.5 + 0.5
  const w2 = Math.sin(t * 1.1) * 0.5 + 0.5
  const w3 = Math.sin(t * 0.7) * 0.5 + 0.5
  const spin = -0.28 + 0.6 * w1 // [-0.28..0.32]
  const turb = 0.002 + 0.0022 * w2 // [0.002..0.0042]
  const drift = 0.05 + 0.1 * w3 // [0.05..0.15]

  // update + draw on the off-screen layer
  CE_layer.push()
  CE_layer.noStroke()
  CE_layer.tint(255) // reset per-sprite tint; we tint once globally in draw()

  for (let i = CE_sys.particles.length - 1; i >= 0; i--) {
    const p = CE_sys.particles[i]
    CE_stepParticle(p, t, turb, spin, drift, R)
    CE_layer.image(CE_sys.img, p.x, p.y, p.size, p.size)
    if (p.dead) CE_sys.particles.splice(i, 1)
  }
  CE_layer.pop()

  // keep density (adaptive target)
  while (CE_sys.particles.length < CE_targetParts) CE_addParticle(R)
  // if we overshoot (because target was reduced), trim softly
  if (CE_sys.particles.length > CE_targetParts) {
    CE_sys.particles.length = CE_targetParts | 0
  }
}

function CE_trailInLayer(cx, cy, R, alpha) {
  // fade only where the smoke lives (clip path on the off-screen layer)
  CE_layer.push()
  CE_layer.noStroke()
  CE_layer.erase(0, 0) // clear with alpha? no → use normal fill in clip
  CE_layer.drawingContext.save()
  CE_layer.drawingContext.beginPath()
  CE_layer.drawingContext.arc(cx, cy, R, 0, Math.PI * 2)
  CE_layer.drawingContext.clip()
  CE_layer.fill(0, alpha) // translucent black to keep trail
  CE_layer.rect(cx - R - 2, cy - R - 2, (R + 2) * 2, (R + 2) * 2)
  CE_layer.drawingContext.restore()
  CE_layer.pop()
}

function CE_updateLOD(dt) {
  // fps EMA
  const fps = 1 / Math.max(dt, 1 / 120)
  CE_fpsEMA = CE_fpsEMA * 0.9 + fps * 0.1

  if (CE_fpsEMA < CE_FPS_BAD) {
    // too slow → drop target quickly
    CE_targetParts = Math.max(CE_MIN_PARTS, (CE_targetParts * 0.9) | 0)
  } else if (CE_fpsEMA > CE_FPS_GOOD) {
    // good headroom → increase slowly
    CE_targetParts = Math.min(CE_MAX_PARTS, (CE_targetParts + 20) | 0)
  }
}

// ---------- Public API ----------
function CoreEnergy_preload(path = './assets/texture.png') {
  CE_tex = loadImage(path)
}

function CoreEnergy_init() {
  CE_layer = createGraphics(width, height)
  CE_layer.pixelDensity(1)
  CE_layer.imageMode(CENTER)
  CE_layer.colorMode(HSB, 360, 100, 100, 255)

  CE_sys.img = CE_tex
  CE_sys.particles.length = 0
  CE_targetParts = CE_MAX_PARTS
  for (let i = 0; i < CE_targetParts; i++) CE_addParticle(220) // initial seed

  CE_prevMs = millis()
}

function CoreEnergy_draw({
  R,
  btnA = 0,
  btnB = 0,
  btnC = 0,
  trailAlpha = CE_ALPHA_DEFAULT,
}) {
  const now = millis()
  const dt = Math.min((now - CE_prevMs) / 1000, 0.05) // clamp at 50ms
  CE_prevMs = now
  CE_updateLOD(dt)

  const cx = width * 0.5,
    cy = height * 0.5

  // 1) fade trail ONLY on the smoke layer inside the circle
  CE_trailInLayer(cx, cy, R, trailAlpha)

  // 2) set global tint for this frame (in the smoke layer)
  const tcol = CE_pickTint(btnA, btnB, btnC)
  CE_layer.push()
  CE_layer.colorMode(HSB, 360, 100, 100, 255)
  CE_layer.tint(tcol.h, tcol.s, tcol.b, tcol.a)

  // 3) step & draw particles to the off-screen layer
  CE_runSystem(R)
  CE_layer.pop()

  // 4) composite the smoke layer to the main canvas with ADD
  //   (no need to change main sketch blendMode permanently)
  const prev = drawingContext.globalCompositeOperation
  drawingContext.globalCompositeOperation = 'lighter'
  image(CE_layer, 0, 0)
  drawingContext.globalCompositeOperation = prev
}

// Optional, if window resizes:
function CoreEnergy_resize() {
  if (!CE_layer) return
  CE_layer.remove()
  CE_layer = createGraphics(width, height)
  CE_layer.pixelDensity(1)
  CE_layer.imageMode(CENTER)
  CE_layer.colorMode(HSB, 360, 100, 100, 255)
}
