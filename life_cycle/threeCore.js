// version: particles and smoke-like core sphere
;(function (global) {
  const ThreeCore = {}

  let scene, camera, renderer
  let coreMesh, particleSystem
  let particleGeo, particleMat

  let isVisible = false
  let clock = null

  // uniforms for the core sphere shader
  let coreUniforms = null
  let coreSpinSpeed = 0.002 // base rotation speed (can be audio-reactive)

  const PARTICLE_COUNT = 4500

  //   CORE SPHERE WITH SMOKE SHADER

  function createCoreMesh(THREE) {
    const geo = new THREE.SphereGeometry(1.4, 128, 128)

    coreUniforms = {
      uTime: { value: 0 },
      uNoiseScale: { value: 0.8 }, // how tight the noise pattern is
      uDisplacementAmp: { value: 0.25 }, // how much the surface is displaced
      uSmokeIntensity: { value: 0.8 }, // global smoke opacity multiplier
      uBaseColor: { value: new THREE.Color(0x88bbdd) }, // core/particles color
    }

    const vertexShader = /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;

      uniform float uTime;
      uniform float uNoiseScale;
      uniform float uDisplacementAmp;

      // --- simplex noise 3D (compacto) ---
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v   - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1),
                                     dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                                dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }

      float fbm(vec3 p) {
        float f = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          f += amp * snoise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        vec3 p = position;

   // sample noise in object space and displace along the normal
        float n = fbm(p * uNoiseScale + vec3(0.0, 0.0, uTime * 0.15));
        float disp = n * uDisplacementAmp;

        vec3 displaced = p + normal * disp;

        vPos = displaced;
        vNormal = normalize(normalMatrix * normal);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `

    const fragmentShader = /* glsl */ `
      varying vec3 vPos;
      varying vec3 vNormal;

      uniform float uTime;
      uniform float uSmokeIntensity;
      uniform vec3 uBaseColor;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v   - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute( permute( permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = inversesqrt(vec4(dot(p0,p0), dot(p1,p1),
                                     dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1),
                                dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                      dot(p2,x2), dot(p3,x3) ) );
      }

      float fbm(vec3 p) {
        float f = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          f += amp * snoise(p);
          p *= 2.0;
          amp *= 0.5;
        }
        return f;
      }

      void main() {
        // volumetric-like noise inside the core
        float n = fbm(vPos * 0.9 + vec3(0.0, 0.0, uTime * 0.1));
        n = clamp(n * 0.5 + 0.5, 0.0, 1.0);

       // control smoke holes
        float alpha = smoothstep(0.25, 0.8, n) * uSmokeIntensity;

        // Fresnel-like rim lighting
        float viewDot = max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0);
        float fresnel = pow(1.0 - viewDot, 2.0);

        // Smoke color
        vec3 smokeColor = mix(uBaseColor * 0.4, vec3(1.0), n);
        smokeColor += fresnel * 0.6;

        gl_FragColor = vec4(smokeColor, alpha);
      }
    `

    const mat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    })

    coreMesh = new THREE.Mesh(geo, mat)
    scene.add(coreMesh)
  }

  //   SURFACE PARTICLES

  function createSurfaceParticles(THREE) {
    particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(PARTICLE_COUNT * 3)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.random() * Math.PI * 2
      const cost = Math.random() * 2 - 1
      const sint = Math.sqrt(1 - cost * cost)

      const r = 1.4 + Math.random() * 0.1 // just above the sphere surface
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

  //   INIT

  ThreeCore.init = function () {
    const THREE = global.THREE
    if (!THREE) return console.error('THREE not loaded')

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

    // Order matters: core first (so coreUniforms is ready), then particles
    createCoreMesh(THREE)
    createSurfaceParticles(THREE)

    clock = new THREE.Clock()

    renderer.setAnimationLoop(() => {
      if (!isVisible) return

      const t = clock.getElapsedTime()

      if (coreUniforms) {
        coreUniforms.uTime.value = t
      }

      if (particleSystem) {
        particleSystem.rotation.y += 0.001
      }
      if (coreMesh) {
        // coreMesh.rotation.y += 0.002
        coreMesh.rotation.y += coreSpinSpeed
      }

      renderer.render(scene, camera)
    })
  }

  //   VISIBILITY TOGGLE

  ThreeCore.setVisible = function (flag) {
    isVisible = !!flag
    if (renderer && renderer.domElement) {
      renderer.domElement.style.display = isVisible ? 'block' : 'none'
    }
  }

  //   EXTERNAL UPDATES (OSC, UI, etc.)

  ThreeCore.update = function (params = {}) {
    const { radius, color, audio } = params

    // Radius from UI / OSC fader
    if (radius != null) {
      if (coreMesh) {
        coreMesh.scale.set(radius, radius, radius)
      }
      if (particleSystem) {
        particleSystem.scale.set(radius, radius, radius)
      }
    }

    // Tint from A/B/C buttons
    if (color) {
      const r = color.r / 255
      const g = color.g / 255
      const b = color.b / 255

      if (coreUniforms && coreUniforms.uBaseColor) {
        coreUniforms.uBaseColor.value.setRGB(r, g, b)
      }
      if (particleMat) {
        particleMat.color.setRGB(r, g, b)
      }
    }

    // --- Audio-reactive mapping (bass/mid/tre from Processing mic) ---
    if (audio && coreUniforms) {
      const bass = Math.max(0, audio.bass || 0)
      const mid = Math.max(0, audio.mid || 0)
      const tre = Math.max(0, audio.tre || 0)

      const energy = Math.max(0, Math.min(1, (bass + mid + tre) / 3))

      // More treble + overall energy → stronger smoke / glow
      coreUniforms.uSmokeIntensity.value = 0.5 + 1.0 * energy

      // Surface displacement driven mainly by mids (detail) + some bass (weight)
      const deformMix = 0.6 * mid + 0.4 * bass
      coreUniforms.uDisplacementAmp.value = 0.2 + 0.3 * deformMix

      // Pattern detail: mids make the noise more detailed
      coreUniforms.uNoiseScale.value = 0.8 + 0.7 * mid

      // Rotation speed: bass controls how fast the core spins
      coreSpinSpeed = 0.002 + 0.01 * bass
    }
  }

  //   RESIZE HANDLER

  ThreeCore.resize = function () {
    if (!camera || !renderer) return
    const w = global.innerWidth
    const h = global.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  global.ThreeCore = ThreeCore
})(window)
