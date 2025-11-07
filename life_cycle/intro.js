// intro.js
// Intro module for p5.js:
// 1) Sagan quote fade-in over a soft radial gradient.
// 2) Smoke particle effect with texture (or procedural fallback).
// 3) Public API:
//    Intro_init({ imgPath, fontPath, fadeSec, holdSec, smokeSec })
//    Intro_updateAndDraw(dtSeconds)
//    Intro_isDone()

let __intro_state = {
  phase: 0, // 0: fade-in text, 1: smoke, 2: done
  t: 0, // phase time (seconds)
  fadeSec: 3.5,
  holdSec: 2.0,
  smokeSec: 6.0, // <= 0 to run indefinitely
  quote:
    '“The nitrogen in our DNA, the calcium in our teeth, the iron in our blood — were made in the interiors of collapsing stars. We are made of star-stuff.”',
  author: '— Carl Sagan',

  // assets
  img: null, // smoke texture
  font: null, // custom font (optional)

  // smoke
  emitter: null,
  center: null,

  // layout
  yQuoteFrac: 0.52, // vertical anchor (0..1) for quote block (a bit below center)
  yAuthorFrac: 0.78,

  readyImg: false,
  readyFont: true, // default true (only set false if a font is loading)
  baseBG: 30, // base background so color matches your main scene
}

// -------------------- Public API --------------------
function Intro_init(opts = {}) {
  __intro_state.fadeSec = opts.fadeSec ?? __intro_state.fadeSec
  __intro_state.holdSec = opts.holdSec ?? __intro_state.holdSec
  __intro_state.smokeSec = opts.smokeSec ?? __intro_state.smokeSec

  // Optional overrides
  if (typeof opts.yQuoteFrac === 'number')
    __intro_state.yQuoteFrac = opts.yQuoteFrac
  if (typeof opts.yAuthorFrac === 'number')
    __intro_state.yAuthorFrac = opts.yAuthorFrac

  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_state.center = createVector(width * 0.5, height * 0.62)

  // Load smoke texture or create fallback
  __intro_state.readyImg = false
  if (opts.imgPath) {
    __intro_state.img = loadImage(
      opts.imgPath,
      () => {
        __intro_state.readyImg = true
      },
      () => {
        __intro_state.img = __intro_makeSoftCircleG(128)
        __intro_state.readyImg = true
      }
    )
  } else {
    __intro_state.img = __intro_makeSoftCircleG(128)
    __intro_state.readyImg = true
  }

  // Load custom font (optional)
  if (opts.fontPath) {
    __intro_state.readyFont = false
    __intro_state.font = loadFont(
      opts.fontPath,
      () => {
        __intro_state.readyFont = true
      },
      () => {
        __intro_state.font = null
        __intro_state.readyFont = true
      }
    )
  } else {
    __intro_state.font = null
    __intro_state.readyFont = true
  }

  // Build emitter
  __intro_state.emitter = new __Emitter(
    __intro_state.center.x,
    __intro_state.center.y,
    __intro_state.img
  )
}

function Intro_updateAndDraw(dtSeconds) {
  if (!(__intro_state.readyImg && __intro_state.readyFont)) return false

  __intro_state.t += dtSeconds

  if (__intro_state.phase === 0) {
    // Match your scene background to avoid color jump:
    background(__intro_state.baseBG)
    __intro_drawGradient(1.0)
    __intro_drawQuoteFade()
    if (__intro_state.t >= __intro_state.fadeSec + __intro_state.holdSec) {
      __intro_state.phase = 1
      __intro_state.t = 0
    }
    return false
  }

  if (__intro_state.phase === 1) {
    background(__intro_state.baseBG)
    __intro_drawGradient(0.25)
    __intro_runSmoke(dtSeconds)
    if (
      __intro_state.smokeSec > 0 &&
      __intro_state.t >= __intro_state.smokeSec
    ) {
      __intro_state.phase = 2
      __intro_state.t = 0
    }
    return false
  }

  return true // done
}

function Intro_isDone() {
  return __intro_state.phase === 2
}

// -------------------- Internals: Quote & Gradient --------------------
function __intro_drawGradient(strength = 1.0) {
  // Soft radial darkening (drawn on top of base background)
  push()
  noStroke()
  const cx = width * 0.5,
    cy = height * 0.5
  const maxR = sqrt(sq(width) + sq(height)) * 0.6
  for (let r = maxR; r > 0; r -= 8) {
    const a = map(r, 0, maxR, 180, 25) * strength
    fill(0, 0, 0, a)
    circle(cx, cy, r * 2)
  }
  pop()
}

function __intro_drawQuoteFade() {
  // Alpha for quote
  const fadeIn = __intro_state.fadeSec
  const t = __intro_state.t
  let alpha =
    t <= fadeIn ? __easeOutCubic(constrain(t / fadeIn, 0, 1)) * 255 : 255

  push()
  textAlign(CENTER, CENTER)

  // Use custom font if present (modern wide look)
  if (__intro_state.font) {
    textFont(__intro_state.font)
  } else {
    textFont('MomoTrustDisplay') // CSS @font-face fallback
  }

  // Block sizes
  const margin = min(width, height) * 0.08
  const boxW = width - margin * 2
  const boxH = height * 0.62

  // Center box horizontally and vertically (using fractions)
  const boxX = (width - boxW) / 2
  const boxYQuote = height * __intro_state.yQuoteFrac - boxH / 2
  const boxYAuthor = height * __intro_state.yAuthorFrac - (boxH * 0.25) / 2

  // Quote
  const quoteSize = __intro_pickTextSize(false)
  textSize(quoteSize)
  textLeading(quoteSize * 1.12)

  // Subtle glow layers
  const glowRepeats = 3
  for (let i = glowRepeats; i > 0; i--) {
    const a = alpha * 0.16 * (i / glowRepeats)
    fill(255, a)
    noStroke()
    text(__intro_state.quote, boxX, boxYQuote, boxW, boxH)
  }

  // Main text
  fill(255, alpha)
  noStroke()
  text(__intro_state.quote, boxX, boxYQuote, boxW, boxH)

  // Author (smaller)
  const authorSize = __intro_pickTextSize(true)
  textSize(authorSize)
  fill(255, alpha)
  text(__intro_state.author, boxX, boxYAuthor, boxW, boxH * 0.25)

  pop()
}

function __intro_pickTextSize(isAuthor = false) {
  const base = min(width, height)
  // Slightly larger than before for a bold, modern presence
  return isAuthor ? max(16, base * 0.03) : max(18, base * 0.042)
}

// -------------------- Internals: Smoke --------------------
function __intro_runSmoke(dt) {
  // gentle wind over time
  const dx = map(sin(frameCount * 0.01), -1, 1, -0.1, 0.1)
  const wind = createVector(dx, 0)

  // more particles so it's clearly visible
  for (let i = 0; i < 2; i++) __intro_state.emitter.addParticle()

  __intro_state.emitter.applyForce(wind)
  __intro_state.emitter.run()

  // optional tiny caption
  // push(); fill(255, 90); textAlign(CENTER, CENTER); textSize(14);
  // text('star-stuff', width/2, height*0.12); pop();
}

// -------------------- Particle System --------------------
class __Particle {
  constructor(x, y, img) {
    this.pos = createVector(x, y)
    this.vel = createVector(random(-0.35, 0.35), random(-1.2, -0.3))
    this.acc = createVector(0, 0)
    this.lifespan = random(1200, 1800) // ms
    this.age = 0
    this.img = img
    this.size = random(26, 52)
    this.spin = random(-0.018, 0.018)
    this.theta = random(TWO_PI)
  }
  applyForce(f) {
    this.acc.add(f)
  }
  update(dt) {
    this.vel.add(this.acc)
    this.pos.add(this.vel)
    this.acc.mult(0)
    this.theta += this.spin
    this.age += dt * 1000
  }
  isDead() {
    return this.age >= this.lifespan
  }
  display() {
    const k = 1 - this.age / this.lifespan // 1..0
    const a = 220 * pow(constrain(k, 0, 1), 1.6)
    push()
    translate(this.pos.x, this.pos.y)
    rotate(this.theta)
    tint(255, a)
    imageMode(CENTER)
    image(this.img, 0, 0, this.size, this.size)
    pop()
  }
}

class __Emitter {
  constructor(x, y, img) {
    this.origin = createVector(x, y)
    this.img = img
    this.particles = []
    this.gravity = createVector(0, -0.0045) // slight upward pull
  }
  applyForce(f) {
    for (const p of this.particles) p.applyForce(f)
  }
  addParticle() {
    this.particles.push(
      new __Particle(
        this.origin.x + random(-8, 8),
        this.origin.y + random(-8, 8),
        this.img
      )
    )
  }
  run() {
    for (const p of this.particles) p.applyForce(this.gravity)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.update(deltaTime / 1000)
      p.display()
      if (p.isDead()) this.particles.splice(i, 1)
    }
  }
}

// -------------------- Helpers --------------------
function __intro_makeSoftCircleG(size = 128) {
  const g = createGraphics(size, size)
  g.clear()
  g.noStroke()
  // Gaussian-like radial alpha
  for (let r = size * 0.5; r > 0; r--) {
    const k = r / (size * 0.5)
    const a = 255 * pow(1 - k, 1.8)
    g.fill(255, a)
    g.circle(size / 2, size / 2, r * 2)
  }
  return g
}

function __easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}
