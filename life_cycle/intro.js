// intro.js — posiciones sincronizadas (texto y partículas idénticos)

// -------------------- Estado --------------------
let __intro_state = {
  baseBG: 30,
  phase: 0, // 0: fade texto, 1: partículas, 2: done
  t: 0,
  fadeSec: 3.5,
  holdSec: 2.0,

  quote:
    '“The nitrogen in our DNA, the calcium in our teeth, the iron in our blood — were made in the interiors of collapsing stars. We are made of star-stuff.”',
  author: '— Carl Sagan',

  yQuoteFrac: 0.52,
  yAuthorFrac: 0.78,
}

// efecto disolver
const __intro_dissolve = { k0: 18, tau: 1.0, jitter: 0.6 }

// partículas
let __intro_pix = []

// -------------------- API --------------------
function Intro_init(opts = {}) {
  __intro_state.fadeSec = opts.fadeSec ?? __intro_state.fadeSec
  __intro_state.holdSec = opts.holdSec ?? __intro_state.holdSec
  if (typeof opts.yQuoteFrac === 'number')
    __intro_state.yQuoteFrac = opts.yQuoteFrac
  if (typeof opts.yAuthorFrac === 'number')
    __intro_state.yAuthorFrac = opts.yAuthorFrac
  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_pix = []
}

function Intro_updateAndDraw(dt) {
  __intro_state.t += dt
  push()
  resetMatrix()
  background(__intro_state.baseBG)

  if (__intro_state.phase === 0) {
    __intro_drawQuoteFade()
    if (__intro_state.t >= __intro_state.fadeSec + __intro_state.holdSec) {
      const pts = __intro_bakePointsFromText()
      __intro_pix = pts.map((p) => new __Pix(p.x, p.y))
      __intro_state.phase = 1
      __intro_state.t = 0
    }
    pop()
    return false
  }

  if (__intro_state.phase === 1) {
    __intro_runPix(dt)
    pop()
    return false
  }

  pop()
  return true
}

function Intro_isDone() {
  return __intro_state.phase === 2
}
function Intro_reset() {
  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_pix = []
}
function Intro_skip() {
  __intro_state.phase = 2
  __intro_state.t = 0
  __intro_pix = []
}

// -------------------- Texto (fase 0) --------------------
function __intro_drawQuoteFade() {
  const fadeIn = __intro_state.fadeSec
  const t = __intro_state.t
  const alpha =
    t <= fadeIn ? __easeOutCubic(constrain(t / fadeIn, 0, 1)) * 255 : 255
  const L = __intro_layout()

  push()
  textFont('MomoTrustDisplay')
  textAlign(LEFT, TOP) // <— IGUAL que en el bake

  // Cita
  const quoteSize = __intro_pickTextSize(false)
  textSize(quoteSize)
  textLeading(quoteSize * 1.12)
  for (let i = 3; i > 0; i--) {
    // glow sutil
    fill(255, alpha * 0.16 * (i / 3))
    noStroke()
    text(__intro_state.quote, L.boxX, L.boxYQuote, L.boxW, L.boxH)
  }
  fill(255, alpha)
  noStroke()
  text(__intro_state.quote, L.boxX, L.boxYQuote, L.boxW, L.boxH)

  // Autor
  const authorSize = __intro_pickTextSize(true)
  textSize(authorSize)
  fill(255, alpha)
  text(__intro_state.author, L.boxX, L.boxYAuthor, L.boxW, L.boxH * 0.25)
  pop()
}

// -------------------- Layout --------------------
function __intro_layout() {
  const margin = min(width, height) * 0.08
  const boxW = Math.round(width - margin * 2)
  const boxH = Math.round(height * 0.62)
  const boxX = Math.round((width - boxW) / 2)
  const boxYQuote = Math.round(height * __intro_state.yQuoteFrac - boxH / 2)
  const boxYAuthor = Math.round(
    height * __intro_state.yAuthorFrac - (boxH * 0.25) / 2
  )
  return { boxX, boxW, boxH, boxYQuote, boxYAuthor }
}

// -------------------- Bake de puntos (cita y autor por separado) --------------------
function __intro_bakePointsFromText() {
  const L = __intro_layout()
  const authorH = Math.round(L.boxH * 0.25)
  const pts = []

  // --- CITA ---
  const gQ = createGraphics(L.boxW, L.boxH)
  gQ.pixelDensity(1)
  gQ.background(0)
  gQ.fill(255)
  gQ.noStroke()
  gQ.textFont('MomoTrustDisplay')
  gQ.textAlign(LEFT, TOP) // <— IGUAL
  const qSize = __intro_pickTextSize(false)
  gQ.textSize(qSize)
  gQ.textLeading(qSize * 1.12)
  gQ.text(__intro_state.quote, 0, 0, L.boxW, L.boxH)
  gQ.loadPixels()
  const step = 4
  for (let y = 0; y < gQ.height; y += step) {
    for (let x = 0; x < gQ.width; x += step) {
      const idx = (y * gQ.width + x) * 4
      if (gQ.pixels[idx] > 200) {
        pts.push({
          x: L.boxX + x + random(-0.3, 0.3),
          y: L.boxYQuote + y + random(-0.3, 0.3),
        })
      }
    }
  }

  // --- AUTOR ---
  const gA = createGraphics(L.boxW, authorH)
  gA.pixelDensity(1)
  gA.background(0)
  gA.fill(255)
  gA.noStroke()
  gA.textFont('MomoTrustDisplay')
  gA.textAlign(LEFT, TOP) // <— IGUAL
  const aSize = __intro_pickTextSize(true)
  gA.textSize(aSize)
  gA.text(__intro_state.author, 0, 0, L.boxW, authorH)
  gA.loadPixels()
  for (let y = 0; y < gA.height; y += step) {
    for (let x = 0; x < gA.width; x += step) {
      const idx = (y * gA.width + x) * 4
      if (gA.pixels[idx] > 200) {
        pts.push({
          x: L.boxX + x + random(-0.3, 0.3),
          y: L.boxYAuthor + y + random(-0.3, 0.3),
        })
      }
    }
  }

  return pts
}

function __intro_pickTextSize(isAuthor = false) {
  const base = min(width, height)
  return isAuthor ? max(16, base * 0.03) : max(18, base * 0.042)
}

// -------------------- Partículas (fase 1) --------------------
class __Pix {
  constructor(x, y) {
    this.home = createVector(x, y)
    this.pos = createVector(x, y)
    this.vel = createVector(random(-0.05, 0.05), random(-0.05, 0.05))
    this.size = random(2.2, 3.6)
  }
  step(dt, k) {
    const toHome = p5.Vector.sub(this.home, this.pos).mult(k * dt)
    this.vel.add(toHome)
    this.vel.x +=
      __intro_dissolve.jitter *
      (noise(this.pos.y * 0.003, frameCount * 0.003) - 0.5) *
      dt
    this.vel.y +=
      __intro_dissolve.jitter *
      (noise(this.pos.x * 0.003, frameCount * 0.003) - 0.5) *
      dt
    this.vel.limit(1.2)
    this.pos.add(this.vel)
    const m = 6
    if (this.pos.x < m) {
      this.pos.x = m
      this.vel.x *= -1
    }
    if (this.pos.x > width - m) {
      this.pos.x = width - m
      this.vel.x *= -1
    }
    if (this.pos.y < m) {
      this.pos.y = m
      this.vel.y *= -1
    }
    if (this.pos.y > height - m) {
      this.pos.y = height - m
      this.vel.y *= -1
    }
  }
  draw() {
    noStroke()
    fill(255, 230)
    circle(this.pos.x, this.pos.y, this.size)
  }
}

function __intro_runPix(dt) {
  if (!__intro_pix.length) return
  const t = __intro_state.t
  const k = __intro_dissolve.k0 * Math.exp(-t / __intro_dissolve.tau)
  for (const p of __intro_pix) {
    p.step(dt, k)
    p.draw()
  }
}

// -------------------- Helpers --------------------
function __easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
