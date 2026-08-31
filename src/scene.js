import * as THREE from 'three';
import { GLOW_TEXT } from './config.js';

// 晨光雾白海：渐变天空 + 悬海平线的淡金太阳 + 镜面海 + 光路
// 构图：低机位，海平线在画面下 1/3，天空占 2/3

const HORIZON_Y = 0;   // 海平线高度
const SUN_POS = new THREE.Vector3(0, 5.2, -300); // 太阳在正前方略高于海平线

function damp(cur, target, lambda, dt) {
  return THREE.MathUtils.damp(cur, target, lambda, dt);
}

function makeTextTexture(text) {
  const W = 2048;
  const H = 320;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.font = '600 190px "Songti SC", "Noto Serif SC", "STSong", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5d4a2c';
  ctx.fillText(text, W / 2, H / 2 + 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowSpriteTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,251,240,1)');
  g.addColorStop(0.18, 'rgba(255,246,225,0.85)');
  g.addColorStop(0.45, 'rgba(255,238,205,0.28)');
  g.addColorStop(1, 'rgba(255,235,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1200,
  );
  const CAM_BASE = new THREE.Vector3(0, 3.4, 40);
  const CAM_LOOK = new THREE.Vector3(0, 6.2, -120);
  camera.position.copy(CAM_BASE);

  function applyViewForAspect() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    // 竖屏：稍拉高机位并加大视场，保海平线在下 1/3
    if (aspect < 0.75) {
      camera.fov = 62;
      CAM_BASE.set(0, 3.8, 36);
      CAM_LOOK.set(0, 7.0, -120);
    } else {
      camera.fov = 50;
      CAM_BASE.set(0, 3.4, 40);
      CAM_LOOK.set(0, 6.2, -120);
    }
    camera.updateProjectionMatrix();
  }
  applyViewForAspect();

  // ---------- 天空穹：晨光渐变 + 太阳 + 大范围光晕 ----------

  const skyUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_POS.clone().normalize() },
    // 渐变色（sRGB 直读，输出不做额外转换）
    uTopColor: { value: new THREE.Color().setHex(0x8fc0e6, THREE.SRGBColorSpace) },
    uMidColor: { value: new THREE.Color().setHex(0xd5e6ef, THREE.SRGBColorSpace) },
    uHorizonColor: { value: new THREE.Color().setHex(0xfff1d6, THREE.SRGBColorSpace) },
    uSunColor: { value: new THREE.Color().setHex(0xffdf9e, THREE.SRGBColorSpace) },
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.05, 1.0);
          vec3 color = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.22, h));
          color = mix(color, uTopColor, smoothstep(0.18, 0.75, h));
          // 太阳核心与光晕
          float sunAng = dot(normalize(vDir), uSunDir);
          float core = smoothstep(0.99965, 0.99992, sunAng);
          float glow = pow(clamp(sunAng, 0.0, 1.0), 64.0) * 0.55
                     + pow(clamp(sunAng, 0.0, 1.0), 12.0) * 0.22;
          color = mix(color, uSunColor, glow);
          color += uSunColor * core;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  // 太阳本体的柔光 sprite（让太阳有「体积」感）
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowSpriteTexture(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
    }),
  );
  sunGlow.position.copy(SUN_POS).multiplyScalar(0.98);
  sunGlow.scale.set(260, 260, 1);
  scene.add(sunGlow);

  // ---------- 海面：近镜面反射 + 微波 + 金色光路 ----------

  const waterUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_POS.clone().normalize() },
    uSkyTop: skyUniforms.uTopColor,
    uSkyMid: skyUniforms.uMidColor,
    uSkyHorizon: skyUniforms.uHorizonColor,
    uSunColor: skyUniforms.uSunColor,
  };

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyMid;
        uniform vec3 uSkyHorizon;
        uniform vec3 uSunColor;
        varying vec3 vWorldPos;

        // 廉价微法线：多组极低幅正弦叠加
        vec3 microNormal(vec2 p, float t) {
          float e = 0.35;
          float nx = sin(p.x * 0.9 + t * 0.7) * e
                   + sin(p.x * 2.3 - t * 1.1 + p.y * 0.4) * e * 0.5;
          float nz = sin(p.y * 0.8 - t * 0.55) * e
                   + sin(p.y * 2.1 + t * 0.9 - p.x * 0.3) * e * 0.5;
          return normalize(vec3(nx * 0.06, 1.0, nz * 0.06));
        }

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 n = microNormal(vWorldPos.xz, uTime);
          vec3 refl = reflect(-viewDir, n);
          refl.y = abs(refl.y); // 反射方向限定在天空半球

          // 反射采样天空渐变（与穹顶同款函数）
          float h = clamp(refl.y, 0.0, 1.0);
          vec3 sky = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.22, h));
          sky = mix(sky, uSkyTop, smoothstep(0.18, 0.75, h));

          // 太阳镜面高光 -> 拉出金色光路
          float sunAng = dot(normalize(refl), uSunDir);
          float glitter = pow(clamp(sunAng, 0.0, 1.0), 300.0) * 2.2
                        + pow(clamp(sunAng, 0.0, 1.0), 48.0) * 0.5;
          // 光路随微波闪烁
          float sparkle = 0.75 + 0.25 * sin(vWorldPos.x * 3.0 + uTime * 2.0)
                        * sin(vWorldPos.z * 2.0 - uTime * 1.4);

          // 菲涅尔：远处接近全反射（倒影清晰），近处透出海色
          float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.2);
          vec3 deepColor = uSkyHorizon * 0.82 + uSkyMid * 0.10;

          vec3 color = mix(deepColor, sky, clamp(fres + 0.18, 0.0, 1.0));
          color += uSunColor * glitter * sparkle;

          // 远处海天交界做柔焦融合
          float dist = length(vWorldPos.xz - cameraPosition.xz);
          float blend = smoothstep(240.0, 650.0, dist);
          color = mix(color, uSkyHorizon, blend * 0.85);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = HORIZON_Y;
  scene.add(water);

  // ---------- 空中发光字 + 海面倒影 ----------

  const textTex = makeTextTexture(GLOW_TEXT);
  const TEXT_W = 46;
  const TEXT_H = TEXT_W * (320 / 2048);
  const TEXT_POS = new THREE.Vector3(0, 13.5, -95);

  const glowText = new THREE.Mesh(
    new THREE.PlaneGeometry(TEXT_W, TEXT_H),
    new THREE.MeshBasicMaterial({
      map: textTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
  );
  glowText.position.copy(TEXT_POS);
  scene.add(glowText);

  // 文字柔光底衬（把字从亮背景里衬出来）
  const textHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowSpriteTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: false,
    }),
  );
  textHalo.position.copy(TEXT_POS);
  textHalo.scale.set(TEXT_W * 0.85, TEXT_W * 0.28, 1);
  scene.add(textHalo);

  // 倒影：垂直翻转 + 半透明 + 轻微拉伸
  const reflection = new THREE.Mesh(
    new THREE.PlaneGeometry(TEXT_W * 1.05, TEXT_H * 2.4),
    new THREE.MeshBasicMaterial({
      map: textTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      fog: false,
    }),
  );
  reflection.rotation.x = -Math.PI / 2;
  reflection.rotation.z = Math.PI;
  reflection.position.set(0, 0.06, TEXT_POS.z + TEXT_H * 1.1);
  scene.add(reflection);

  // ---------- 稀疏萤火气泡 ----------

  const FIREFLY_N = 60;
  const ffPos = new Float32Array(FIREFLY_N * 3);
  const ffSeed = new Float32Array(FIREFLY_N);
  const ffSize = new Float32Array(FIREFLY_N);
  const ffBase = [];
  for (let i = 0; i < FIREFLY_N; i++) {
    const x = (Math.random() - 0.5) * 90;
    const y = 1.5 + Math.random() * 16;
    const z = -12 - Math.random() * 90;
    ffBase.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
    ffSeed[i] = Math.random() * 100;
    ffSize[i] = 0.55 + Math.random() * 0.9;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('aSeed', new THREE.BufferAttribute(ffSeed, 1));
  ffGeo.setAttribute('aSize', new THREE.BufferAttribute(ffSize, 1));

  const ffUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };

  const fireflies = new THREE.Points(
    ffGeo,
    new THREE.ShaderMaterial({
      uniforms: ffUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed;
        attribute float aSize;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vTwinkle;
        void main() {
          vTwinkle = 0.55 + 0.45 * sin(uTime * 0.9 + aSeed * 6.28);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 30.0 * uPixelRatio / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vTwinkle;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          // 白透气泡：亮环 + 淡核，柔和虹彩
          float ring = smoothstep(0.5, 0.38, d) * smoothstep(0.15, 0.38, d);
          float core = smoothstep(0.32, 0.0, d);
          vec3 rim = mix(vec3(1.0), vec3(0.86, 0.93, 1.0), smoothstep(0.3, 0.5, d));
          vec3 col = rim * (ring * 0.55 + core * 0.35);
          gl_FragColor = vec4(col, (ring * 0.5 + core * 0.4) * vTwinkle);
        }
      `,
    }),
  );
  scene.add(fireflies);

  // ---------- 轻交互 ----------

  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('pointerdown', (e) => {
    // 点击处在附近激起一圈涟漪气泡（复用萤火位置池，避免加对象）
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const spark = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < spark; k++) {
      const i = Math.floor(Math.random() * FIREFLY_N);
      ffBase[i].y = Math.max(1.2, ffBase[i].y * 0.6);
      ffBase[i].phase = Math.random() * Math.PI * 2;
    }
  });

  window.addEventListener('resize', () => {
    applyViewForAspect();
    renderer.setSize(window.innerWidth, window.innerHeight);
    ffUniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });

  // ---------- 渲染循环 ----------

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    skyUniforms.uTime.value = t;
    waterUniforms.uTime.value = t;
    ffUniforms.uTime.value = t;

    // 萤火气泡：缓慢漂浮 + 轻微呼吸
    for (let i = 0; i < FIREFLY_N; i++) {
      const b = ffBase[i];
      ffPos[i * 3] = b.x + Math.sin(t * 0.22 + b.phase) * 1.6;
      ffPos[i * 3 + 1] = b.y + Math.sin(t * 0.31 + b.phase * 1.7) * 0.9;
      ffPos[i * 3 + 2] = b.z + Math.cos(t * 0.18 + b.phase) * 1.4;
    }
    ffGeo.attributes.position.needsUpdate = true;

    // 发光字极轻微的悬浮呼吸
    glowText.position.y = TEXT_POS.y + Math.sin(t * 0.5) * 0.22;
    textHalo.position.y = glowText.position.y;
    reflection.material.opacity = 0.26 + Math.sin(t * 0.5) * 0.04;

    // 相机视差
    camera.position.x = damp(camera.position.x, CAM_BASE.x + pointer.x * 2.0, 2.2, dt);
    camera.position.y = damp(camera.position.y, CAM_BASE.y + pointer.y * 1.1, 2.2, dt);
    camera.lookAt(CAM_LOOK);

    renderer.render(scene, camera);
  }

  animate();
}
