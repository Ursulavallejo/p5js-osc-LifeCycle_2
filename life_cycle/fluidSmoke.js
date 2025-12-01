// === HYBRID FLUID SMOKE - Best Performance! ===
// Strategy: LOW-RES noise texture + scaling = GPU accelerated!

let noiseTexture
let displayBuffer
let smokeRadius = 220
let btnA = 0,
  btnB = 0,
  btnC = 0
let showSmoke = true
let time = 0

// Key optimization: small texture, scaled up by GPU
const TEXTURE_SIZE = 256 // Small! GPU will scale it smoothly

function setup() {
  createCanvas(windowWidth, windowHeight)

  // Small off-screen buffer for noise generation
  noiseTexture = createGraphics(TEXTURE_SIZE, TEXTURE_SIZE)
  noiseTexture.pixelDensity(1)
  noiseTexture.colorMode(HSB, 360, 100, 100, 255)

  // Display buffer for final composition
  displayBuffer = createGraphics(width, height)
  displayBuffer.pixelDensity(1)
  displayBuffer.colorMode(HSB, 360, 100, 100, 255)
  displayBuffer.imageMode(CENTER)

  noiseDetail(3, 0.6)
  frameRate(60)
}

function draw() {
  background(30)

  if (!showSmoke) {
    drawHUD()
    return
  }

  time += 0.01

  // === STEP 1: Generate LOW-RES noise texture (FAST!) ===
  generateNoiseTexture()

  // === STEP 2: Draw to display buffer with effects ===
  const cx = width / 2
  const cy = height / 2

  // Fade trail
  displayBuffer.background(0, 0, 0, 30)

  // Get color
  const col = getColor(btnA, btnB, btnC)

  // Apply tint
  displayBuffer.push()
  displayBuffer.tint(col.h, col.s, col.b, 180)

  // Clip to circle
  displayBuffer.drawingContext.save()
  displayBuffer.drawingContext.beginPath()
  displayBuffer.drawingContext.arc(cx, cy, smokeRadius, 0, TWO_PI)
  displayBuffer.drawingContext.clip()

  // Draw scaled noise texture (GPU does the heavy lifting!)
  const scale = smokeRadius * 2.2
  displayBuffer.image(noiseTexture, cx, cy, scale, scale)

  displayBuffer.drawingContext.restore()
  displayBuffer.pop()

  // === STEP 3: Composite to main canvas ===
  blendMode(ADD)
  image(displayBuffer, 0, 0)
  blendMode(BLEND)

  drawHUD()
}

function generateNoiseTexture() {
  noiseTexture.loadPixels()

  const scale = 0.015

  // Only update pixels, no clearing needed
  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      // Multi-octave noise for organic flow
      const n1 = noise(x * scale * 1.0, y * scale * 1.0, time * 0.4)
      const n2 = noise(x * scale * 2.5, y * scale * 2.5, time * 0.9)
      const n3 = noise(x * scale * 0.6, y * scale * 0.6, time * 0.3)

      // Swirl pattern (like your reference image!)
      const centerX = TEXTURE_SIZE / 2
      const centerY = TEXTURE_SIZE / 2
      const dx = x - centerX
      const dy = y - centerY
      const angle = Math.atan2(dy, dx)
      const dist = Math.sqrt(dx * dx + dy * dy) / (TEXTURE_SIZE / 2)

      // Combine noise with radial flow
      const swirl = noise(angle * 2 + time, dist * 3, time * 0.5)
      const combined = n1 * 0.4 + n2 * 0.3 + n3 * 0.2 + swirl * 0.1

      // Radial fade
      const radialFade = 1 - Math.pow(dist, 1.5)
      const brightness = combined * radialFade * 100

      const index = (y * TEXTURE_SIZE + x) * 4

      // Write to pixels (grayscale, tint applied later)
      noiseTexture.pixels[index] = 0 // H (not used, tint handles it)
      noiseTexture.pixels[index + 1] = 0 // S
      noiseTexture.pixels[index + 2] = brightness // B
      noiseTexture.pixels[index + 3] = Math.min(255, brightness * 2.5) // A
    }
  }

  noiseTexture.updatePixels()
}

function getColor(a, b, c) {
  if (a) return { h: 340, s: 90, b: 100 } // Pink
  if (b) return { h: 180, s: 85, b: 100 } // Cyan
  if (c) return { h: 50, s: 95, b: 100 } // Yellow
  return { h: 220, s: 25, b: 100 } // Blue
}

function drawHUD() {
  fill(255)
  noStroke()
  textSize(14)
  textAlign(LEFT)
  text(
    `FPS: ${frameRate().toFixed(0)} | Radius: ${smokeRadius.toFixed(0)}px`,
    20,
    30
  )
  text(`A:${btnA} B:${btnB} C:${btnC} | Visible:${showSmoke}`, 20, 50)
}

// === OSC INTEGRATION ===
let socket

function setupOSC() {
  socket = io('http://127.0.0.1:8081')

  socket.emit('config', {
    server: { host: '0.0.0.0', port: 12000 },
    client: { host: '127.0.0.1', port: 8000 },
  })

  socket.on('connected', (ok) => console.log('🎛️ OSC connected:', ok))

  socket.on('message', (msg) => {
    const [addr, val] = msg
    console.log('📩', addr, val)

    // Adjust these addresses to match your TouchOSC layout
    if (addr === '/2/multifader/3') {
      smokeRadius = map(val, 0, 1, 50, 400)
    }
    if (addr === '/2/multitoggle/3/3') btnA = val
    if (addr === '/2/multitoggle/4/3') btnB = val
    if (addr === '/2/multitoggle/5/3') btnC = val
    if (addr === '/2/multitoggle/1/3') showSmoke = val === 1
  })
}

// Call this in your main setup() to enable OSC
// setupOSC()

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
  displayBuffer.remove()
  displayBuffer = createGraphics(width, height)
  displayBuffer.pixelDensity(1)
  displayBuffer.colorMode(HSB, 360, 100, 100, 255)
  displayBuffer.imageMode(CENTER)
}
