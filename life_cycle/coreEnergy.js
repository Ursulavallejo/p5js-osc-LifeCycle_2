// CoreEnergy.js — modular smoke core (no p5 setup/draw, no sockets)
// Exposes: CoreEnergy_preload(path), CoreEnergy_init(), CoreEnergy_draw({R, btnA, btnB, btnC, dt})

let CE_particleTexture = null
const CE_system = { particles: [], img: null }

// Evolution of the noise field
const CE_NOISE_TIME = 1.8

// Internal helpers (module scope, no globals leaked)
function CE_addParticle(sys, R) {
  const a = random(TWO_PI)
  const rPos = sqrt(random()) * (R * 0.96)
  const pos = p5.Vector.fromAngle(a, rPos).add(
    createVector(width / 2, height / 2)
  )
  sys.particles.push({
    x: pos.x,
    y: pos.y,
    vx: random(-0.18, 0.18),
    vy: random(-0.18, 0.18),
    life: random(180, 320),
    size: random(5, 9),
    dead: false,
  })
}

function CE_pickTint(btnA, btnB, btnC) {
  // Default: cool blue
  if (btnA) return { h: 340, s: 90, b: 100, a: 60 } // red
  if (btnB) return { h: 180, s: 85, b: 100, a: 55 } // green
  if (btnC) return { h: 50, s: 95, b: 100, a: 65 } // yellow
  return { h: 220, s: 25, b: 100, a: 48 } // blue (default)
}

// Curl-noise → divergence-free field
function CE_curlNoise(x, y, z) {
  const e = 0.0005
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

  // Flow field
  const n = CE_curlNoise(p.x * turb, p.y * turb, t * CE_NOISE_TIME)
  let ax = n.x * 1.6
  let ay = n.y * 1.6

  // Tangential spin + inward drift
  const tx = cx - p.x,
    ty = cy - p.y
  const len = Math.hypot(tx, ty) || 1
  const ux = -ty / len,
    uy = tx / len
  ax += ux * spin
  ay += uy * spin
  const k = drift / len
  ax += tx * k
  ay += ty * k

  // Integrate (fast)
  p.vx = Math.max(Math.min(p.vx + ax, 3.0), -3.0)
  p.vy = Math.max(Math.min(p.vy + ay, 3.0), -3.0)
  p.x += p.vx * 2.0
  p.y += p.vy * 2.0

  // Micro jitter to softly fill the interior
  p.x += (Math.random() - 0.5) * 0.1
  p.y += (Math.random() - 0.5) * 0.1

  // Keep inside circle (no sqrt)
  const dx = p.x - cx,
    dy = p.y - cy
  const rEdge = R * 0.985
  if (dx * dx + dy * dy > rEdge * rEdge) {
    const invLen = 1 / (Math.hypot(dx, dy) || 1)
    p.x -= dx * 0.8 * invLen
    p.y -= dy * 0.8 * invLen
    p.vx *= 0.4
    p.vy *= 0.4
  }

  // Life
  p.life -= 1
  p.dead = p.life <= 0
}

function CE_runSystem(sys, R) {
  const t = millis() * 0.001

  // Gentle continuous modulation
  const w1 = sin(t * 0.9) * 0.5 + 0.5
  const w2 = sin(t * 1.1) * 0.5 + 0.5
  const w3 = sin(t * 0.7) * 0.5 + 0.5
  const spin = lerp(-0.28, 0.32, w1)
  const turb = lerp(0.002, 0.0042, w2)
  const drift = lerp(0.05, 0.15, w3)

  for (let i = sys.particles.length - 1; i >= 0; i--) {
    const p = sys.particles[i]
    CE_stepParticle(p, t, turb, spin, drift, R)
    image(sys.img, p.x, p.y, p.size, p.size)
    if (p.dead) sys.particles.splice(i, 1)
  }

  // Keep density stable
  while (sys.particles.length < 2600) CE_addParticle(sys, R)
}

function CE_trailInsideCircle(cx, cy, R, alpha) {
  // Rellena de negro translúcido SOLO el área del clip actual (el círculo)
  // Sin esto, el background del sketch se veía "lavado".
  noStroke()
  fill(0, alpha)
  // Un rectángulo grande sirve porque seguimos dentro del clip
  rect(cx - R - 2, cy - R - 2, (R + 2) * 2, (R + 2) * 2)
}

// ---------------- Public API ----------------

function CoreEnergy_preload(path = './assets/texture.png') {
  CE_particleTexture = loadImage(path)
}

function CoreEnergy_init() {
  // Assumes colorMode already set by the main sketch
  CE_system.img = CE_particleTexture
  // Seed particles once (will top-up on the fly)
  for (let i = 0; i < 2600; i++) CE_addParticle(CE_system, 220) // initial R ~220
  // Set once
  imageMode(CENTER)
}

function CoreEnergy_draw({ R, btnA = 0, btnB = 0, btnC = 0, trailAlpha = 28 }) {
  const cx = width / 2,
    cy = height / 2

  // 1) Clip SOLO el área del círculo
  drawingContext.save()
  drawingContext.beginPath()
  drawingContext.arc(cx, cy, R, 0, TWO_PI)
  drawingContext.clip()

  // 2) Trail SOLO dentro del círculo (sin tocar el resto de la escena)
  CE_trailInsideCircle(cx, cy, R, trailAlpha)

  // 3) ADD blending SOLO para las partículas
  const prevComposite = drawingContext.globalCompositeOperation
  drawingContext.globalCompositeOperation = 'lighter' // = ADD

  // 4) Tint en HSB, pero restauramos luego el modo de color
  colorMode(HSB, 360, 100, 100, 255)
  const tcol = CE_pickTint(btnA, btnB, btnC)
  tint(tcol.h, tcol.s, tcol.b, tcol.a)

  // 5) Actualizar + dibujar partículas
  CE_runSystem(CE_system, R)

  // 6) Restaurar estado gráfico
  tint(255) // quita el tint global
  colorMode(RGB, 255) // devuelve modo de color por defecto
  drawingContext.globalCompositeOperation = prevComposite
  drawingContext.restore()
}

// (Optional) expose a light reset if you ever want to flush and re-seed
function CoreEnergy_reset(R = 220) {
  CE_system.particles.length = 0
  for (let i = 0; i < 2600; i++) CE_addParticle(CE_system, R)
}
