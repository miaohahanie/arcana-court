/* ============================================================
   奥术之庭 · ARCANA COURT
   Three.js 魔法场景 + 哈希路由博客（文章 / 归档 / 标签 / 关于 / 评论）
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { POSTS, SORTED_POSTS } from './posts.js';

const canvas = document.getElementById('scene');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width: 768px)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  window.__arcanaReady = true;
  setTimeout(() => document.getElementById('loader')?.classList.add('gone'), 500);
}

try {
  init();
} catch (err) {
  console.error('奥术法阵构建失败：', err);
  const t = document.querySelector('.loader-txt');
  if (t) t.textContent = '此界无法承载魔法（WebGL 不可用）';
  setTimeout(() => document.getElementById('loader')?.classList.add('gone'), 1400);
}

function init() {
  /* ---------------- 基础舞台 ---------------- */

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x07030f, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x07030f, 0.028);

  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(0, 0.8, 9);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.75, 0.12);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------------- 工具：辉光贴图 ---------------- */

  function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255, 244, 255, 0.9)');
    g.addColorStop(0.25, 'rgba(196, 150, 255, 0.45)');
    g.addColorStop(0.6, 'rgba(124, 58, 237, 0.14)');
    g.addColorStop(1, 'rgba(124, 58, 237, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();

  /* ---------------- 奥术法阵（程序化符文环） ---------------- */

  let seed = 42;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function drawRune(x, s) {
    x.strokeStyle = 'rgba(222, 210, 248, 0.9)';
    x.lineWidth = s * 0.14;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(0, -s);
    x.lineTo(0, s);
    x.stroke();
    const branches = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < branches; i++) {
      const y0 = -s + rand() * s * 1.5;
      x.beginPath();
      x.moveTo(0, y0);
      x.lineTo((rand() < 0.5 ? -1 : 1) * s * (0.7 + rand() * 0.3), y0 + s * (0.4 + rand() * 0.7));
      x.stroke();
    }
  }

  function makeCircleTexture(size, variant) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.translate(size / 2, size / 2);
    const S = size / 2;

    const ring = (r, w, a = 0.9, dash = null) => {
      x.strokeStyle = `rgba(196, 181, 253, ${a})`;
      x.lineWidth = w;
      x.setLineDash(dash || []);
      x.beginPath();
      x.arc(0, 0, r, 0, Math.PI * 2);
      x.stroke();
      x.setLineDash([]);
    };

    if (variant === 0) {
      ring(S * 0.965, size * 0.004, 0.95);
      ring(S * 0.9, size * 0.0018, 0.75);
      for (let i = 0; i < 72; i++) {
        const long = i % 6 === 0;
        const a = (i / 72) * Math.PI * 2;
        x.strokeStyle = `rgba(196, 181, 253, ${long ? 0.9 : 0.5})`;
        x.lineWidth = size * (long ? 0.0022 : 0.0014);
        const r0 = long ? S * 0.915 : S * 0.932;
        x.beginPath();
        x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        x.lineTo(Math.cos(a) * S * 0.965, Math.sin(a) * S * 0.965);
        x.stroke();
      }
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        x.save();
        x.translate(Math.cos(a) * S * 0.82, Math.sin(a) * S * 0.82);
        x.rotate(a + Math.PI / 2);
        drawRune(x, S * 0.052);
        x.restore();
      }
      ring(S * 0.735, size * 0.0018, 0.7, [size * 0.008, size * 0.014]);
      const hex = (rot) => {
        x.strokeStyle = 'rgba(180, 155, 250, 0.85)';
        x.lineWidth = size * 0.0022;
        x.beginPath();
        for (let i = 0; i <= 3; i++) {
          const a = rot + (i / 3) * Math.PI * 2;
          const px = Math.cos(a) * S * 0.62, py = Math.sin(a) * S * 0.62;
          i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
        }
        x.stroke();
        for (let i = 0; i < 3; i++) {
          const a = rot + (i / 3) * Math.PI * 2;
          x.beginPath();
          x.arc(Math.cos(a) * S * 0.62, Math.sin(a) * S * 0.62, size * 0.009, 0, Math.PI * 2);
          x.stroke();
        }
      };
      hex(-Math.PI / 2);
      hex(Math.PI / 2);
      ring(S * 0.4, size * 0.0018, 0.75);
      ring(S * 0.33, size * 0.0016, 0.6, [size * 0.006, size * 0.01]);
      x.strokeStyle = 'rgba(216, 207, 235, 0.85)';
      x.lineWidth = size * 0.0018;
      x.beginPath();
      x.moveTo(-S * 0.08, 0); x.lineTo(S * 0.08, 0);
      x.moveTo(0, -S * 0.08); x.lineTo(0, S * 0.08);
      x.stroke();
      ring(S * 0.05, size * 0.0018, 0.9);
    } else {
      ring(S * 0.95, size * 0.003, 0.85);
      ring(S * 0.86, size * 0.0015, 0.6, [size * 0.005, size * 0.012]);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        x.strokeStyle = 'rgba(196, 181, 253, 0.45)';
        x.lineWidth = size * 0.0013;
        x.beginPath();
        x.moveTo(Math.cos(a) * S * 0.86, Math.sin(a) * S * 0.86);
        x.lineTo(Math.cos(a) * S * 0.95, Math.sin(a) * S * 0.95);
        x.stroke();
      }
      x.strokeStyle = 'rgba(180, 155, 250, 0.8)';
      x.lineWidth = size * 0.002;
      x.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        const px = Math.cos(a) * S * 0.6, py = Math.sin(a) * S * 0.6;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      ring(S * 0.28, size * 0.0015, 0.7);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  const circleGroup = new THREE.Group();
  circleGroup.position.set(0, -2.4, 0);
  circleGroup.rotation.x = -Math.PI / 2;
  scene.add(circleGroup);

  const ringMat1 = new THREE.MeshBasicMaterial({
    map: makeCircleTexture(1024, 0),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.85,
  });
  const ring1 = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 9.4), ringMat1);
  circleGroup.add(ring1);

  const ringMat2 = new THREE.MeshBasicMaterial({
    map: makeCircleTexture(1024, 1),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.45,
  });
  const ring2 = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), ringMat2);
  ring2.position.y = 0.012;
  circleGroup.add(ring2);

  const underGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x6d28d9, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  underGlow.scale.set(12.5, 12.5, 1);
  circleGroup.add(underGlow);

  /* ---------------- 魔核（菲涅尔球） ---------------- */

  const orbGroup = new THREE.Group();
  orbGroup.position.set(0, 0.55, -1.6);
  scene.add(orbGroup);

  const orbShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 48, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.1);
          vec3 deep = vec3(0.16, 0.07, 0.36);
          vec3 glow = vec3(0.74, 0.52, 1.0);
          gl_FragColor = vec4(mix(deep, glow, f), 0.2 + f * 0.85);
        }`,
    })
  );
  orbGroup.add(orbShell);

  const orbCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x2a1354 })
  );
  orbGroup.add(orbCore);

  const orbHitMeshes = [orbShell, orbCore];

  const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x8b5cf6, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  orbHalo.scale.set(4, 4, 1);
  orbGroup.add(orbHalo);

  /* ---------------- 悬浮水晶 ---------------- */

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x2e1a5e,
    emissive: 0x7c3aed,
    emissiveIntensity: 0.38,
    metalness: 0.15,
    roughness: 0.28,
    flatShading: true,
  });
  const crystals = [];
  [
    [-5.6, 1.3, -2.2, 1.15], [5.9, 2.5, -3.2, 0.85], [-7.2, 3.3, -4.6, 1.5],
    [6.6, -0.5, -1.6, 0.7], [-4.3, -0.9, -1.2, 0.55], [7.6, 1.6, -5.2, 1.25],
    [-6.9, -0.3, -3.4, 0.95], [4.8, 3.9, -4.4, 0.75],
  ].forEach(([px, py, pz, s], i) => {
    const geo = i % 2 === 0 ? new THREE.OctahedronGeometry(0.52, 0) : new THREE.IcosahedronGeometry(0.46, 0);
    const m = new THREE.Mesh(geo, crystalMat);
    m.position.set(px, py, pz);
    m.scale.setScalar(s);
    m.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
    m.userData = { baseY: py, phase: rand() * Math.PI * 2, spin: 0.12 + rand() * 0.22 };
    scene.add(m);
    crystals.push(m);
  });

  scene.add(new THREE.AmbientLight(0x4c3a86, 0.9));
  scene.add(new THREE.HemisphereLight(0x3b2a6b, 0x0b0614, 0.7));
  const keyLight = new THREE.PointLight(0xa855f7, 60, 40, 2);
  keyLight.position.set(0, 2.6, 2.6);
  scene.add(keyLight);

  /* ---------------- 星尘（GPU 粒子） ---------------- */

  const DUST_COUNT = reduced ? 500 : narrow ? 900 : 2000;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST_COUNT * 3);
  const dScale = new Float32Array(DUST_COUNT);
  const dSeed = new Float32Array(DUST_COUNT);
  for (let i = 0; i < DUST_COUNT; i++) {
    dPos[i * 3] = (Math.random() * 2 - 1) * 13;
    dPos[i * 3 + 1] = Math.random() * 12 - 3;
    dPos[i * 3 + 2] = Math.random() * 10.5 - 7;
    dScale[i] = 0.35 + Math.random() * 0.9;
    dSeed[i] = Math.random();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute('aScale', new THREE.BufferAttribute(dScale, 1));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));

  const dustUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
    uMouse: { value: new THREE.Vector2(99, 99) },
  };
  const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec2 uMouse;
      attribute float aScale;
      attribute float aSeed;
      varying float vAlpha;
      varying float vMix;
      void main() {
        vec3 p = position;
        float speed = 0.12 + aSeed * 0.22;
        p.y = mod(p.y + uTime * speed + 12.0, 12.0) - 3.0;
        p.x += sin(uTime * 0.25 + aSeed * 21.0) * 0.4;
        p.z += cos(uTime * 0.18 + aSeed * 13.0) * 0.35;
        vec2 d = p.xy - uMouse;
        float dd = dot(d, d);
        float force = exp(-dd * 0.3) * 1.1;
        p.xy += (d / max(sqrt(dd), 0.001)) * force;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 2.2) + aSeed * 43.0);
        vAlpha = (0.35 + 0.65 * tw) * (1.0 - smoothstep(9.0, 16.0, -mv.z));
        vMix = aSeed;
        gl_PointSize = aScale * uPixelRatio * (42.0 / max(-mv.z, 0.1));
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying float vAlpha;
      varying float vMix;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.05, d), 2.4);
        vec3 col = mix(vec3(0.45, 0.28, 0.85), vec3(0.82, 0.62, 1.0), vMix);
        col = mix(col, vec3(0.97, 0.88, 1.0), pow(a, 3.0));
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
  }));
  scene.add(dust);

  /* ---------------- 交互粒子池 ---------------- */

  const FX_MAX = 900;
  const fxGeo = new THREE.BufferGeometry();
  const fxPos = new Float32Array(FX_MAX * 3).fill(-999);
  const fxLife = new Float32Array(FX_MAX);
  const fxSize = new Float32Array(FX_MAX);
  const fxKind = new Float32Array(FX_MAX);
  const fxVel = new Float32Array(FX_MAX * 3);
  const fxDecay = new Float32Array(FX_MAX);
  let fxHead = 0;

  fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3));
  fxGeo.setAttribute('aLife', new THREE.BufferAttribute(fxLife, 1));
  fxGeo.setAttribute('aSize', new THREE.BufferAttribute(fxSize, 1));
  fxGeo.setAttribute('aKind', new THREE.BufferAttribute(fxKind, 1));

  const fx = new THREE.Points(fxGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uPixelRatio;
      attribute float aLife;
      attribute float aSize;
      attribute float aKind;
      varying float vLife;
      varying float vKind;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vLife = aLife;
        vKind = aKind;
        gl_PointSize = aSize * uPixelRatio * (38.0 / max(-mv.z, 0.1));
      }`,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying float vLife;
      varying float vKind;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.02, d), 2.2);
        vec3 trail = vec3(0.76, 0.62, 1.0);
        vec3 burst = mix(vec3(0.95, 0.78, 1.0), vec3(0.72, 0.45, 1.0), vLife);
        vec3 col = mix(trail, burst, vKind);
        gl_FragColor = vec4(col, a * vLife * mix(0.5, 0.95, vKind));
      }`,
  }));
  scene.add(fx);

  function emitFx(x, y, z, count, speed, kind, size) {
    for (let i = 0; i < count; i++) {
      const idx = fxHead++ % FX_MAX;
      fxPos[idx * 3] = x + (Math.random() - 0.5) * 0.1;
      fxPos[idx * 3 + 1] = y + (Math.random() - 0.5) * 0.1;
      fxPos[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.1;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      fxVel[idx * 3] = Math.sin(ph) * Math.cos(th) * sp;
      fxVel[idx * 3 + 1] = Math.cos(ph) * sp;
      fxVel[idx * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp * 0.6;
      fxLife[idx] = 1;
      fxDecay[idx] = 1 / (0.5 + Math.random() * 0.7);
      fxSize[idx] = size * (0.6 + Math.random() * 0.8);
      fxKind[idx] = kind;
    }
    fxGeo.attributes.aSize.needsUpdate = true;
    fxGeo.attributes.aKind.needsUpdate = true;
  }

  function updateFx(dt) {
    let touched = false;
    for (let i = 0; i < FX_MAX; i++) {
      if (fxLife[i] <= 0) continue;
      touched = true;
      fxLife[i] -= dt * fxDecay[i];
      if (fxLife[i] <= 0) {
        fxPos[i * 3 + 1] = -999;
        continue;
      }
      const damp = Math.max(0, 1 - 2.4 * dt);
      fxVel[i * 3] *= damp;
      fxVel[i * 3 + 1] = fxVel[i * 3 + 1] * damp - 0.35 * dt;
      fxVel[i * 3 + 2] *= damp;
      fxPos[i * 3] += fxVel[i * 3] * dt;
      fxPos[i * 3 + 1] += fxVel[i * 3 + 1] * dt;
      fxPos[i * 3 + 2] += fxVel[i * 3 + 2] * dt;
    }
    if (touched) {
      fxGeo.attributes.position.needsUpdate = true;
      fxGeo.attributes.aLife.needsUpdate = true;
    }
  }

  /* ---------------- 施法冲击波 ---------------- */

  const waveGeo = new THREE.RingGeometry(0.92, 1, 64);
  const waves = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(waveGeo, new THREE.MeshBasicMaterial({
      color: 0xc9b4ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.visible = false;
    scene.add(m);
    waves.push({ mesh: m, t: 1 });
  }
  function castWave(x, y, z) {
    const w = waves.find((it) => it.t >= 1) || waves[0];
    w.t = 0;
    w.mesh.position.set(x, y, z);
    w.mesh.quaternion.copy(camera.quaternion);
    w.mesh.visible = true;
  }
  function updateWaves(dt) {
    for (const w of waves) {
      if (w.t >= 1) continue;
      w.t = Math.min(1, w.t + dt / 0.7);
      w.mesh.scale.setScalar(0.35 + w.t * 3.6);
      w.mesh.material.opacity = (1 - w.t) * (1 - w.t) * 0.9;
      w.mesh.visible = w.t < 1;
    }
  }

  /* ---------------- 指针 → 世界坐标 ---------------- */

  const raycaster = new THREE.Raycaster();
  const planeZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const mouseWorld = new THREE.Vector3(99, 99, 0);
  const lastEmit = new THREE.Vector3(99, 99, 99);
  let mouseNX = 0, mouseNY = 0;

  function refreshMouseWorld() {
    ndc.set(mouseNX, mouseNY);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(planeZ0, mouseWorld);
    if (!hit) mouseWorld.set(99, 99, 0);
  }

  addEventListener('pointermove', (e) => {
    mouseNX = (e.clientX / innerWidth) * 2 - 1;
    mouseNY = -(e.clientY / innerHeight) * 2 + 1;
    refreshMouseWorld();
  }, { passive: true });

  /* ---------------- 交互状态 ---------------- */

  let searchOpen = false;
  let searchFocus = 0;
  let orbVisibility = 1;
  let orbHot = false;
  let bloomPulse = 0;

  const INTERACTIVE = 'a, button, .card, #ritualNav, #meter, #pageView, #searchRitual, input, textarea';
  addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    refreshMouseWorld();
    ndc.set(mouseNX, mouseNY);
    raycaster.setFromCamera(ndc, camera);
    if (orbVisibility > 0.15 && raycaster.intersectObjects(orbHitMeshes, false).length) {
      toggleSearch();
      return;
    }
    if (reduced) return;
    emitFx(mouseWorld.x, mouseWorld.y, mouseWorld.z, 52, 2.8, 1, 1.6);
  });

  /* ---------------- 滚动编排 ---------------- */

  let targetScroll = 0;
  let smoothScroll = 0;
  const meterFill = document.getElementById('meterFill');
  const meterTxt = document.getElementById('meterTxt');
  const METER_C = 100.53;

  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    targetScroll = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    meterFill.style.strokeDashoffset = String(METER_C * (1 - targetScroll));
    meterTxt.textContent = Math.round(targetScroll * 100) + '%';
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- 自适应 ---------------- */

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    dustUniforms.uPixelRatio.value = Math.min(devicePixelRatio, 2);
  });

  /* ---------------- 主循环 ---------------- */

  const clock = new THREE.Clock();
  const lookTarget = new THREE.Vector3();
  const camGoal = new THREE.Vector3();
  const projV = new THREE.Vector3();
  const smoothstep = (a, b, t) => {
    const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    smoothScroll += (targetScroll - smoothScroll) * Math.min(1, dt * 3.2);
    const s = smoothScroll;
    const ease = s * s * (3 - 2 * s);

    searchFocus += ((searchOpen ? 1 : 0) - searchFocus) * Math.min(1, dt * 3.2);
    camGoal.set(
      mouseNX * 0.85,
      0.8 - 1.15 * ease + mouseNY * 0.45 - searchFocus * 0.12,
      9 + Math.sin(s * Math.PI) * 2.3 - 1.7 * searchFocus
    );
    camera.position.lerp(camGoal, Math.min(1, dt * 3.5));
    const baseLookY = THREE.MathUtils.lerp(0.3, -2.05, smoothstep(0.18, 0.78, s));
    lookTarget.set(0, THREE.MathUtils.lerp(baseLookY, 0.55, searchFocus * 0.85), 0);
    camera.lookAt(lookTarget);
    camera.rotateZ(Math.sin(s * Math.PI * 2) * 0.02);

    ring1.rotation.z += dt * 0.07;
    ring2.rotation.z -= dt * 0.045;
    circleGroup.scale.setScalar(1 + 0.42 * ease);
    ringMat1.opacity = Math.min(1, 0.72 + Math.sin(t * 0.9) * 0.1 + ease * 0.3);
    ringMat2.opacity = 0.4 + Math.sin(t * 0.7 + 1.5) * 0.08 + ease * 0.25;

    orbGroup.position.y = 0.55 + Math.sin(t * 0.6) * 0.16;
    orbGroup.rotation.y += dt * 0.1;
    const orbFade = 1 - smoothstep(0.55, 0.9, s);
    orbVisibility = orbFade;
    orbShell.material.opacity = orbFade;
    orbHalo.material.opacity = (0.3 + (orbHot ? 0.22 : 0)) * orbFade * (0.85 + Math.sin(t * 1.3) * 0.15);
    orbCore.material.color.setHSL(0.72, 0.62, (orbHot ? 0.16 : 0.1) + Math.sin(t * 1.7) * 0.03);

    if (orbVisibility > 0.1 && !searchOpen) {
      ndc.set(mouseNX, mouseNY);
      raycaster.setFromCamera(ndc, camera);
      orbHot = raycaster.intersectObjects(orbHitMeshes, false).length > 0;
    } else {
      orbHot = false;
    }
    document.body.classList.toggle('orb-hot', orbHot);

    for (const c of crystals) {
      c.position.y = c.userData.baseY + Math.sin(t * 0.5 + c.userData.phase) * 0.35;
      c.rotation.y += dt * c.userData.spin;
      c.rotation.x = Math.sin(t * 0.3 + c.userData.phase) * 0.12;
    }

    dustUniforms.uTime.value = t;
    dustUniforms.uMouse.value.set(mouseWorld.x, mouseWorld.y);

    if (!reduced && mouseWorld.x < 50) {
      if (mouseWorld.distanceTo(lastEmit) > 0.17) {
        emitFx(mouseWorld.x, mouseWorld.y, mouseWorld.z, 2, 0.35, 0, 0.9);
        lastEmit.copy(mouseWorld);
      }
    }
    updateFx(dt);
    updateWaves(dt);

    const vw = innerWidth, vh = innerHeight;
    for (const sg of sigilAnchors) {
      projV.copy(sg.anchor).project(camera);
      const x = (projV.x * 0.5 + 0.5) * vw;
      const y = (-projV.y * 0.5 + 0.5) * vh + Math.sin(t * 0.7 + sg.phase) * 7;
      const dist = camera.position.distanceTo(sg.anchor);
      const k = THREE.MathUtils.clamp(9.5 / dist, 0.55, 1.2);
      const on = projV.z < 1 && x > -70 && x < vw + 70 && y > -70 && y < vh + 70;
      if (on !== sg.on) { sg.on = on; sg.el.classList.toggle('offscreen', !on); }
      if (on) {
        sg.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${k.toFixed(3)})`;
      }
    }

    document.body.classList.toggle('sigil-dim', s > 0.5 && s < 0.8);

    if (bloomPulse > 0) {
      bloomPulse = Math.max(0, bloomPulse - dt);
      const k = 1 - bloomPulse / 2.4;
      bloom.strength = 0.85 + Math.sin(k * Math.PI) * 0.9;
    }

    composer.render();

    if (!booted) boot();
  }

  /* ================= DOM 交互层 ================= */

  // 滚动显现
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        io.unobserve(en.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // 卷轴卡片：3D 倾斜 + 流光
  function bindCardTilt(card) {
    if (!finePointer || reduced) return;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      const rx = (0.5 - py) * 6.5;
      const ry = (px - 0.5) * 9;
      card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }

  function cardHTML(p, i) {
    return `<a class="card reveal" href="#/post/${p.slug}" style="--d:${(i % 2) * 0.08}s">
      <div class="sheen"></div>
      <div class="card-glyph" aria-hidden="true">${p.glyph}</div>
      <div class="card-meta"><span class="tag">${esc(p.tag)}</span><time>${esc(p.date)}</time></div>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      <span class="read">阅读咒文 <span>→</span></span>
    </a>`;
  }

  function renderHomeCards() {
    const wrap = document.getElementById('homeCards');
    if (!wrap) return;
    wrap.innerHTML = ALL_SORTED.map(cardHTML).join('');
    wrap.querySelectorAll('.card').forEach((card) => {
      io.observe(card);
      bindCardTilt(card);
    });
  }

  /* ============================================================
     哈希路由博客：#/ · #/post/slug · #/archive · #/tag/x · #/about
     ============================================================ */

  const pageView = document.getElementById('pageView');
  const shell = document.getElementById('pageShell');

  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 无痕模式等 */ } },
  };
  const likedList = () => store.get('arcana_liked', []);
  const isLiked = (slug) => likedList().includes(slug);
  const likeCount = (p) => p.likes + (isLiked(p.slug) ? 1 : 0);
  const localComments = (slug) => store.get('arcana_cmt_' + slug, []);
  const savedName = () => store.get('arcana_name', '');

  /* ---------------- 管理者咒语：铭刻室只对持咒人开放 ---------------- */

  let adminKey = store.get('arcana_admin_key', '');
  function applyAdmin() {
    document.body.classList.toggle('admin', !!adminKey);
  }
  applyAdmin();

  /* ---------------- 全站文章源：手写卷轴 + 铭刻室卷轴 + 本地卷轴 ---------------- */

  function buildAllPosts() {
    // 同名 slug 以本地（最新编辑）优先
    const seen = new Map();
    for (const p of [...(window.__USER_POSTS || []), ...store.get('arcana_user_posts', []), ...POSTS]) {
      if (!seen.has(p.slug)) seen.set(p.slug, p);
    }
    return [...seen.values()];
  }
  const sortByDate = (arr) => [...arr].sort((a, b) => (a.sortDate < b.sortDate ? 1 : -1));
  let ALL_POSTS = buildAllPosts();
  let ALL_SORTED = sortByDate(ALL_POSTS);
  function refreshPosts() {
    ALL_POSTS = buildAllPosts();
    ALL_SORTED = sortByDate(ALL_POSTS);
  }
  renderHomeCards(); // 首屏卡片（含铭刻室新增卷轴）

  /* ---------------- 轻提示 ---------------- */

  let toastTimer = null;
  function toast(msg, warn = false) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle('warn', warn);
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
  }

  /* ---------------- 铭刻室工具：月相 / Markdown / slug ---------------- */

  function moonPhaseName(iso) {
    const synodic = 29.53058867;
    const ref = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 新月
    const days = (Date.parse(iso + 'T00:00:00Z') - ref) / 86400000;
    const age = ((days % synodic) + synodic) % synodic;
    const table = [[1.85, '新月'], [5.54, '娥眉月'], [9.23, '上弦月'], [12.91, '盈凸月'], [16.61, '满月'], [20.30, '亏凸月'], [23.99, '下弦月'], [27.68, '残月']];
    for (const [lim, name] of table) if (age < lim) return name;
    return '新月';
  }
  function moonLabel(iso) {
    const [y, m, d] = iso.split('-');
    return moonPhaseName(iso) + ' · ' + `${y}.${m}.${d}`;
  }
  function autoSlug(title, sortDate) {
    let s = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!s) s = 'scroll-' + sortDate.replace(/-/g, '');
    return s;
  }
  function uniquifySlug(slug) {
    const set = new Set(ALL_POSTS.map((p) => p.slug));
    let s = slug, i = 2;
    while (set.has(s)) s = slug + '-' + i++;
    return s;
  }

  // Markdown 子集 → 卷轴 HTML：## 标题 / > 引文 / - 列表 / --- 分隔 / ``` 代码 / **粗** `码`
  function renderMarkdown(src) {
    const lines = String(src).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let para = [], quote = [], list = false, code = null;
    const inline = (s) => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; } };
    const flushList = () => { if (list) { out.push('</ul>'); list = false; } };
    const flushAll = () => { flushPara(); flushQuote(); flushList(); };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (/^\s*```/.test(line)) {
        if (code) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; }
        else { flushAll(); code = []; }
        continue;
      }
      if (code) { code.push(raw); continue; }
      if (/^##\s+/.test(line)) { flushAll(); out.push('<h2>' + inline(line.replace(/^##\s+/, '')) + '</h2>'); continue; }
      if (/^---+\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
      if (/^>\s?/.test(line)) { flushPara(); flushList(); quote.push(line.replace(/^>\s?/, '')); continue; }
      if (/^[-*]\s+/.test(line)) { flushPara(); flushQuote(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>'); continue; }
      if (!line.trim()) { flushAll(); continue; }
      flushQuote(); flushList(); para.push(line.trim());
    }
    if (code) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
    flushAll();
    return out.join('\n');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 极简咒文高亮：单趟扫描，注释/字符串/关键字/内建/数字 */
  function highlight(src) {
    const text = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const KW = /^(const|let|var|function|return|for|if|else|new|void|float|int|vec2|vec3|vec4|mat3|mat4|uniform|varying|attribute|precision|mediump|highp|sampler2D)$/;
    const BLT = /^(gl_Position|gl_FragColor|gl_PointSize|texture2D)$/;
    return text.replace(/(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([A-Za-z_]\w*)|(\d+\.?\d*)/g,
      (m, com, str, word, num) => {
        if (com) return '<span class="c-com">' + com + '</span>';
        if (str) return '<span class="c-str">' + str + '</span>';
        if (word) {
          if (KW.test(word)) return '<span class="c-kw">' + word + '</span>';
          if (BLT.test(word)) return '<span class="c-blt">' + word + '</span>';
          return word;
        }
        if (num) return '<span class="c-num">' + num + '</span>';
        return m;
      });
  }

  function highlightCode(root) {
    root.querySelectorAll('pre code').forEach((el) => { el.innerHTML = highlight(el.textContent); });
  }

  /* —— 页面开关 —— */

  function openPage(title) {
    document.title = title || '奥术之庭 · ARCANA COURT';
    shell.innerHTML = '';
    pageView.classList.add('open');
    pageView.setAttribute('aria-hidden', 'false');
    document.body.classList.add('page-open');
    pageView.scrollTop = 0;
  }
  function closePage() {
    if (!pageView.classList.contains('open')) return;
    pageView.classList.remove('open');
    pageView.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('page-open');
    document.title = '奥术之庭 · ARCANA COURT';
    onScroll(); // 恢复首页卷轴进度
  }

  /* —— 文章页 —— */

  function pnCard(p, dir, label) {
    return `<a class="pn-card ${dir}" href="#/post/${p.slug}"><span class="pn-dir">${label}</span><span class="pn-t">${p.title}</span></a>`;
  }

  function commentList(p) {
    const all = [...p.comments, ...localComments(p.slug)];
    return all.map((c) => `
      <div class="cmt-item">
        <span class="cmt-ava">${esc((c.name || '无名')[0])}</span>
        <div class="cmt-main">
          <p class="cmt-head">${esc(c.name || '无名氏')} <time>${esc(c.date)}</time></p>
          <p class="cmt-text">${esc(c.text)}</p>
        </div>
      </div>`).join('');
  }

  function renderPost(p) {
    const idx = ALL_SORTED.indexOf(p);
    const newer = ALL_SORTED[idx - 1];
    const older = ALL_SORTED[idx + 1];
    const cmtTotal = p.comments.length + localComments(p.slug).length;

    shell.innerHTML = `
      <button class="page-close" aria-label="合上卷轴返回首页">✕<i>合上卷轴</i></button>
      <header class="page-head">
        <div class="page-glyph" aria-hidden="true">${p.glyph}</div>
        <p class="page-meta">${esc(p.tag)} · ${esc(p.date)} · 约 ${esc(p.time)}咒读</p>
        <h1 class="page-title">${esc(p.title)}</h1>
      </header>
      <div class="page-body">${p.body}</div>
      <div class="page-foot">
        <button class="like-btn${isLiked(p.slug) ? ' done' : ''}">✦ 注入魔力 <b>${likeCount(p)}</b></button>
        <nav class="pn">
          ${older ? pnCard(older, 'prev', '前一章 · 更早的月相') : '<span></span>'}
          ${newer ? pnCard(newer, 'next', '后一章 · 更新的月相') : '<span></span>'}
        </nav>
      </div>
      <section class="comments">
        <h3 class="cmt-title">留言刻印 <span>${cmtTotal}</span></h3>
        <div class="cmt-list">${commentList(p)}</div>
        <form class="cmt-form">
          <input class="cmt-name" maxlength="16" placeholder="刻下你的法名（可留空为 无名氏）" value="${esc(savedName())}">
          <textarea class="cmt-text" rows="3" maxlength="300" placeholder="留下一段咒文……" required></textarea>
          <button type="submit" class="cast-btn">✦ 刻下</button>
        </form>
      </section>`;

    highlightCode(shell);

    shell.querySelector('.page-close').addEventListener('click', () => { location.hash = '#/'; });
    const likeBtn = shell.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => {
      const liked = likedList();
      if (liked.includes(p.slug)) return;
      liked.push(p.slug);
      store.set('arcana_liked', liked);
      likeBtn.classList.add('done');
      likeBtn.querySelector('b').textContent = likeCount(p);
      castWave(0, 0.4, 2);
      if (!reduced) emitFx(0, 0.4, 2, 26, 1.6, 1, 1.1);
    });
    shell.querySelector('.cmt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = shell.querySelector('.cmt-name');
      const textEl = shell.querySelector('.cmt-text');
      const text = textEl.value.trim();
      if (!text) return;
      const name = nameEl.value.trim() || '无名氏';
      store.set('arcana_name', name);
      const list = localComments(p.slug);
      const d = new Date();
      list.push({
        name,
        text,
        date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`,
      });
      store.set('arcana_cmt_' + p.slug, list);
      shell.querySelector('.cmt-list').innerHTML = commentList(p);
      shell.querySelector('.cmt-title span').textContent = p.comments.length + list.length;
      textEl.value = '';
      const cast = shell.querySelector('.cast-btn');
      cast.textContent = '✦ 刻印已成';
      setTimeout(() => { cast.textContent = '✦ 刻下'; }, 1600);
    });
  }

  /* —— 归档页（含标签筛选） —— */

  function renderArchive(filterTag) {
    const tags = [...new Set(ALL_POSTS.map((p) => p.tag))];
    const list = filterTag ? ALL_SORTED.filter((p) => p.tag === filterTag) : ALL_SORTED;
    shell.innerHTML = `
      <button class="page-close" aria-label="合上卷轴返回首页">✕<i>合上卷轴</i></button>
      <header class="page-head center">
        <p class="kicker">ARCHIVE · 卷轴归档</p>
        <h1 class="page-title">${filterTag ? esc(filterTag) + ' 流派' : '全部手稿'}</h1>
        <p class="page-meta">共 ${list.length} 卷 · 依月相倒序排列</p>
      </header>
      <div class="pills">
        <a class="pill${filterTag ? '' : ' active'}" href="#/archive">全部</a>
        ${tags.map((t) => `<a class="pill${filterTag === t ? ' active' : ''}" href="#/tag/${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
      </div>
      <div class="tl">
        ${list.map((p) => `
          <a class="tl-item" href="#/post/${p.slug}">
            <span class="tl-date">${esc(p.date)}</span>
            <span class="tl-glyph" aria-hidden="true">${p.glyph}</span>
            <span class="tl-title">${esc(p.title)}</span>
            <span class="tl-meta">${esc(p.tag)} · ${esc(p.time)}</span>
          </a>`).join('')}
      </div>
      <div class="archive-compose">
        <a class="rune-link" href="#/compose">✎ 撰写新卷轴</a>
      </div>`;
  }

  /* —— 关于页 —— */

  function renderAbout() {
    shell.innerHTML = `
      <button class="page-close" aria-label="合上卷轴返回首页">✕<i>合上卷轴</i></button>
      <header class="page-head center">
        <div class="page-glyph" aria-hidden="true">✦</div>
        <p class="kicker">ABOUT · 法师画像</p>
        <h1 class="page-title">旅行法师自述</h1>
      </header>
      <div class="page-body">
        <p>白天，我是一名修补现实裂缝的工匠——写业务代码，与需求周旋；夜晚，我摘下工牌，成为奥术之庭的看守，研习那些让像素违背物理的古老咒语。</p>
        <blockquote>我痴迷的从来不是技术本身，而是「无中生有」的那一刻：一行公式涌出一片星海，一次采样牵动整片海洋。</blockquote>
        <h2>修行流派</h2>
        <ul>
          <li><strong>召唤系</strong> —— WebGL / Three.js：把数学召唤成可见之物。</li>
          <li><strong>咒文系</strong> —— GLSL 着色器：对每颗像素低语。</li>
          <li><strong>元素系</strong> —— 流体与粒子模拟：驯服水、火与风。</li>
          <li><strong>结界系</strong> —— 性能优化：让魔法在贫瘠的凡人设备上也能运转。</li>
        </ul>
        <p>庭中收藏的每一卷轴，都是一次施法的完整记录：失败的、成功的，以及差点烧掉法阵的。若你在阅读间听见低语，别回头——那是显卡在高负载下吟唱。</p>
      </div>
      <div class="rune-links about-links">
        <a class="rune-link" href="#/archive">卷轴归档</a>
        <a class="rune-link" href="mailto:archmage@arcana.court">来信</a>
        <a class="rune-link" href="rss.xml" target="_blank" rel="noopener">RSS 咒约</a>
      </div>`;
  }

  /* —— 迷失页 —— */

  function renderLost() {
    shell.innerHTML = `
      <button class="page-close" aria-label="返回首页">✕<i>返回首页</i></button>
      <header class="page-head center">
        <div class="page-glyph" aria-hidden="true">✧</div>
        <p class="kicker">404 · 迷失星海</p>
        <h1 class="page-title">此处没有卷轴</h1>
      </header>
      <div class="page-body">
        <p>你念出的坐标坠入了星海深处，那里只有尘埃与回声。也许咒语拼写有误，也许这一卷从未被写下。</p>
      </div>
      <div class="rune-links about-links">
        <a class="rune-link" href="#/">回到法阵</a>
        <a class="rune-link" href="#/archive">翻阅归档</a>
      </div>`;
  }

  /* —— 铭刻室门禁：吟诵咒语方可入内 —— */

  function renderComposeGate() {
    shell.innerHTML = `
      <button class="page-close" aria-label="合上卷轴返回首页">✕<i>合上卷轴</i></button>
      <header class="page-head center">
        <div class="page-glyph" aria-hidden="true">✎</div>
        <p class="kicker">COMPOSE · 铭刻室</p>
        <h1 class="page-title">此门为管理者而设</h1>
      </header>
      <div class="page-body gate-body">
        <p>铭刻室是博客的私人书房。吟诵管理者的咒语方可开启——在读者的世界里，这扇门并不存在。</p>
        <form class="gate-form" id="gateForm">
          <input id="gateKey" type="password" placeholder="吟诵咒语……" autocomplete="off">
          <button type="submit" class="cast-btn big">✦ 开启</button>
        </form>
        <p class="gate-hint">咒语由 serve.py 验证 · 初始咒语 abracadabra · 可在 admin.json 中更改</p>
      </div>`;
    shell.querySelector('.page-close').addEventListener('click', () => { location.hash = '#/'; });
    shell.querySelector('#gateForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = shell.querySelector('#gateKey').value;
      try {
        const r = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        const j = await r.json();
        if (j.ok) {
          adminKey = key;
          store.set('arcana_admin_key', key);
          applyAdmin();
          toast('✦ 咒语应验 · 铭刻室已开启');
          renderCompose();
          return;
        }
        toast('咒语不符 · 法阵纹丝不动', true);
        const input = shell.querySelector('#gateKey');
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 460);
      } catch {
        toast('未检测到 serve.py · 请先运行 python serve.py', true);
      }
    });
  }

  function renderCompose() {
    const draft = store.get('arcana_draft', {}) || {};
    const today = new Date();
    const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tags = [...new Set(ALL_POSTS.map((p) => p.tag))];
    const glyphs = ['✦', '❋', '☾', '⚜', '⟡', '✧', '☉', '❖', '✵', '❈'];
    const v = (k, fb = '') => (draft[k] !== undefined ? draft[k] : fb);

    shell.innerHTML = `
      <button class="page-close" aria-label="合上卷轴返回首页">✕<i>合上卷轴</i></button>
      <header class="page-head center">
        <div class="page-glyph" aria-hidden="true">✎</div>
        <p class="kicker">COMPOSE · 铭刻室</p>
        <h1 class="page-title">铭刻新卷轴</h1>
      </header>
      <form class="compose" id="composeForm">
        <div class="compose-grid">
          <section class="compose-fields">
            <label>卷轴之名
              <input name="title" maxlength="60" required value="${esc(v('title'))}" placeholder="这一卷要讲什么？">
            </label>
            <div class="row3">
              <label>流派（分类）
                <input name="tag" list="tagOptions" maxlength="12" value="${esc(v('tag'))}" placeholder="图形学">
                <datalist id="tagOptions">${tags.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
              </label>
              <label>日期
                <input type="date" name="date" value="${esc(v('date', isoToday))}">
              </label>
              <label>符印
                <select name="glyph">${glyphs.map((g) => `<option value="${g}"${v('glyph', '✦') === g ? ' selected' : ''}>${g}</option>`).join('')}</select>
              </label>
            </div>
            <label>卷轴编号 slug（网址用，留空自动生成）
              <input name="slug" maxlength="40" value="${esc(v('slug'))}" placeholder="my-new-spell">
            </label>
            <label>摘要（留空自动截取正文）
              <textarea name="excerpt" rows="2" maxlength="120" placeholder="一句话引诱读者展开这卷轴……">${esc(v('excerpt'))}</textarea>
            </label>
            <label>正文（## 标题 · &gt; 引文 · - 列表 · --- 分隔 · \`\`\` 代码 \`\`\` · **粗** · \`码\`）
              <textarea name="body" rows="13" required placeholder="在此铭刻咒文……">${esc(v('body'))}</textarea>
            </label>
            <div class="compose-meta" id="composeMeta"></div>
            <div class="compose-actions">
              <button type="submit" class="cast-btn big" id="publishBtn">✦ 上传卷轴</button>
              <button type="button" class="ghost-btn" id="downloadPosts">下载备份</button>
              <button type="button" class="ghost-btn" id="sealBtn">封印铭刻室</button>
              <span class="compose-status" id="composeStatus"></span>
            </div>
          </section>
          <section class="compose-preview">
            <p class="kicker">PREVIEW · 显影</p>
            <div class="page-body" id="composePreview"></div>
          </section>
        </div>
      </form>`;

    const form = shell.querySelector('#composeForm');
    const preview = shell.querySelector('#composePreview');
    const meta = shell.querySelector('#composeMeta');
    const statusEl = shell.querySelector('#composeStatus');
    const publishBtn = shell.querySelector('#publishBtn');

    const update = () => {
      const html = renderMarkdown(form.body.value);
      preview.innerHTML = html;
      highlightCode(preview);
      const chars = form.body.value.replace(/\s/g, '').length;
      const min = Math.max(1, Math.round(chars / 400));
      const tagText = form.tag.value.trim() || '未分类';
      meta.textContent = `${chars} 字 · 约 ${min} 分钟咒读 · ${form.date.value ? moonLabel(form.date.value) : ''} · 流派：${tagText}`;
      const draftObj = {
        title: form.title.value, tag: form.tag.value, date: form.date.value,
        slug: form.slug.value, glyph: form.glyph.value, excerpt: form.excerpt.value,
        body: form.body.value,
      };
      store.set('arcana_draft', draftObj);
    };
    form.addEventListener('input', update);
    update();

    // 上传模式探测
    fetch('/api/health').then((r) => r.json())
      .then((j) => { if (j.api) statusEl.textContent = '上传模式 · 已连接禁书区（写入 posts.user.js）'; })
      .catch(() => { statusEl.textContent = '本地模式 · 未检测到 serve.py，将存入本浏览器'; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = form.title.value.trim();
      const bodySrc = form.body.value;
      if (!title || !bodySrc.trim()) return;
      const sortDate = form.date.value || isoToday;
      const manualSlug = form.slug.value.trim();
      const slug = uniquifySlug(manualSlug || autoSlug(title, sortDate));
      publishBtn.disabled = true;
      publishBtn.textContent = '✦ 正在铭刻……';

      const bodyHTML = renderMarkdown(bodySrc);
      const plain = bodyHTML.replace(/<[^>]+>/g, '');
      const excerpt = form.excerpt.value.trim() || plain.slice(0, 62) + (plain.length > 62 ? '……' : '');
      const chars = plain.replace(/\s/g, '').length;
      const post = {
        slug,
        glyph: form.glyph.value || '✦',
        tag: form.tag.value.trim() || '未分类',
        date: moonLabel(sortDate),
        sortDate,
        title,
        excerpt,
        time: `${Math.max(1, Math.round(chars / 400))} 分钟`,
        likes: 0,
        comments: [],
        body: bodyHTML,
      };

      const mode = await publishPost(post);
      if (mode === 'denied') {
        publishBtn.disabled = false;
        publishBtn.textContent = '✦ 上传卷轴';
        return;
      }
      refreshPosts();
      renderHomeCards();
      store.set('arcana_draft', null);
      toast(mode === 'server'
        ? '✦ 卷轴已上传 · posts.user.js 已更新'
        : '已存入本浏览器 · 运行 serve.py 后才能真正上传', mode !== 'server');
      location.hash = '#/post/' + slug;
    });

      shell.querySelector('#downloadPosts').addEventListener('click', () => {
      const data = store.get('arcana_user_posts', []);
      if (!data.length) { toast('本地暂无卷轴可备份', true); return; }
      const blob = new Blob(['window.__USER_POSTS = ' + JSON.stringify(data, null, 2) + ';\n'], { type: 'text/javascript' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'posts.user.js';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('备份已生成 · 覆盖根目录 posts.user.js 即可全站可见');
    });

    shell.querySelector('#sealBtn').addEventListener('click', () => {
      adminKey = '';
      store.set('arcana_admin_key', '');
      applyAdmin();
      toast('铭刻室已封印 · 读者的世界恢复如常');
      location.hash = '#/';
    });
  }

  async function publishPost(obj) {
    const local = store.get('arcana_user_posts', []);
    const i = local.findIndex((p) => p.slug === obj.slug);
    if (i >= 0) local[i] = obj; else local.unshift(obj);
    store.set('arcana_user_posts', local);
    try {
      const r = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Arcana-Key': adminKey },
        body: JSON.stringify(obj),
      });
      if (r.status === 403) {
        adminKey = '';
        store.set('arcana_admin_key', '');
        applyAdmin();
        toast('咒语已失效 · 请重新开启铭刻室', true);
        renderComposeGate();
        return 'denied';
      }
      if (!r.ok) throw new Error('bad status');
      return 'server';
    } catch {
      return 'local';
    }
  }

  /* —— 路由 —— */

  function route() {
    closeSearch();
    ritualNav.classList.remove('open');
    navOrb.setAttribute('aria-expanded', 'false');
    const raw = location.hash.replace(/^#\/?/, '');
    const [head, ...rest] = raw.split('/');
    if (head === 'post' && rest[0]) {
      const p = ALL_POSTS.find((x) => x.slug === rest[0]);
      if (p) { openPage(p.title + ' · 奥术之庭'); renderPost(p); return; }
      openPage('迷失星海 · 奥术之庭'); renderLost(); return;
    }
    if (head === 'archive') { openPage('卷轴归档 · 奥术之庭'); renderArchive(null); return; }
    if (head === 'compose') {
      openPage('铭刻室 · 奥术之庭');
      adminKey ? renderCompose() : renderComposeGate();
      return;
    }
    if (head === 'tag' && rest[0]) {
      const t = decodeURIComponent(rest[0]);
      openPage(t + ' 流派 · 奥术之庭'); renderArchive(t); return;
    }
    if (head === 'about') { openPage('法师画像 · 奥术之庭'); renderAbout(); return; }
    if (raw === '') { closePage(); return; }
    openPage('迷失星海 · 奥术之庭'); renderLost();
  }
  addEventListener('hashchange', route);

  // 文章页内滚动 → 复用右下进度环作为「咒读进度」
  pageView.addEventListener('scroll', () => {
    if (!pageView.classList.contains('open')) return;
    const max = pageView.scrollHeight - pageView.clientHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, pageView.scrollTop / max)) : 0;
    meterFill.style.strokeDashoffset = String(METER_C * (1 - p));
    meterTxt.textContent = Math.round(p * 100) + '%';
  }, { passive: true });

  /* ---------------- 法阵符印：真名系统 ---------------- */

  const sigilLayer = document.createElement('div');
  sigilLayer.id = 'sigilLayer';
  document.body.appendChild(sigilLayer);

  const SIGIL_DEFS = [
    { glyph: '✦', label: '卷一 · 星尘召唤术', slug: 'stardust-summoning', anchor: new THREE.Vector3(-2.5, -2.0, 0.9) },
    { glyph: '❋', label: '卷二 · 片元咒语', slug: 'fragment-spells', anchor: new THREE.Vector3(2.7, -2.1, -0.4) },
    { glyph: '☾', label: '卷三 · 月相与断点', slug: 'moon-and-breakpoints', anchor: new THREE.Vector3(-3.9, -2.25, -1.1) },
    { glyph: '⚜', label: '卷四 · 流体模拟', slug: 'taming-fluids', anchor: new THREE.Vector3(3.9, -2.2, 1.0) },
    { glyph: '⟡', label: '卷五 · 奥术命名法', slug: 'arcane-naming', anchor: new THREE.Vector3(-1.9, 2.4, -1.6) },
    { glyph: '✧', label: '卷六 · 阴影魔法', slug: 'price-of-shadows', anchor: new THREE.Vector3(2.4, 3.0, -2.2) },
    { glyph: '◈', label: '显露真实', anchor: new THREE.Vector3(0.1, -1.3, 2.4), master: true },
  ];

  const sigilAnchors = SIGIL_DEFS.map((def, i) => {
    const el = document.createElement('button');
    el.className = 'sigil' + (def.master ? ' sigil-master' : '');
    el.style.setProperty('--pd', (i * 0.45) + 's');
    el.style.setProperty('--sd', (i * 0.12) + 's');
    el.title = def.master ? '显露真实 · 让散落的真名一齐现形' : def.label + '（展开卷轴）';
    el.innerHTML = `<span class="sigil-glyph" aria-hidden="true">${def.glyph}</span><span class="sigil-name">${def.label}</span>`;
    sigilLayer.appendChild(el);
    el.addEventListener('click', () => {
      castWave(def.anchor.x, def.anchor.y, def.anchor.z);
      if (!reduced) emitFx(def.anchor.x, def.anchor.y, def.anchor.z, 40, 2.2, 1, 1.3);
      if (def.master) { trueSight(); return; }
      setTimeout(() => { location.hash = '#/post/' + def.slug; }, 240);
    });
    return { ...def, el, on: false, phase: i * 1.7 };
  });

  let sightTimer = null;
  function trueSight() {
    document.body.classList.add('sight');
    bloomPulse = 2.4;
    castWave(0, -1.2, 1.6);
    if (!reduced) emitFx(0, -1.2, 1.6, 70, 3.2, 1, 1.5);
    clearTimeout(sightTimer);
    sightTimer = setTimeout(() => document.body.classList.remove('sight'), 4800);
  }

  /* ---------------- 探寻仪式：中央法球搜索 ---------------- */

  const searchRitual = document.getElementById('searchRitual');
  const searchQuestion = document.getElementById('searchQuestion');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  const PLACES = [
    { glyph: '❖', label: '卷轴归档 · 纵览所有手稿', href: '#/archive', keys: '归档 archive 目录 列表 全部 手稿' },
    { glyph: '✦', label: '法师画像 · 关于我', href: '#/about', keys: '关于 about 我 画像 作者 法师' },
    { glyph: '✎', label: '铭刻室 · 撰写新卷轴', href: '#/compose', keys: '写 写作 新文章 铭刻 compose 编辑 发布 上传', admin: true },
  ];

  function toggleSearch() { searchOpen ? closeSearch() : openSearch(); }
  function openSearch() {
    if (pageView.classList.contains('open')) return;
    searchOpen = true;
    document.body.classList.add('search-open');
    searchQuestion.innerHTML = '你在探寻何物'
      .split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('');
    searchInput.value = '';
    renderResults('');
    searchRitual.classList.add('open');
    searchRitual.setAttribute('aria-hidden', 'false');
    setTimeout(() => searchInput.focus(), 90);
    const p = orbGroup.position;
    castWave(p.x, p.y, p.z);
    if (!reduced) emitFx(p.x, p.y, p.z, 40, 1.8, 1, 1.2);
  }
  function closeSearch() {
    if (!searchOpen) return;
    searchOpen = false;
    document.body.classList.remove('search-open');
    searchRitual.classList.remove('open');
    searchRitual.setAttribute('aria-hidden', 'true');
    searchInput.blur();
  }

  function renderResults(q) {
    const ql = q.trim().toLowerCase();
    const posts = ALL_POSTS
      .filter((p) => !ql || (p.title + ' ' + p.tag + ' ' + p.date + ' ' + p.excerpt + ' ' + p.body.replace(/<[^>]+>/g, ' ')).toLowerCase().includes(ql))
      .map((p) => {
        let title = esc(p.title);
        if (ql) {
          const k = p.title.toLowerCase().indexOf(ql);
          if (k >= 0) title = esc(p.title.slice(0, k)) + '<mark>' + esc(p.title.slice(k, k + ql.length)) + '</mark>' + esc(p.title.slice(k + ql.length));
        }
        return `<a class="s-item" style="--i:0" href="#/post/${p.slug}"><span class="s-glyph" aria-hidden="true">${p.glyph}</span><span class="s-title">${title}</span><span class="s-tag">${esc(p.tag)} · ${esc(p.time)}</span></a>`;
      });
    const places = PLACES
      .filter((pl) => (!pl.admin || !!adminKey) && (!ql || (pl.label + ' ' + pl.keys).toLowerCase().includes(ql)))
      .map((pl) => `<a class="s-item s-place" style="--i:0" href="${pl.href}"><span class="s-glyph" aria-hidden="true">${pl.glyph}</span><span class="s-title">${pl.label}</span><span class="s-tag">之地</span></a>`);
    const html = [...posts, ...places];
    searchResults.innerHTML = html.length
      ? html.join('')
      : '<p class="s-empty">星海无回应 —— 换一句咒语试试。</p>';
    // 依序浮现
    searchResults.querySelectorAll('.s-item').forEach((el, i) => el.style.setProperty('--i', i));
  }
  searchInput.addEventListener('input', () => renderResults(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = searchResults.querySelector('.s-item');
    if (first) { closeSearch(); location.hash = first.getAttribute('href').slice(1); }
  });
  searchRitual.querySelector('.search-backdrop').addEventListener('click', closeSearch);

  // 键盘：Esc 退出页面/仪式；斜杠唤起探寻
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchOpen) closeSearch();
      else if (pageView.classList.contains('open')) location.hash = '#/';
    } else if (e.key === '/' && !searchOpen && !pageView.classList.contains('open')) {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); openSearch(); }
    }
  });

  /* ---------------- 法阵导航 ---------------- */

  const ritualNav = document.getElementById('ritualNav');
  const navOrb = document.getElementById('navOrb');
  navOrb.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = ritualNav.classList.toggle('open');
    navOrb.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (item.classList.contains('nav-archive')) {
        location.hash = '#/archive';
      } else if (item.classList.contains('nav-compose')) {
        location.hash = '#/compose';
      } else {
        document.getElementById(item.dataset.target)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      }
      ritualNav.classList.remove('open');
      navOrb.setAttribute('aria-expanded', 'false');
    });
  });
  addEventListener('click', (e) => {
    if (ritualNav.classList.contains('open') && !ritualNav.contains(e.target)) {
      ritualNav.classList.remove('open');
      navOrb.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------------- 自定义光标 ---------------- */

  if (finePointer) {
    document.body.classList.add('has-cursor');
    const dot = document.getElementById('cursorDot');
    const ringEl = document.getElementById('cursorRing');
    let cx = innerWidth / 2, cy = innerHeight / 2;
    let dx = cx, dy = cy, rx = cx, ry = cy;
    addEventListener('pointermove', (e) => { cx = e.clientX; cy = e.clientY; }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      if (e.target instanceof Element && e.target.closest('a, button, .card')) ringEl.classList.add('hover');
      else ringEl.classList.remove('hover');
    });

    (function cursorLoop() {
      requestAnimationFrame(cursorLoop);
      dx += (cx - dx) * 0.55;
      dy += (cy - dy) * 0.55;
      rx += (cx - rx) * 0.16;
      ry += (cy - ry) * 0.16;
      dot.style.transform = `translate(${dx}px, ${dy}px)`;
      ringEl.style.transform = `translate(${rx}px, ${ry}px)`;
    })();
  }

  /* ---------------- 启动 ---------------- */

  route();        // 支持 #/post/... 直达链接
  animate();
}
