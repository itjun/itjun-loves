import * as THREE from 'three';
import { isDark } from './theme.js';
import { BUBBLE_TEXT } from './config.js';

const WATER_Y = -4;
const SHORE_Z = -26; // 水陆交界线（世界 z）
const TEXT_Y = 8;    // 气泡文字中心高度
const TEXT_Z = -45;  // 气泡文字所在平面

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function srgb(hex) {
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
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
  const CAM_BASE = new THREE.Vector3(0, 4.5, 34);
  const CAM_LOOK = new THREE.Vector3(0, 3.0, -55);
  camera.position.copy(CAM_BASE);

  // 竖屏（手机）加大视场角 + 抬高相机看向更近处，海面占主体
  function applyViewForAspect() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    if (aspect < 0.75) {
      camera.fov = 70;
      CAM_BASE.set(0, 5.5, 30);
      CAM_LOOK.set(0, 3.5, -42);
    } else {
      camera.fov = 55;
      CAM_BASE.set(0, 4.5, 34);
      CAM_LOOK.set(0, 3.0, -55);
    }
    camera.updateProjectionMatrix();
  }
  applyViewForAspect();

  const fog = new THREE.FogExp2(0x12294a, 0.0035);
  scene.fog = fog;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  scene.add(new THREE.AmbientLight(0x88aacc, 0.6));
  scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x5a4c38, 0.35));

  const moonLight = new THREE.DirectionalLight(0xcfe2f7, 0.9);
  moonLight.position.set(-46, 34, -120);
  scene.add(moonLight);

  // ---------- 沙滩 ----------

  const sandUniforms = {
    uDry: { value: srgb(0xe2cfa8) },
    uWet: { value: srgb(0xb5a37e) },
  };

  const sandGeo = new THREE.PlaneGeometry(500, 120, 90, 36);
  {
    // 静态地形：从岸线向相机方向抬升成斜坡，叠加噪声起伏
    const pos = sandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i); // 局部 y，旋转后对应世界 -z
      const wz = -ly;
      const rise = THREE.MathUtils.clamp((wz - (SHORE_Z - 4)) / 34, 0, 1);
      const noise =
        Math.sin(lx * 0.12 + wz * 0.07) * 0.5 +
        Math.sin(lx * 0.31 - wz * 0.19 + 3.1) * 0.3 +
        Math.sin(wz * 0.45 + lx * 0.05) * 0.2;
      const h = WATER_Y - 0.45 + rise * 2.2 + noise * 0.35 * rise;
      pos.setZ(i, h);
    }
    sandGeo.computeVertexNormals();
  }

  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({
      color: srgb(0xe2cfa8),
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.z = 4; // 覆盖世界 z ∈ [-56, 64]：远端没入水下作浅海底，近端到相机脚下
  sand.material.onBeforeCompile = (shader) => {
    shader.uniforms.uDry = sandUniforms.uDry;
    shader.uniforms.uWet = sandUniforms.uWet;
    shader.vertexShader = `
      varying vec3 vWorldPos;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
    );
    shader.fragmentShader = `
      uniform vec3 uDry;
      uniform vec3 uWet;
      varying vec3 vWorldPos;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      float wet = smoothstep(-14.0, -30.0, vWorldPos.z);
      float grain = sin(vWorldPos.x * 21.0) * sin(vWorldPos.z * 17.0) * 0.04;
      gl_FragColor.rgb = mix(uDry, uWet, wet) + grain;
      #include <colorspace_fragment>
      `,
    );
  };
  scene.add(sand);

  // ---------- 海面 ----------

  const waterUniforms = {
    uTime: { value: 0 },
    uColorShallow: { value: srgb(0x17406b) },
    uColorDeep: { value: srgb(0x0a2340) },
    uMoonDir: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
    uMoonColor: { value: srgb(0xcfe2f7) },
    uMoonStrength: { value: 1.0 },
  };

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500, 150, 150),
    new THREE.MeshStandardMaterial({
      color: srgb(0x17406b),
      roughness: 0.28,
      metalness: 0.55,
      transparent: true,
      opacity: 0.92,
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
      float worldZ = -position.y;
      // 近岸浪衰减：越靠近沙滩波幅越小
      float amp = mix(0.22, 1.0, smoothstep(-16.0, -55.0, worldZ));
      float wave =
        sin(position.x * 0.055 + uTime * 0.85) * 1.35 +
        sin(position.y * 0.075 - uTime * 0.62) * 1.05 +
        sin((position.x + position.y) * 0.032 + uTime * 0.42) * 0.9 +
        sin(length(position.xy) * 0.045 - uTime * 0.55) * 0.55;
      transformed.z += wave * amp;
      vWave = wave * amp;
      vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
    );

    shader.fragmentShader = `
      uniform vec3 uColorShallow;
      uniform vec3 uColorDeep;
      uniform vec3 uMoonDir;
      uniform vec3 uMoonColor;
      uniform float uMoonStrength;
      uniform float uTime;
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

      // 拍岸浪泡沫：近岸增强的移动白带
      float toShore = smoothstep(-70.0, -30.0, vWorldPos.z);
      float surf1 = sin(vWorldPos.z * 0.30 + uTime * 1.5 + sin(vWorldPos.x * 0.12) * 1.5);
      float surf2 = sin(vWorldPos.z * 0.16 - uTime * 0.9 + 2.3 + sin(vWorldPos.x * 0.07) * 2.0);
      float foam = smoothstep(0.70, 0.95, surf1) * 0.75
                 + smoothstep(0.76, 0.95, surf2) * 0.6;
      foam *= toShore;
      // 岸线白色浪缘，随时间轻微进退
      float edgeZ = -27.5 + sin(uTime * 0.8 + vWorldPos.x * 0.15) * 1.4;
      float edge = smoothstep(3.5, 0.0, abs(vWorldPos.z - edgeZ));
      foam += edge * 0.85;

      vec3 foamColor = vec3(0.88, 0.94, 0.98) * clamp(foam, 0.0, 1.3);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, seaColor + moonGlitter, 0.85) + foamColor * 0.55;
      #include <colorspace_fragment>
      `,
    );
  };
  scene.add(water);

  // ---------- 天空穹顶 ----------

  const skyUniforms = {
    uTopColor: { value: srgb(0x102642) },
    uBottomColor: { value: srgb(0x12294a) },
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
    new THREE.MeshBasicMaterial({ color: srgb(0xf7f4e6), fog: false }),
  );
  const glowTexture = makeGlowTexture();
  const moonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: srgb(0xcfe2f7),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  moonGlow.scale.set(34, 34, 1);
  moonGroup.add(moonCore, moonGlow);
  const MOON_X_WIDE = -46;
  const MOON_X_NARROW = -22; // 竖屏时月亮收向画面中部
  moonGroup.position.set(MOON_X_WIDE, 34, -120);
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

  // ---------- 气泡材质（环境气泡与文字气泡共用着色器） ----------

  function makeBubbleMaterial(sizeBase) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: srgb(0xaee0ff) },
        uBrightness: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSizeBase: { value: sizeBase },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vAlpha = aAlpha * smoothstep(1.0, 8.0, -mv.z);
          gl_PointSize = aSize * uPixelRatio * (uSizeBase / -mv.z);
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
    });
  }

  // ---------- 环境气泡 ----------

  const BUBBLE_COUNT = 220;
  const MAX_EXTRA_BUBBLES = 240;
  const TOTAL_BUBBLES = BUBBLE_COUNT + MAX_EXTRA_BUBBLES;
  const bubblePositions = new Float32Array(TOTAL_BUBBLES * 3);
  const bubbleSeeds = new Float32Array(TOTAL_BUBBLES);
  const bubbleSizes = new Float32Array(TOTAL_BUBBLES);
  const bubbleAlphas = new Float32Array(TOTAL_BUBBLES).fill(1);
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
    const x = (Math.random() - 0.5) * 160;
    const z = -30 - Math.random() * 140;
    bubblePositions[i * 3] = x;
    bubblePositions[i * 3 + 1] = initial
      ? WATER_Y + Math.random() * 30
      : WATER_Y + Math.random() * 2;
    bubblePositions[i * 3 + 2] = z;
    bubbleSeeds[i] = Math.random() * 100;
    bubbleSizes[i] = 0.5 + Math.random() * 1.7;
  }

  const bubbleGeo = new THREE.BufferGeometry();
  bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
  bubbleGeo.setAttribute('aSeed', new THREE.BufferAttribute(bubbleSeeds, 1));
  bubbleGeo.setAttribute('aSize', new THREE.BufferAttribute(bubbleSizes, 1));
  bubbleGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bubbleAlphas, 1));

  const bubbles = new THREE.Points(bubbleGeo, makeBubbleMaterial(26));
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
        bubbleAlphas[i] = 1;
        s.speed = 4 + Math.random() * 3.5;
        spawned++;
      }
    }
    bubbleGeo.attributes.aAlpha.needsUpdate = true;
  }

  // ---------- 文字气泡：汇聚成「周桂兰，我爱你」 ----------

  const TEXT_CYCLE = 18; // 完整循环周期（秒）
  const RISE_T = 2.8;
  const HOLD_T = 11.5;
  const FADE_T = 14.5;

  function buildTextTargets(text) {
    const cv = document.createElement('canvas');
    const W = 1200;
    const H = 220;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.font = '900 150px "Songti SC", "Noto Serif SC", "STSong", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2);
    const img = ctx.getImageData(0, 0, W, H).data;
    // 竖屏画面窄，文字世界宽度相应缩小
    const aspect = window.innerWidth / window.innerHeight;
    const TEXT_W = aspect < 0.75 ? 24 : 38;
    const scale = TEXT_W / W;
    const pts = [];
    const step = 6;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (img[(y * W + x) * 4 + 3] > 120) {
          pts.push([(x - W / 2) * scale, -(y - H / 2) * scale]);
        }
      }
    }
    return pts;
  }

  const textTargets = buildTextTargets(BUBBLE_TEXT);
  const TEXT_N = textTargets.length;

  const textPositions = new Float32Array(TEXT_N * 3);
  const textSeeds = new Float32Array(TEXT_N);
  const textSizes = new Float32Array(TEXT_N);
  const textAlphas = new Float32Array(TEXT_N);
  const textState = [];
  for (let i = 0; i < TEXT_N; i++) {
    textState.push({
      tx: textTargets[i][0],
      ty: TEXT_Y + textTargets[i][1],
      tz: TEXT_Z + (Math.random() - 0.5) * 1.6,
      delay: Math.random() * 3.0,
      seed: Math.random() * 100,
      sx: 0,
      sz: 0,
      cycle: -1,
    });
    textSeeds[i] = Math.random() * 100;
    textSizes[i] = 0.55 + Math.random() * 0.5;
    textAlphas[i] = 0;
    textPositions[i * 3 + 1] = -50;
  }

  const textGeo = new THREE.BufferGeometry();
  textGeo.setAttribute('position', new THREE.BufferAttribute(textPositions, 3));
  textGeo.setAttribute('aSeed', new THREE.BufferAttribute(textSeeds, 1));
  textGeo.setAttribute('aSize', new THREE.BufferAttribute(textSizes, 1));
  textGeo.setAttribute('aAlpha', new THREE.BufferAttribute(textAlphas, 1));

  const textBubbles = new THREE.Points(textGeo, makeBubbleMaterial(46));
  scene.add(textBubbles);

  function updateTextBubbles(t) {
    const ct = t % TEXT_CYCLE;
    const cycleIndex = Math.floor(t / TEXT_CYCLE);
    for (let i = 0; i < TEXT_N; i++) {
      const b = textState[i];
      if (b.cycle !== cycleIndex) {
        // 新周期：为每个气泡重新随机海面下的出发点
        b.cycle = cycleIndex;
        b.sx = (Math.random() - 0.5) * 44;
        b.sz = TEXT_Z + (Math.random() - 0.5) * 18;
      }
      const p = ct - b.delay;
      let x;
      let y;
      let z;
      let alpha;
      if (p < 0 || p > FADE_T) {
        alpha = 0;
        textPositions[i * 3 + 1] = -50;
        textAlphas[i] = 0;
        continue;
      }
      if (p < RISE_T) {
        const k = easeOutCubic(p / RISE_T);
        x = b.sx + (b.tx - b.sx) * k;
        y = THREE.MathUtils.lerp(WATER_Y - 2, b.ty, k);
        z = b.sz + (b.tz - b.sz) * k;
        alpha = k;
      } else if (p < HOLD_T) {
        x = b.tx + Math.sin(t * 1.3 + b.seed) * 0.12;
        y = b.ty + Math.sin(t * 0.9 + b.seed * 1.7) * 0.18 + (p - RISE_T) * 0.05;
        z = b.tz;
        alpha = 1;
      } else {
        const k = (p - HOLD_T) / (FADE_T - HOLD_T);
        x = b.tx + Math.sin(t * 1.1 + b.seed) * 0.4 * k;
        y = b.ty + k * 3.2;
        z = b.tz;
        alpha = 1 - k;
      }
      textPositions[i * 3] = x;
      textPositions[i * 3 + 1] = y;
      textPositions[i * 3 + 2] = z;
      textAlphas[i] = alpha;
    }
    textGeo.attributes.position.needsUpdate = true;
    textGeo.attributes.aAlpha.needsUpdate = true;
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
    color: srgb(0x74c4ff),
    emissive: srgb(0x2a6fa8),
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
    h.z = -24 - Math.random() * 70;
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
      const clampedZ = Math.max(-90, Math.min(20, hit.z));
      const clampedX = Math.max(-55, Math.min(55, hit.x));
      burstBubbles(clampedX, clampedZ);
    }
  });

  window.addEventListener('resize', () => {
    applyViewForAspect();
    renderer.setSize(window.innerWidth, window.innerHeight);
    const pr = Math.min(window.devicePixelRatio, 2);
    bubbles.material.uniforms.uPixelRatio.value = pr;
    textBubbles.material.uniforms.uPixelRatio.value = pr;
  });

  // ---------- 渲染循环 ----------

  const clock = new THREE.Clock();
  let themeMix = isDark() ? 1.0 : 0.0; // 1 = 深色, 0 = 浅色

  const darkWaterShallow = srgb(0x17406b);
  const darkWaterDeep = srgb(0x0a2340);
  const lightWaterShallow = srgb(0x2e8fc4);
  const lightWaterDeep = srgb(0x1273a8);
  const darkSkyTop = srgb(0x102642);
  const darkSkyBottom = srgb(0x12294a);
  const lightSkyTop = srgb(0x9fd4f0);
  const lightSkyBottom = srgb(0xcfe9f8);
  const darkMoon = srgb(0xf7f4e6);
  const lightSun = srgb(0xfff6d8);
  const darkMoonGlow = srgb(0xcfe2f7);
  const lightSunGlow = srgb(0xffedbf);
  const darkBubble = srgb(0xaee0ff);
  const lightBubble = srgb(0xffffff);
  const darkHeart = srgb(0x74c4ff);
  const lightHeart = srgb(0xff8fab);
  const darkFog = srgb(0x12294a);
  const lightFog = srgb(0xcfe9f8);
  const darkSandDry = srgb(0x8a7d63);
  const darkSandWet = srgb(0x5c5342);
  const lightSandDry = srgb(0xe2cfa8);
  const lightSandWet = srgb(0xb5a37e);

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
    skyUniforms.uTopColor.value.copy(lightSkyTop).lerp(darkSkyTop, themeMix);
    skyUniforms.uBottomColor.value.copy(lightSkyBottom).lerp(darkSkyBottom, themeMix);
    moonCore.material.color.copy(lightSun).lerp(darkMoon, themeMix);
    moonGlow.material.color.copy(lightSunGlow).lerp(darkMoonGlow, themeMix);
    fog.color.copy(lightFog).lerp(darkFog, themeMix);
    sandUniforms.uDry.value.copy(lightSandDry).lerp(darkSandDry, themeMix);
    sandUniforms.uWet.value.copy(lightSandWet).lerp(darkSandWet, themeMix);

    for (const pts of [bubbles, textBubbles]) {
      pts.material.uniforms.uColor.value.copy(lightBubble).lerp(darkBubble, themeMix);
      pts.material.uniforms.uBrightness.value = THREE.MathUtils.lerp(0.55, 1.0, themeMix);
    }
    starUniforms.uOpacity.value = 1.0 - themeMix;
    heartMat.color.copy(lightHeart).lerp(darkHeart, themeMix);
    hearts.forEach((h) => {
      h.mesh.material.color.copy(heartMat.color);
      h.mesh.material.emissive.copy(heartMat.color).multiplyScalar(0.45);
    });

    // 海浪
    waterUniforms.uTime.value = t;

    // 星空
    starUniforms.uTime.value = t;

    // 环境气泡上浮
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
      if (pos[i * 3 + 1] > 20) {
        if (i < BUBBLE_COUNT) {
          resetBubble(i, false);
        } else {
          s.active = false;
          pos[i * 3 + 1] = -100;
        }
      }
    }
    bubbleGeo.attributes.position.needsUpdate = true;

    // 文字气泡
    updateTextBubbles(t);

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

    // 相机视差（基于基准位置做阻尼偏移）
    cameraTarget.x = pointer.x * 2.2;
    cameraTarget.y = pointer.y * 1.2;
    camera.position.x = damp(camera.position.x, CAM_BASE.x + cameraTarget.x, 2.5, dt);
    camera.position.y = damp(camera.position.y, CAM_BASE.y + cameraTarget.y, 2.5, dt);
    camera.position.z = CAM_BASE.z;
    camera.lookAt(CAM_LOOK);

    // 竖屏时月亮收向画面中部，避免出画
    const narrow = window.innerWidth / window.innerHeight < 0.75;
    const targetMoonX = narrow ? MOON_X_NARROW : MOON_X_WIDE;
    moonGroup.position.x = damp(moonGroup.position.x, targetMoonX, 3, dt);

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
