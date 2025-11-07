// ====================================================================
// --- LÓGICA DEL MÓDULO INTRO (intro.js FIXEADO) ---
// La corrección clave es usar textAlign(CENTER, TOP) de forma consistente
// tanto al dibujar el texto (Fase 0) como al muestrear los píxeles (Fase 1).
// ====================================================================

let __intro_state = {
  baseBG: 30, // sketch gray
  phase: 0, // 0: fade-in text, 1: particles, 2: done
  t: 0, // time inside the phase (seconds)
  fadeSec: 3.5,
  holdSec: 2.0,

  quote:
    '“The nitrogen in our DNA, the calcium in our teeth, the iron in our blood — were made in the interiors of collapsing stars. We are made of star-stuff.”',
  author: '— Carl Sagan',

  // assets: font will use monospace
  font: null,
  readyFont: true,

  // layout (vertical anchors)
  yQuoteFrac: 0.52,
  yAuthorFrac: 0.78,
}

// Dissolve effect control (spring that loosens over time)
const __intro_dissolve = {
  k0: 30, // Increased initial stiffness (more sticky at start)
  tau: 2.5, // Seconds to fully loosen (faster dissolution)
  jitter: 0.6, // lateral noise
}

// Letter particles
let __intro_pix = []

// -------------------- Public API --------------------
function Intro_init(opts = {}) {
  __intro_state.fadeSec = opts.fadeSec ?? __intro_state.fadeSec
  __intro_state.holdSec = opts.holdSec ?? __intro_state.holdSec

  if (typeof opts.yQuoteFrac === 'number')
    __intro_state.yQuoteFrac = opts.yQuoteFrac
  if (typeof opts.yAuthorFrac === 'number')
    __intro_state.yAuthorFrac = opts.yAuthorFrac

  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_pix = [] // clean on reset
}

function Intro_updateAndDraw(dtSeconds) {
  if (!__intro_state.readyFont) return false

  __intro_state.t += dtSeconds
  background(__intro_state.baseBG)

  if (__intro_state.phase === 0) {
    __intro_drawQuoteFade() // text fade-in

    if (__intro_state.t >= __intro_state.fadeSec + __intro_state.holdSec) {
      // 1) Bake points from text (canvas coords)
      const pts = __intro_bakePointsFromText()
      // 2) Create particles "anchored" to those points (home)
      __intro_pix = pts.map((p) => new __Pix(p.x, p.y))
      __intro_state.phase = 1
      __intro_state.t = 0 // Reset time for dissolution
    }
    return false
  }

  if (__intro_state.phase === 1) {
    __intro_runPix(dtSeconds) // letter particles loosening
    return false
  }

  return true // phase 2: done
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

// -------------------- Text Drawing (Phase 0) --------------------
function __intro_drawQuoteFade() {
  const fadeIn = __intro_state.fadeSec
  const t = __intro_state.t
  const alpha =
    t <= fadeIn ? __easeOutCubic(constrain(t / fadeIn, 0, 1)) * 255 : 255

  const L = __intro_layout()

  push()
  // KEY FIX: Use CENTER, TOP alignment for drawing to match pixel baking.
  textAlign(CENTER, TOP)

  // Use monospace font as custom font file is not available
  textFont('MomoTrustDisplay')

  // Quote
  const quoteSize = __intro_pickTextSize(false)
  textSize(quoteSize)
  textLeading(quoteSize * 1.12)

  // Subtle glow
  for (let i = 3; i > 0; i--) {
    const a = alpha * 0.16 * (i / 3)
    fill(255, a)
    noStroke()
    // Use L.boxYQuote (which is the calculated TOP coordinate)
    text(__intro_state.quote, L.boxX + L.boxW / 2, L.boxYQuote, L.boxW, L.boxH)
  }

  // Main text
  fill(255, alpha)
  noStroke()
  text(__intro_state.quote, L.boxX + L.boxW / 2, L.boxYQuote, L.boxW, L.boxH)

  // Author
  const authorSize = __intro_pickTextSize(true)
  textSize(authorSize)
  fill(255, alpha)

  // Calculate the TOP position for the Author, immediately below the Quote box
  const authorDrawY = L.boxYQuote + L.boxH
  text(
    __intro_state.author,
    L.boxX + L.boxW / 2,
    authorDrawY,
    L.boxW,
    L.authorH
  )

  pop()
}

// -------------------- Shared Layout Calculation --------------------
function __intro_layout() {
  const margin = min(width, height) * 0.08
  const boxW = Math.round(width - margin * 2)
  const boxH = Math.round(height * 0.5) // Quote box height
  const authorH = Math.round(boxH * 0.15) // Author box height
  const boxX = Math.round((width - boxW) / 2)

  // Calculate the Y TOP position for the Quote box based on the fraction anchor
  const quoteTopY = Math.round(height * __intro_state.yQuoteFrac - boxH / 2)

  return {
    boxX,
    boxW,
    boxH,
    boxYQuote: quoteTopY, // Y (TOP) coordinate for Quote
    authorH: authorH, // Author height
  }
}

// Baking white pixels from text → {x,y} points on the canvas
function __intro_bakePointsFromText() {
  const L = __intro_layout()

  // The buffer size must accommodate the Quote + Author
  const bufferH = L.boxH + L.authorH
  const g = createGraphics(L.boxW, bufferH)
  g.pixelDensity(1)
  g.background(0)
  g.fill(255)
  g.noStroke()

  // Same font as displayed:
  g.textFont('MomoTrustDisplay')

  // KEY FIX: Use CENTER, TOP alignment in the buffer to match the drawing function.
  g.textAlign(CENTER, TOP)

  // Quote
  const quoteSize = __intro_pickTextSize(false)
  g.textSize(quoteSize)
  g.textLeading(quoteSize * 1.12)
  // Draw Quote in the center X of the buffer, at Y=0 (TOP)
  g.text(__intro_state.quote, L.boxW / 2, 0, L.boxW, L.boxH)

  // Author
  const authorSize = __intro_pickTextSize(true)
  g.textSize(authorSize)
  // Draw Author immediately below the Quote box (at Y = L.boxH)
  g.text(__intro_state.author, L.boxW / 2, L.boxH, L.boxW, L.authorH)

  // Sampling
  g.loadPixels()
  const pts = []
  const step = 4
  for (let y = 0; y < g.height; y += step) {
    for (let x = 0; x < g.width; x += step) {
      const idx = (y * g.width + x) * 4
      if (g.pixels[idx] > 200) {
        pts.push({
          // Map buffer coordinates (x, y) back to canvas coordinates,
          // anchored by L.boxX and L.boxYQuote (both TOP coordinates).
          x: L.boxX + x + random(-0.3, 0.3),
          y: L.boxYQuote + y + random(-0.3, 0.3),
        })
      }
    }
  }
  g.remove()
  return pts
}

function __intro_pickTextSize(isAuthor = false) {
  const base = min(width, height)
  return isAuthor ? max(16, base * 0.03) : max(18, base * 0.042)
}

// -------------------- Particles (Phase 1) --------------------
class __Pix {
  constructor(x, y) {
    this.home = createVector(x, y)
    this.pos = createVector(x, y)
    this.vel = createVector(random(-0.05, 0.05), random(-0.05, 0.05))
    this.size = random(2.2, 3.6)
  }
  step(dt, k) {
    // Spring force towards home (decays as k approaches 0)
    const toHome = p5.Vector.sub(this.home, this.pos).mult(k * dt)
    this.vel.add(toHome)

    // Organic drift with noise
    const jitter = __intro_dissolve.jitter
    this.vel.x +=
      jitter * (noise(this.pos.y * 0.003, frameCount * 0.003) - 0.5) * dt
    this.vel.y +=
      jitter * (noise(this.pos.x * 0.003, frameCount * 0.003) - 0.5) * dt

    this.vel.limit(3.0)

    this.pos.add(this.vel)

    // Border bounce
    const m = 6
    if (this.pos.x < m) {
      this.pos.x = m
      this.vel.x *= -1
      this.vel.x += 0.05
    }
    if (this.pos.x > width - m) {
      this.pos.x = width - m
      this.vel.x *= -1
      this.vel.x -= 0.05
    }
    if (this.pos.y < m) {
      this.pos.y = m
      this.vel.y *= -1
      this.vel.y += 0.05
    }
    if (this.pos.y > height - m) {
      this.pos.y = height - m
      this.vel.y *= -1
      this.vel.y -= 0.05
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

  // KEY FIX: Transition to "done" phase when the spring is fully released (k is very small)
  if (k < 0.01 && __intro_state.t > 1.0) {
    __intro_state.phase = 2
    return
  }

  for (let i = 0; i < __intro_pix.length; i++) {
    const p = __intro_pix[i]
    p.step(dt, k)
    p.draw()
  }
}

function __easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
