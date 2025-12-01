;(function (global) {
  const ThreeCore = {}

  let scene, camera, renderer
  let coreMesh, particleSystem
  let particleGeo, particleMat
  let basePositions = []
  let noise = null
  let isVisible = false
  let clock = null

  const PARTICLE_COUNT = 4500

  // --- Simplex Noise  ---
  class SimplexNoise {
    constructor() {
      this.grad3 = new Float32Array([
        1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1,
        0, -1,
      ])
      this.p = new Uint8Array(256)
      for (let i = 0; i < 256; i++) this.p[i] = (Math.random() * 256) | 0
      this.perm = new Uint8Array(512)
      for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255]
    }

    noise3d(xin, yin, zin) {
      let n0, n1, n2, n3
      const F3 = 1 / 3
      const s = (xin + yin + zin) * F3
      const i = Math.floor(xin + s)
      const j = Math.floor(yin + s)
      const k = Math.floor(zin + s)

      const G3 = 1 / 6
      const t = (i + j + k) * G3
      const X0 = i - t
      const Y0 = j - t
      const Z0 = k - t
      const x0 = xin - X0
      const y0 = yin - Y0
      const z0 = zin - Z0

      let i1, j1, k1
      let i2, j2, k2

      if (x0 >= y0) {
        if (y0 >= z0) {
          i1 = 1
          j1 = 0
          k1 = 0
          i2 = 1
          j2 = 1
          k2 = 0
        } else if (x0 >= z0) {
          i1 = 1
          j1 = 0
          k1 = 0
          i2 = 1
          j2 = 0
          k2 = 1
        } else {
          i1 = 0
          j1 = 0
          k1 = 1
          i2 = 1
          j2 = 0
          k2 = 1
        }
      } else {
        if (y0 < z0) {
          i1 = 0
          j1 = 0
          k1 = 1
          i2 = 0
          j2 = 1
          k2 = 1
        } else if (x0 < z0) {
          i1 = 0
          j1 = 1
          k1 = 0
          i2 = 0
          j2 = 1
          k2 = 1
        } else {
          i1 = 0
          j1 = 1
          k1 = 0
          i2 = 1
          j2 = 1
          k2 = 0
        }
      }

      const x1 = x0 - i1 + G3
      const y1 = y0 - j1 + G3
      const z1 = z0 - k1 + G3
      const x2 = x0 - i2 + 2 * G3
      const y2 = y0 - j2 + 2 * G3
      const z2 = z0 - k2 + 2 * G3
      const x3 = x0 - 1 + 3 * G3
      const y3 = y0 - 1 + 3 * G3
      const z3 = z0 - 1 + 3 * G3

      const ii = i & 255
      const jj = j & 255
      const kk = k & 255

      const gi0 = this.perm[ii + this.perm[jj + this.perm[kk]]] % 12
      const gi1 =
        this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12
      const gi2 =
        this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] % 12
      const gi3 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12

      const g = this.grad3

      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
      if (t0 < 0) n0 = 0
      else {
        t0 *= t0
        n0 =
          t0 *
          t0 *
          (g[gi0 * 3] * x0 + g[gi0 * 3 + 1] * y0 + g[gi0 * 3 + 2] * z0)
      }

      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
      if (t1 < 0) n1 = 0
      else {
        t1 *= t1
        n1 =
          t1 *
          t1 *
          (g[gi1 * 3] * x1 + g[gi1 * 3 + 1] * y1 + g[gi1 * 3 + 2] * z1)
      }

      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
      if (t2 < 0) n2 = 0
      else {
        t2 *= t2
        n2 =
          t2 *
          t2 *
          (g[gi2 * 3] * x2 + g[gi2 * 3 + 1] * y2 + g[gi2 * 3 + 2] * z2)
      }

      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
      if (t3 < 0) n3 = 0
      else {
        t3 *= t3
        n3 =
          t3 *
          t3 *
          (g[gi3 * 3] * x3 + g[gi3 * 3 + 1] * y3 + g[gi3 * 3 + 2] * z3)
      }

      return 32 * (n0 + n1 + n2 + n3)
    }
  }

  function deformCoreGeometry(time) {
    const positions = coreMesh.geometry.attributes.position.array
    const normals = coreMesh.geometry.attributes.normal.array

    for (let i = 0; i < positions.length; i += 3) {
      const bx = basePositions[i]
      const by = basePositions[i + 1]
      const bz = basePositions[i + 2]

      const nVal = noise.noise3d(bx * 0.6, by * 0.6, bz * 0.6 + time * 0.8)
      const displacement = 0.25 * nVal

      positions[i] = bx + normals[i] * displacement
      positions[i + 1] = by + normals[i + 1] * displacement
      positions[i + 2] = bz + normals[i + 2] * displacement
    }

    coreMesh.geometry.attributes.position.needsUpdate = true
    coreMesh.geometry.computeVertexNormals()
  }

  function createCoreMesh(THREE) {
    const geo = new THREE.SphereGeometry(1.4, 96, 96)
    basePositions = geo.attributes.position.array.slice()

    const mat = new THREE.MeshStandardMaterial({
      color: 0x88bbdd,
      roughness: 0.7,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
      emissive: 0x0a0a0a,
      emissiveIntensity: 0.4,
    })

    coreMesh = new THREE.Mesh(geo, mat)
    scene.add(coreMesh)
  }

  function createSurfaceParticles(THREE) {
    particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.random() * Math.PI * 2
      const cost = Math.random() * 2 - 1
      const sint = Math.sqrt(1 - cost * cost)

      const r = 1.4 + Math.random() * 0.1 // pegado a la esfera
      positions[i * 3] = r * sint * Math.cos(phi)
      positions[i * 3 + 1] = r * cost
      positions[i * 3 + 2] = r * sint * Math.sin(phi)
    }

    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    )

    particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.03,
      opacity: 0.6,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    particleSystem = new THREE.Points(particleGeo, particleMat)
    scene.add(particleSystem)
  }

  ThreeCore.init = function () {
    const THREE = global.THREE
    if (!THREE) return console.error('THREE not loaded')

    noise = new SimplexNoise()

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    })
    renderer.setPixelRatio(global.devicePixelRatio)
    renderer.setSize(global.innerWidth, global.innerHeight)

    const el = renderer.domElement
    el.style.position = 'fixed'
    el.style.inset = '0'
    el.style.zIndex = '0'
    el.style.pointerEvents = 'none'
    document.body.appendChild(el)

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(
      45,
      global.innerWidth / global.innerHeight,
      0.1,
      100
    )
    camera.position.z = 5

    const amb = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(amb)

    const dir = new THREE.DirectionalLight(0xffffff, 1)
    dir.position.set(3, 3, 5)
    scene.add(dir)

    createCoreMesh(THREE)
    createSurfaceParticles(THREE)

    clock = new THREE.Clock()

    renderer.setAnimationLoop(() => {
      if (!isVisible) return

      const t = clock.getElapsedTime()

      deformCoreGeometry(t, THREE)

      particleSystem.rotation.y += 0.001
      coreMesh.rotation.y += 0.002

      renderer.render(scene, camera)
    })
  }

  ThreeCore.setVisible = function (flag) {
    isVisible = !!flag
    renderer.domElement.style.display = isVisible ? 'block' : 'none'
  }

  ThreeCore.update = function ({ radius, color }) {
    // Fader: center + particles
    if (radius != null) {
      if (coreMesh) {
        coreMesh.scale.set(radius, radius, radius)
      }
      if (particleSystem) {
        particleSystem.scale.set(radius, radius, radius)
      }
    }

    // buttons A/B/C: change color
    if (color) {
      const r = color.r / 255
      const g = color.g / 255
      const b = color.b / 255

      if (coreMesh && coreMesh.material) {
        coreMesh.material.color.setRGB(r, g, b)
      }
      if (particleMat) {
        particleMat.color.setRGB(r, g, b)
      }
    }
  }

  ThreeCore.resize = function () {
    const w = global.innerWidth
    const h = global.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  global.ThreeCore = ThreeCore
})(window)
