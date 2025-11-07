// intro.js // Intro module for p5.js:
// 1) Sagan quote fade-in over a soft radial gradient (gradient no implementado visualmente).
// 2) (Actualizado) Letras → partículas flotantes que rebotan.
// 3) Public API:
// Intro_init({ imgPath, fontPath, fadeSec, holdSec, baseBG })
// Intro_updateAndDraw(dtSeconds)
// Intro_isDone()

let __intro_state = {
  // Configuración general
  baseBG: 30, // gris del sketch
  gradientStrength: 0.35, // 0.0..1.0 cuanto oscurece el centro (no usado ahora)
  phase: 0, // 0: fade-in text, 1: partículas, 2: done
  t: 0, // phase time (seconds)
  fadeSec: 3.5,
  holdSec: 2.0,
  smokeSec: 0, // legado (ignorado para partículas infinitas)

  quote:
    '“The nitrogen in our DNA, the calcium in our teeth, the iron in our blood — were made in the interiors of collapsing stars. We are made of star-stuff.”',
  author: '— Carl Sagan',

  // assets
  img: null, // textura legacy (ya no necesaria, pero mantenida por compat.)
  font: null, // custom font (optional)

  // legacy (humo)
  emitter: null,
  center: null,

  // layout
  yQuoteFrac: 0.52, // vertical anchor (0..1) para el bloque de la cita
  yAuthorFrac: 0.78,

  // Readiness checks
  readyImg: false,
  readyFont: true, // default true (solo set false si se carga una fuente)
}

let __intro_emitPoints = [] // legacy (humo)
let __intro_pix = [] // nuevas partículas de letra

// -------------------- Public API --------------------

/**
 * Inicializa el módulo Intro, cargando assets y configurando tiempos.
 * @param {object} opts - Opciones de configuración.
 * @param {string} [opts.imgPath] - Ruta a la imagen (legacy).
 * @param {string} [opts.fontPath] - Ruta a la fuente custom (.ttf, .otf).
 * @param {number} [opts.fadeSec] - Duración del fade-in (segundos).
 * @param {number} [opts.holdSec] - Duración de la espera (segundos).
 * @param {number} [opts.baseBG] - Color de fondo.
 * @param {number} [opts.gradientStrength] - Fuerza del gradiente (no usado actualmente).
 */
function Intro_init(opts = {}) {
  // Seteo de configuración
  __intro_state.fadeSec = opts.fadeSec ?? __intro_state.fadeSec
  __intro_state.holdSec = opts.holdSec ?? __intro_state.holdSec
  __intro_state.smokeSec = opts.smokeSec ?? __intro_state.smokeSec

  // Optional overrides
  if (typeof opts.yQuoteFrac === 'number')
    __intro_state.yQuoteFrac = opts.yQuoteFrac
  if (typeof opts.yAuthorFrac === 'number')
    __intro_state.yAuthorFrac = opts.yAuthorFrac
  if (typeof opts.baseBG === 'number') __intro_state.baseBG = opts.baseBG
  if (typeof opts.gradientStrength === 'number')
    __intro_state.gradientStrength = opts.gradientStrength

  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_state.center = createVector(width * 0.5, height * 0.62)

  // Carga opcional de textura legacy (no se usa en partículas, pero no rompe nada)
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

  // Carga de fuente opcional
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

  // Legacy: emisor (no usado en partículas, pero mantenido)
  __intro_state.emitter = new __Emitter(
    __intro_state.center.x,
    __intro_state.center.y,
    __intro_state.img
  )
}

/**
 * Actualiza la lógica y dibuja el estado actual de la introducción.
 * @param {number} dtSeconds - Tiempo transcurrido desde el último frame (en segundos).
 * @returns {boolean} - true si la intro ha terminado, false en caso contrario.
 */
function Intro_updateAndDraw(dtSeconds) {
  // Esperar a que todos los assets estén listos
  if (!(__intro_state.readyImg && __intro_state.readyFont)) return false

  __intro_state.t += dtSeconds

  if (__intro_state.phase === 0) {
    // FASE 0: Fade-in y Hold del texto
    background(__intro_state.baseBG)
    __intro_drawQuoteFade() // fade-in texto real

    if (__intro_state.t >= __intro_state.fadeSec + __intro_state.holdSec) {
      // Transición a la fase 1 (Partículas)
      console.log('Intro: Baking text to particles...')
      // 1) Bake de puntos del texto
      const pts = __intro_bakePointsFromText()
      // 2) Crear partículas a partir de esos puntos
      __intro_pix = pts.map((p) => new __Pix(p.x, p.y))

      __intro_state.phase = 1
      __intro_state.t = 0
    }
    return false
  }

  if (__intro_state.phase === 1) {
    // FASE 1: Animación de Partículas Flotantes
    background(__intro_state.baseBG)
    __intro_runPix(dtSeconds) // ← animación partículas flotantes

    // La fase de partículas es infinita (no hay condición de 'done')
    // A menos que se llame Intro_skip() o se añada una condición aquí.
    return false
  }

  // FASE 2: Terminada
  return true // done
}

/**
 * Comprueba si la introducción ha finalizado.
 * @returns {boolean}
 */
function Intro_isDone() {
  return __intro_state.phase === 2
}

// -------------------- Internals: Quote & Layout --------------------

/**
 * Dibuja la cita con el efecto de fade-in.
 */
function __intro_drawQuoteFade() {
  // Alpha for quote
  const fadeIn = __intro_state.fadeSec
  const t = __intro_state.t
  let alpha =
    t <= fadeIn ? __easeOutCubic(constrain(t / fadeIn, 0, 1)) * 255 : 255

  const L = __intro_layout()

  push()
  textAlign(CENTER, CENTER)

  // Fuente consistente
  if (__intro_state.font) textFont(__intro_state.font)
  else textFont('MomoTrustDisplay') // CSS @font-face fallback

  // Quote
  const quoteSize = __intro_pickTextSize(false)
  textSize(quoteSize)
  textLeading(quoteSize * 1.12)

  // Glow sutil (dibujado varias veces con menor alpha)
  const glowRepeats = 3
  for (let i = glowRepeats; i > 0; i--) {
    const a = alpha * 0.16 * (i / glowRepeats)
    fill(255, a)
    noStroke()
    text(__intro_state.quote, L.boxX, L.boxYQuote, L.boxW, L.boxH)
  }

  // Texto principal
  fill(255, alpha)
  noStroke()
  text(__intro_state.quote, L.boxX, L.boxYQuote, L.boxW, L.boxH)

  // Author
  const authorSize = __intro_pickTextSize(true)
  textSize(authorSize)
  fill(255, alpha)
  text(__intro_state.author, L.boxX, L.boxYAuthor, L.boxW, L.boxH * 0.25)
  pop()
}

/**
 * Cálculo centralizado de caja/posiciones (DRY).
 */
function __intro_layout() {
  const margin = min(width, height) * 0.08
  const boxW = width - margin * 2
  const boxH = height * 0.62
  const boxX = (width - boxW) / 2
  const boxYQuote = height * __intro_state.yQuoteFrac - boxH / 2
  const boxYAuthor = height * __intro_state.yAuthorFrac - (boxH * 0.25) / 2

  return { boxX, boxW, boxH, boxYQuote, boxYAuthor }
}

/**
 * Genera puntos de texto muestreando los píxeles blancos del texto renderizado
 * en un buffer, y devuelve {x,y} en coordenadas del canvas principal.
 */
function __intro_bakePointsFromText() {
  const L = __intro_layout()
  const authorH = L.boxH * 0.25

  // Usar g.width/height como entero para evitar problemas de pixelación
  const gWidth = Math.round(L.boxW)
  const gHeight = Math.round(L.boxH + authorH)

  const g = createGraphics(gWidth, gHeight)
  g.pixelDensity(1)
  g.background(0) // Fondo negro para detectar texto (blanco)
  g.fill(255)
  g.noStroke()

  if (__intro_state.font) g.textFont(__intro_state.font)
  else g.textFont('MomoTrustDisplay')

  g.textAlign(CENTER, CENTER)

  // Renderizar Cita
  const quoteSize = __intro_pickTextSize(false)
  g.textSize(quoteSize)
  g.textLeading(quoteSize * 1.12)
  g.text(__intro_state.quote, g.width / 2, L.boxH / 2, L.boxW, L.boxH)

  // Renderizar Autor
  const authorSize = __intro_pickTextSize(true)
  g.textSize(authorSize)
  g.text(
    __intro_state.author,
    g.width / 2,
    L.boxH + authorH / 2,
    L.boxW,
    authorH
  )

  // Muestreo de píxeles
  g.loadPixels()
  const pts = []
  const step = 4 // ⇦ sube para menos partículas, baja para más

  for (let y = 0; y < g.height; y += step) {
    for (let x = 0; x < g.width; x += step) {
      const idx = (y * g.width + x) * 4
      if (g.pixels[idx] > 200) {
        // Encontrado un píxel de texto (blanco)
        pts.push({
          // Mapear coordenadas del buffer al canvas principal
          x: L.boxX + x + random(-0.3, 0.3), // Añadir ruido para evitar alineación perfecta
          y: L.boxYQuote + y + random(-0.3, 0.3),
        })
      }
    }
  }
  g.remove() // Limpiar el buffer gráfico
  return pts
}

/**
 * Calcula el tamaño de texto óptimo para el quote o el autor.
 */
function __intro_pickTextSize(isAuthor = false) {
  const base = min(width, height)
  return isAuthor ? max(16, base * 0.03) : max(18, base * 0.042)
}

// -------------------- Partículas de letra (nueva animación) --------------------

/**
 * Clase de partícula que rebota y se mueve orgánicamente.
 */
class __Pix {
  constructor(x, y) {
    this.pos = createVector(x, y)
    // velocidad inicial suave lateral
    const s = random(0.25, 0.8)
    this.vel = createVector(random([-s, s]), random(-0.15, 0.15))
    this.size = random(2.2, 3.8)
    // Posición inicial de Perlin Noise
    this.noiseOffset = random(1000)
  }

  /**
   * Actualiza la posición de la partícula.
   * @param {number} dt - Delta time en segundos.
   */
  step(dt) {
    // ligera deriva con noise para organicidad
    // Moverse lentamente basado en Perlin noise para un efecto de 'flujo'
    this.vel.x +=
      1.2 *
      (noise(this.pos.y * 0.003, this.noiseOffset + frameCount * 0.003) - 0.5) *
      dt
    this.vel.y +=
      1.2 *
      (noise(this.pos.x * 0.003, this.noiseOffset + 100 + frameCount * 0.003) -
        0.5) *
      dt

    // Fricción/Arrastre muy leve
    this.vel.mult(0.998)

    // Clamp velocidad máxima para evitar fugas/saltos
    this.vel.limit(120 * dt)

    this.pos.add(this.vel)

    // rebote en bordes
    const m = 6 // Margen de rebote

    if (this.pos.x < m || this.pos.x > width - m) {
      this.pos.x = constrain(this.pos.x, m, width - m)
      this.vel.x *= -0.9 // Rebote con pérdida de energía
    }

    if (this.pos.y < m || this.pos.y > height - m) {
      this.pos.y = constrain(this.pos.y, m, height - m)
      this.vel.y *= -0.9 // Rebote con pérdida de energía
    }
  }

  draw() {
    noStroke()
    fill(255, 230) // blanco casi sólido
    circle(this.pos.x, this.pos.y, this.size)
  }
}

/**
 * Ejecuta la simulación de todas las partículas de letra.
 * @param {number} dt - Delta time en segundos.
 */
function __intro_runPix(dt) {
  if (!__intro_pix.length) return
  for (let i = 0; i < __intro_pix.length; i++) {
    const p = __intro_pix[i]
    p.step(dt)
    p.draw()
  }
}

// -------------------- Legacy (humo) — mantenido pero no usado --------------------

/**
 * Legacy: Simulación de humo (ya no se usa en Phase 1, que usa __Pix).
 */
function __intro_runSmoke(dt) {
  const dx = map(sin(frameCount * 0.01), -1, 1, -0.1, 0.1)
  const wind = createVector(dx, 0)

  // Lógica de emisión si fuera humo (legacy)
  if (!__intro_emitPoints.length) {
    for (let i = 0; i < 2; i++) __intro_state.emitter.addParticle()
    __intro_state.emitter.applyForce(wind)
    __intro_state.emitter.run()
    return
  }

  const birthsPerFrame = 10
  for (let i = 0; i < birthsPerFrame; i++) {
    const p = random(__intro_emitPoints)
    __intro_state.emitter.particles.push(
      new __Particle(
        p.x + random(-0.5, 0.5),
        p.y + random(-0.5, 0.5),
        __intro_state.img
      )
    )
  }
  __intro_state.emitter.applyForce(wind)
  __intro_state.emitter.run()
}

// -------------------- Legacy Particle System Classes (humo) --------------------

/**
 * Partícula legacy para el sistema de humo (usa deltaTime/1000).
 */
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
    // dt es en segundos
    this.vel.add(p5.Vector.mult(this.acc, 1000)) // Escala la aceleración
    this.pos.add(p5.Vector.mult(this.vel, dt))
    this.acc.mult(0)
    this.theta += this.spin
    this.age += dt * 1000 // Conviertelo a milisegundos
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

/**
 * Emisor legacy (para el humo).
 */
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
    // Usar p5.js deltaTime/1000 para la actualización de partículas legacy
    const dtSeconds = deltaTime / 1000

    for (const p of this.particles) p.applyForce(this.gravity)

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.update(dtSeconds)
      p.display()
      if (p.isDead()) this.particles.splice(i, 1)
    }
  }
}

// -------------------- Helpers --------------------

/**
 * Genera un buffer gráfico de un círculo suave para la partícula legacy.
 */
function __intro_makeSoftCircleG(size = 128) {
  const g = createGraphics(size, size)
  g.clear()
  g.noStroke()
  for (let r = size * 0.5; r > 0; r--) {
    const k = r / (size * 0.5)
    const a = 255 * pow(1 - k, 1.8)
    g.fill(255, a)
    g.circle(size / 2, size / 2, r * 2)
  }
  return g
}

/**
 * Función de easing: Cubic Out.
 */
function __easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

/**
 * Permite reiniciar la intro desde fuera, volviendo a la fase 0.
 */
function Intro_reset() {
  __intro_state.t = 0
  __intro_state.phase = 0
  __intro_emitPoints = [] // legacy
  __intro_pix = [] // importante: limpiar partículas de letra
  __intro_state.center = createVector(width * 0.5, height * 0.62)
  __intro_state.emitter = new __Emitter(
    __intro_state.center.x,
    __intro_state.center.y,
    __intro_state.img
  )
}

/**
 * Salta la intro y la marca como terminada de inmediato (fase 2).
 */
function Intro_skip() {
  __intro_state.phase = 2
  __intro_state.t = 0
  __intro_pix = []
  if (__intro_state.emitter && __intro_state.emitter.particles) {
    __intro_state.emitter.particles.length = 0
  }
}
