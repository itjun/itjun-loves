import * as THREE from 'three';
import { isDark } from './theme.js';

const WATER_Y = -6;
const WATER_SIZE = 400;
const WATER_SEGMENTS = 128;

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

// ---------- 场景创建 ----------

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    600,
  );
  camera.position.set(0, 3.2, 26);

  const fog = new THREE.FogExp2(0x12294a, 0.0035);
  scene.fog = fog;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  scene.add(new THREE.AmbientLight(0x88aacc, 0.6));

  const moonLight = new THREE.DirectionalLight(0xcfe2f7, 0.9);
  moonLight.position.set(-46, 34, -120);
  scene.add(moonLight);

  // ---------- 海面 ----------

  const waterUniforms = {
    uTime: { value: 0 },
    uColorShallow: { value: new THREE.Color().setHex(0x17406b, THREE.SRGBColorSpace) },
    uColorDeep: { value: new THREE.Color().setHex(0x0a2340, THREE.SRGBColorSpace) },
    uMoonDir: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
    uMoonColor: { value: new THREE.Color().setHex(0xcfe2f7, THREE.SRGBColorSpace) },
    uMoonStrength: { value: 1.0 },
  };

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS),
    new THREE.MeshStandardMaterial({
      color: 0x17406b,
      roughness: 0.28,
      metalness: 0.55,
      transparent: true,
      opacity: 0.96,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  water.material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.uniforms.uColorShallow = waterUniforms.uColorShallow;
    shader.uniforms.uColorDeep = waterUniforms.uColorDeep;
    shader.uniforms.uMoonDir = waterUniforms.uMoonDir;
    shader.uniforms.uMoonColor = waterUniforms.uMoonColor;
    shader.uniforms.uMoonStrength = waterUniforms.uMoonStrength;

    shader.vertexShader = `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorldPos;
    ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float wave =
        sin(position.x * 0.055 + uTime * 0.85) * 1.35 +
        sin(position.y * 0.075 - uTime * 0.62) * 1.05 +
        sin((position.x + position.y) * 0.032 + uTime * 0.42) * 0.9 +
        sin(length(position.xy) * 0.045 - uTime * 0.55) * 0.55;
      transformed.z += wave;
      vWave = wave;
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
    );

    shader.fragmentShader = `
      uniform vec3 uColorShallow;
      uniform vec3 uColorDeep;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonColor;
      uniform float uMoonStrength;
      varying float vWave;
      varying vec3 vWorldPos;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      float waveMix = smoothstep(-2.0, 2.0, vWave);
      vec3 seaColor = mix(uColorDeep, uColorShallow, waveMix);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      vec3 halfDir = normalize(viewDir + uMoonDir);
      float spec = pow(max(dot(normalize(vec3(0.0, 1.0, 0.0)), halfDir), 0.0), 180.0);
      float glitter = pow(spec, 2.0) * (0.5 + 0.5 * sin(vWorldPos.x * 0.4 + vWorldPos.z * 0.37));
      vec3 moonGlitter = uMoonColor * glitter * 1.6 * uMoonStrength;
      gl_FragColor.rgb = mix(gl_FragColor.rgb, seaColor + moonGlitter, 0.85);
      #include <colorspace_fragment>
      `,
    );
  };
  scene.add(water);

  // ---------- 天空穹顶 ----------

  const skyUniforms = {
    uTopColor: { value: new THREE.Color().setHex(0x102642, THREE.SRGBColorSpace) },
    uBottomColor: { value: new THREE.Color().setHex(0x12294a, THREE.SRGBColorSpace) },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 color = mix(uBottomColor, uTopColor, pow(h, 0.8));
          color = pow(clamp(color, 0.0, 1.0), vec3(0.4545));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  // ---------- 月亮 / 太阳 ----------

  const moonGroup = new THREE.Group();
  const moonCore = new THREE.Mesh(
    new THREE.SphereGeometry(6, 32, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setHex(0xf7f4e6, THREE.SRGBColorSpace), fog: false }),
  );
  const glowTexture = makeGlowTexture();
  const moonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color().setHex(0xcfe2f7, THREE.SRGBColorSpace),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  moonGlow.scale.set(34, 34, 1);
  moonGroup.add(moonCore, moonGlow);
  moonGroup.position.set(-46, 34, -120);
  scene.add(moonGroup);

  // ---------- 星空 ----------

  const STAR_COUNT = 900;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starSeeds = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * 0.45 * Math.PI;
    const r = 420;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starSeeds[i] = Math.random() * 100;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aSeed', new THREE.BufferAttribute(starSeeds, 1));

  const starUniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 1.0 },
  };

  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      uniforms: starUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          float twinkle = 0.55 + 0.45 * sin(uTime * 1.4 + aSeed * 6.28);
          vAlpha = twinkle;
          gl_PointSize = (1.6 + 2.2 * fract(aSeed * 0.618)) * twinkle;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a * vAlpha * uOpacity);
        }
      `,
    }),
  );
  scene.add(stars);

  // ---------- 气泡 ----------

  const BUBBLE_COUNT = 220;
  const MAX_EXTRA_BUBBLES = 240;
  const TOTAL_BUBBLES = BUBBLE_COUNT + MAX_EXTRA_BUBBLES;
  const bubblePositions = new Float32Array(TOTAL_BUBBLES * 3);
  const bubbleSeeds = new Float32Array(TOTAL_BUBBLES);
  const bubbleSizes = new Float32Array(TOTAL_BUBBLES);
  const bubbleState = [];
  for (let i = 0; i < TOTAL_BUBBLES; i++) {
    bubbleState.push({
      speed: 1.6 + Math.random() * 2.4,
      swayAmp: 0.6 + Math.random() * 1.4,
      swayFreq: 0.4 + Math.random() * 0.8,
      active: i < BUBBLE_COUNT,
      burst: false,
      burstTime: 0,
      originX: 0,
      originZ: 0,
    });
    resetBubble(i, true);
  }

  function resetBubble(i, initial) {
    const s = bubbleState[i];
    const x = (Math.random() - 0.5) * 160;
    const z = -20 - Math.random() * 150;
    bubblePositions[i * 3] = x;
    bubblePositions[i * 3 + 1] = initial
      ? WATER_Y + Math.random() * 34
      : WATER_Y + Math.random() * 2;
    bubblePositions[i * 3 + 2] = z;
    bubbleSeeds[i] = Math.random() * 100;
    bubbleSizes[i] = 0.5 + Math.random() * 1.7;
  }

  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
  bubbleGeo.setAttribute('aSeed', new THREE.BufferAttribute(bubbleSeeds, 1));
  bubbleGeo.setAttribute('aSize', new THREE.BufferAttribute(bubbleSizes, 1));

  const bubbleUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color().setHex(0xaee0ff, THREE.SRGBColorSpace) },
    uBrightness: { value: 1.0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };

  const bubbles = new THREE.Points(
    bubbleGeo,
    new THREE.ShaderMaterial({
      uniforms: bubbleUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float fadeTop = smoothstep(20.0, 10.0, position.y);
          float fadeNear = smoothstep(1.0, 8.0, -mv.z);
          vAlpha = fadeTop * fadeNear;
          gl_PointSize = aSize * 26.0 * uPixelRatio / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uBrightness;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.18, 0.42, d);
          float core = smoothstep(0.3, 0.0, d) * 0.5;
          float a = (ring * 0.85 + core) * vAlpha;
          vec3 color = uColor * uBrightness;
          color = pow(clamp(color, 0.0, 1.0), vec3(0.4545));
          gl_FragColor = vec4(color, a);
        }
      `,
    }),
  );
  scene.add(bubbles);

  function burstBubbles(x, z) {
    let spawned = 0;
    const now = clock.getElapsedTime();
    for (let i = BUBBLE_COUNT; i < TOTAL_BUBBLES && spawned < 26; i++) {
      if (!bubbleState[i].active) {
        const s = bubbleState[i];
        s.active = true;
        s.burst = true;
        s.burstTime = now;
        s.originX = x + (Math.random() - 0.5) * 2.2;
        s.originZ = z + (Math.random() - 0.5) * 2.2;
        bubblePositions[i * 3] = s.originX;
        bubblePositions[i * 3 + 1] = WATER_Y + Math.random() * 0.8;
        bubblePositions[i * 3 + 2] = s.originZ;
        bubbleSeeds[i] = Math.random() * 100;
        bubbleSizes[i] = 0.6 + Math.random() * 1.6;
        s.speed = 4 + Math.random() * 3.5;
        spawned++;
      }
    }
  }

  // ---------- 心形 ----------

  function makeHeartGeometry() {
    const shape = new THREE.Shape();
    const x = 0;
    const y = 0;
    shape.moveTo(x, y + 0.25);
    shape.bezierCurveTo(x, y + 0.55, x - 0.35, y + 0.55, x - 0.35, y + 0.25);
    shape.bezierCurveTo(x - 0.35, y - 0.05, x, y - 0.22, x, y - 0.45);
    shape.bezierCurveTo(x, y - 0.22, x + 0.35, y - 0.05, x + 0.35, y + 0.25);
    shape.bezierCurveTo(x + 0.35, y + 0.55, x, y + 0.55, x, y + 0.25);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 24,
    });
  }

  const heartGeo = makeHeartGeometry();
  const heartMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHex(0x74c4ff, THREE.SRGBColorSpace),
    emissive: new THREE.Color().setHex(0x2a6fa8, THREE.SRGBColorSpace),
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.0,
  });
  const hearts = [];
  const MAX_HEARTS = 7;
  for (let i = 0; i < MAX_HEARTS; i++) {
    const mesh = new THREE.Mesh(heartGeo, heartMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    hearts.push({ mesh, t: -1, delay: i * 2.3, x: 0, z: 0, spin: 0 });
  }

  function spawnHeart(index, elapsed) {
    const h = hearts[index];
    h.t = 0;
    h.x = (Math.random() - 0.5) * 60;
    h.z = -18 - Math.random() * 80;
    h.spin = (Math.random() - 0.5) * 2;
    h.mesh.position.set(h.x, WATER_Y, h.z);
    h.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);
    h.mesh.visible = true;
    h.mesh.material.opacity = 0;
    h.mesh.scale.setScalar(1.6 + Math.random() * 1.4);
  }

  // ---------- 交互 ----------

  const pointer = { x: 0, y: 0 };
  const cameraTarget = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  const clickPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_Y);

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('pointerdown', (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(clickPlane, hit)) {
      const clampedZ = Math.max(-90, Math.min(8, hit.z));
      const clampedX = Math.max(-55, Math.min(55, hit.x));
      burstBubbles(clampedX, clampedZ);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    bubbleUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });

  // ---------- 渲染循环 ----------

  const clock = new THREE.Clock();
  let themeMix = isDark() ? 1.0 : 0.0; // 1 = 深色, 0 = 浅色

  const tmpColor = new THREE.Color();
  const darkWaterShallow = new THREE.Color().setHex(0x17406b, THREE.SRGBColorSpace);
  const darkWaterDeep = new THREE.Color().setHex(0x0a2340, THREE.SRGBColorSpace);
  const lightWaterShallow = new THREE.Color().setHex(0x2e8fc4, THREE.SRGBColorSpace);
  const lightWaterDeep = new THREE.Color().setHex(0x1273a8, THREE.SRGBColorSpace);
  const darkSkyTop = new THREE.Color().setHex(0x102642, THREE.SRGBColorSpace);
  const darkSkyBottom = new THREE.Color().setHex(0x12294a, THREE.SRGBColorSpace);
  const lightSkyTop = new THREE.Color().setHex(0x9fd4f0, THREE.SRGBColorSpace);
  const lightSkyBottom = new THREE.Color().setHex(0xcfe9f8, THREE.SRGBColorSpace);
  const darkMoon = new THREE.Color().setHex(0xf7f4e6, THREE.SRGBColorSpace);
  const lightSun = new THREE.Color().setHex(0xfff6d8, THREE.SRGBColorSpace);
  const darkMoonGlow = new THREE.Color().setHex(0xcfe2f7, THREE.SRGBColorSpace);
  const lightSunGlow = new THREE.Color().setHex(0xffedbf, THREE.SRGBColorSpace);
  const darkBubble = new THREE.Color().setHex(0xaee0ff, THREE.SRGBColorSpace);
  const lightBubble = new THREE.Color().setHex(0xffffff, THREE.SRGBColorSpace);
  const darkHeart = new THREE.Color().setHex(0x74c4ff, THREE.SRGBColorSpace);
  const lightHeart = new THREE.Color().setHex(0xff8fab, THREE.SRGBColorSpace);
  const darkFog = new THREE.Color().setHex(0x12294a, THREE.SRGBColorSpace);
  const lightFog = new THREE.Color().setHex(0xcfe9f8, THREE.SRGBColorSpace);

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    // 主题插值
    const goal = isDark() ? 1.0 : 0.0;
    themeMix = damp(themeMix, goal, 2.2, dt);

    waterUniforms.uColorShallow.value
      .copy(lightWaterShallow)
      .lerp(darkWaterShallow, themeMix);
    waterUniforms.uColorDeep.value.copy(lightWaterDeep).lerp(darkWaterDeep, themeMix);
    waterUniforms.uMoonStrength.value = THREE.MathUtils.lerp(1.0, 1.0, themeMix);
    skyUniforms.uTopColor.value.copy(lightSkyTop).lerp(darkSkyTop, themeMix);
    skyUniforms.uBottomColor.value.copy(lightSkyBottom).lerp(darkSkyBottom, themeMix);
    moonCore.material.color.copy(lightSun).lerp(darkMoon, themeMix);
    moonGlow.material.color.copy(lightSunGlow).lerp(darkMoonGlow, themeMix);
    bubbleUniforms.uColor.value.copy(lightBubble).lerp(darkBubble, themeMix);
    bubbleUniforms.uBrightness.value = THREE.MathUtils.lerp(0.55, 1.0, themeMix);
    starUniforms.uOpacity.value = 1.0 - themeMix;
    fog.color.copy(lightFog).lerp(darkFog, themeMix);
    heartMat.color.copy(lightHeart).lerp(darkHeart, themeMix);
    hearts.forEach((h) => {
      h.mesh.material.color.copy(heartMat.color);
      h.mesh.material.emissive.copy(heartMat.color).multiplyScalar(0.45);
    });

    // 海浪
    waterUniforms.uTime.value = t;

    // 星空
    starUniforms.uTime.value = t;

    // 气泡上浮
    const pos = bubbleGeo.attributes.position.array;
    for (let i = 0; i < TOTAL_BUBBLES; i++) {
      const s = bubbleState[i];
      if (!s.active) continue;
      pos[i * 3 + 1] += s.speed * dt;
      const sway = Math.sin(t * s.swayFreq + bubbleSeeds[i]) * s.swayAmp * 0.02;
      pos[i * 3] += sway;
      if (s.burst && t - s.burstTime > 1.4) {
        s.burst = false;
        s.speed = 1.6 + Math.random() * 2.4;
      }
      if (pos[i * 3 + 1] > 22) {
        if (i < BUBBLE_COUNT) {
          resetBubble(i, false);
        } else {
          s.active = false;
          pos[i * 3 + 1] = -100;
        }
      }
    }
    bubbleGeo.attributes.position.needsUpdate = true;

    // 心形
    hearts.forEach((h, idx) => {
      if (h.t < 0 && t > h.delay) {
        spawnHeart(idx, t);
      }
      if (h.t >= 0) {
        h.t += dt;
        const life = 9.5;
        const p = h.t / life;
        if (p >= 1) {
          h.t = -1;
          h.mesh.visible = false;
          h.delay = t + 3 + Math.random() * 5;
          return;
        }
        h.mesh.position.y = WATER_Y + 1.5 + p * 24;
        h.mesh.position.x = h.x + Math.sin(t * 0.6 + idx) * 1.6;
        h.mesh.rotation.y += dt * 0.5 * h.spin;
        h.mesh.rotation.z = Math.sin(t * 0.8 + idx) * 0.18;
        h.mesh.material.opacity = Math.sin(p * Math.PI) * 0.75;
      }
    });

    // 相机视差
    cameraTarget.x = pointer.x * 2.2;
    cameraTarget.y = pointer.y * 1.2;
    camera.position.x = damp(camera.position.x, cameraTarget.x, 2.5, dt);
    camera.position.y = damp(camera.position.y, 3.2 + cameraTarget.y, 2.5, dt);
    camera.lookAt(0, 1.5, -40);

    renderer.render(scene, camera);
  }

  animate();

  return { burstBubbles };
}

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
