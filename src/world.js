import * as THREE from 'three';
import { toon, glowSprite, glowTexture, mulberry32, smoothstep, clamp } from './look.js';

export const WORLD_RADIUS = 96;
export const WATER_Y = 0;
export const SPAWN = new THREE.Vector3(0, 0, 32);
export const STATUE_POS = new THREE.Vector3(-6, 0, 35);
export const NPC_POS = new THREE.Vector3(6, 0, 26);
export const CHEST_POS = new THREE.Vector3(-32, 0, -28);
export const BOSS_POS = new THREE.Vector3(-28, 0, -22);
export const WISP_SPOTS = [
  new THREE.Vector3(24, 0, 8),
  new THREE.Vector3(-20, 0, 2),
  new THREE.Vector3(14, 0, -18),
];

export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  const inland = 1 - smoothstep(WORLD_RADIUS * 0.55, WORLD_RADIUS * 1.08, d);
  let y = -7.5 + 13 * inland;
  const n =
    Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.055 - 0.7) * 2.2 +
    Math.sin(x * 0.12 - 0.4) * Math.cos(z * 0.1 + 2.1) * 0.8 +
    Math.sin((x + z) * 0.033 + 0.8) * 1.4;
  y += n * inland;
  y += 24 * Math.exp(-(((x + 34) ** 2 + (z + 28) ** 2) / 950)) * inland;
  y += 12 * Math.exp(-(((x - 38) ** 2 + (z + 30) ** 2) / 850)) * inland;
  y += 5 * Math.exp(-(((x - 34) ** 2 + (z - 22) ** 2) / 600)) * inland;
  y -= 9 * Math.exp(-(((x - 6) ** 2 + (z - 68) ** 2) / 650));

  // Open valley between the village and the northern peaks.
  y -= 5.5 * Math.exp(-((x * x + (z + 2) ** 2) / 700)) * inland;

  // A broad, gently raised village clearing.
  const village = 1 - smoothstep(20, 38, Math.hypot(x, z - 32));
  y = THREE.MathUtils.lerp(y, 5.2, village * 0.92);

  if (y > 0 && y < 1.8) y = 1.8 - (1.8 - y) * 0.55;
  return y;
}

export function slopeAt(x, z) {
  const e = 1.2;
  const dx = heightAt(x + e, z) - heightAt(x - e, z);
  const dz = heightAt(x, z + e) - heightAt(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function makeSky(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#3f8fc4') },
        midColor: { value: new THREE.Color('#a8d8e6') },
        horizonColor: { value: new THREE.Color('#ffe3b9') },
        bottomColor: { value: new THREE.Color('#cfe2e2') },
        sunDir: { value: new THREE.Vector3(-0.52, 0.55, 0.42).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor, midColor, horizonColor, bottomColor, sunDir;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
          col = mix(col, topColor, smoothstep(0.18, 0.8, h));
          col = mix(bottomColor, col, smoothstep(-0.35, 0.02, h));
          float sun = max(dot(vDir, sunDir), 0.0);
          col += vec3(1.0, 0.82, 0.55) * pow(sun, 220.0) * 1.4;
          col += vec3(1.0, 0.78, 0.5) * pow(sun, 9.0) * 0.22;
          col += vec3(1.0, 0.9, 0.7) * pow(sun, 2.0) * 0.06;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function makeClouds(scene, rng, quality) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: '#fff6e6',
    transparent: true,
    opacity: 0.78,
    fog: true,
    depthWrite: false,
  });
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const count = quality === 'low' ? 14 : 26;
  for (let i = 0; i < count; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(blobGeo, mat);
      puff.position.set((rng() - 0.5) * 18, (rng() - 0.5) * 4, (rng() - 0.5) * 8);
      const s = 4 + rng() * 6;
      puff.scale.set(s, s * 0.5, s * 0.8);
      cloud.add(puff);
    }
    const angle = rng() * Math.PI * 2;
    const radius = 150 + rng() * 190;
    cloud.position.set(Math.cos(angle) * radius, 48 + rng() * 58, Math.sin(angle) * radius);
    cloud.userData.speed = 0.0012 + rng() * 0.0018;
    group.add(cloud);
  }
  scene.add(group);
  return group;
}

function makeFloatingIslands(scene, rng) {
  const group = new THREE.Group();
  const rockMat = toon('#7c8478');
  const grassMat = toon('#6f9f58');
  const positions = [
    [-118, 34, -150, 17],
    [155, 46, -110, 23],
    [110, 28, 160, 13],
  ];
  for (const [x, y, z, s] of positions) {
    const island = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.92, 0.5, 9), grassMat);
    top.scale.set(s, s * 0.22, s * 0.82);
    island.add(top);
    const body = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 9), rockMat);
    body.rotation.x = Math.PI;
    body.position.y = -s * 0.55;
    body.scale.set(s * 0.96, s * 1.05, s * 0.78);
    island.add(body);
    const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), toon('#4f8b52'));
    tree.position.set(s * 0.18, s * 0.55, 0);
    tree.scale.set(s * 0.18, s * 0.24, s * 0.18);
    island.add(tree);
    island.position.set(x, y, z);
    island.userData.phase = rng() * 6.28;
    group.add(island);
  }
  scene.add(group);
  return group;
}

function makeGroundTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e9dd';
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(7441);
  for (let i = 0; i < 620; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1.5 + rng() * 12;
    const dark = rng() > 0.45;
    ctx.fillStyle = dark
      ? `rgba(76, 102, 62, ${0.025 + rng() * 0.055})`
      : `rgba(255, 252, 232, ${0.03 + rng() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.35 + rng() * 0.8), rng() * 3.14, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 90; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.strokeStyle = `rgba(70, 92, 58, ${0.03 + rng() * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 16);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(26, 26);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeTerrain(scene, quality) {
  const segments = quality === 'low' ? 110 : 168;
  const size = 232;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const color = new THREE.Color();
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#ddc99a');
  const wetSand = new THREE.Color('#a8a17e');
  const grass = new THREE.Color('#6a9951');
  const grassDark = new THREE.Color('#4a7542');
  const rock = new THREE.Color('#888678');
  const highRock = new THREE.Color('#c0b8a4');
  const rng = mulberry32(9127);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const slope = slopeAt(x, z);
    const noise = Math.sin(x * 0.31 + z * 0.27) * 0.5 + Math.sin(x * 0.07 - z * 0.11) * 0.5;
    if (y < 0.35) {
      color.copy(wetSand).lerp(sand, clamp((y + 1.5) / 1.8, 0, 1));
    } else if (y < 2.1) {
      color.copy(sand).lerp(grass, smoothstep(1.1, 2.1, y) * 0.6);
    } else {
      color.copy(grass).lerp(grassDark, clamp(noise * 0.5 + 0.4, 0, 1) * 0.62);
      color.lerp(highRock, smoothstep(18, 31, y) * 0.75);
      if (slope > 0.55) color.lerp(rock, clamp((slope - 0.55) * 1.5, 0, 0.9));
    }
    const v = 1 + (rng() - 0.5) * 0.12;
    colors[i * 3] = color.r * v;
    colors[i * 3 + 1] = color.g * v;
    colors[i * 3 + 2] = color.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    toon('#ffffff', { vertexColors: true, map: makeGroundTexture() })
  );
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeWater(scene) {
  const geo = new THREE.PlaneGeometry(520, 520, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      deepColor: { value: new THREE.Color('#1f6c78') },
      shallowColor: { value: new THREE.Color('#6fc5c6') },
      sunDir: { value: new THREE.Vector3(-0.52, 0.55, 0.42).normalize() },
    },
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    fog: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float time;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        float w = sin(p.x * 0.14 + time * 1.25) * 0.24
                + sin(p.z * 0.19 - time * 1.55) * 0.18
                + sin((p.x + p.z) * 0.062 + time * 0.72) * 0.3;
        p.y += w;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(vec3(
          sin(p.x * 0.14 + time * 1.25) * 0.16,
          1.0,
          cos(p.z * 0.19 - time * 1.55) * 0.14
        ));
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 deepColor, shallowColor, sunDir;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      #include <fog_pars_fragment>
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
        vec3 col = mix(deepColor, shallowColor, fres * 0.78 + 0.12);
        float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 110.0);
        col += vec3(1.0, 0.86, 0.62) * spec * 1.6;
        float sparkle = pow(max(0.0, sin(vWorld.x * 2.6 + time * 2.3) * sin(vWorld.z * 2.1 - time * 1.7)), 26.0);
        col += vec3(0.72, 0.95, 1.0) * sparkle * 0.55;
        gl_FragColor = vec4(col, mix(0.68, 0.94, fres));
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WATER_Y;
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
}

function makeShoreFoam(scene, rng) {
  const points = [];
  for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x += 2.2) {
    for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z += 2.2) {
      const h = heightAt(x, z);
      if (h > 0.02 && h < 0.26 && rng() > 0.55) points.push([x, z]);
    }
  }
  const geo = new THREE.CircleGeometry(0.72, 6);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: '#eafff9',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  const dummy = new THREE.Object3D();
  points.forEach(([x, z], i) => {
    dummy.position.set(x + (rng() - 0.5) * 1.6, 0.1, z + (rng() - 0.5) * 1.6);
    dummy.rotation.y = rng() * Math.PI;
    dummy.scale.set(0.6 + rng() * 1.3, 1, 0.35 + rng() * 0.8);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.renderOrder = 3;
  scene.add(mesh);
  return mesh;
}

function makeTreeField(scene, rng, quality) {
  const count = quality === 'low' ? 116 : 172;
  const positions = [];
  for (let i = 0; i < count * 10 && positions.length < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 10 + Math.sqrt(rng()) * 74;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = heightAt(x, z);
    if (h < 1.8 || slopeAt(x, z) > 0.58) continue;
    if (Math.hypot(x, z - 32) < 21) continue;
    if (Math.hypot(x - 6, z - 26) < 9) continue;
    if (Math.hypot(x + 6, z - 35) < 8) continue;
    if (Math.hypot(x + 32, z + 28) < 8) continue;
    if (positions.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < 20)) continue;
    positions.push([x, z]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.32, 2.4, 5);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMat = toon('#6b4a35');
  const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
  trunk.castShadow = quality !== 'low';
  trunk.receiveShadow = true;

  const layers = [
    { geo: new THREE.IcosahedronGeometry(1.55, 0), y: 2.95, colors: ['#5f9c57', '#6faa5e', '#4f8b50'] },
    { geo: new THREE.IcosahedronGeometry(1.12, 0), y: 3.95, colors: ['#71ad60', '#7fba68', '#5c9b54'] },
    { geo: new THREE.IcosahedronGeometry(0.7, 0), y: 4.85, colors: ['#84c170', '#8fca78', '#6eac60'] },
  ];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const foliageMeshes = [];
  const scales = [];

  const shadowGeo = new THREE.CircleGeometry(1, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: '#14301d',
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const shadowMesh = new THREE.InstancedMesh(shadowGeo, shadowMat, positions.length);
  shadowMesh.renderOrder = 1;

  const foliageMat = toon('#ffffff', { vertexColors: false });
  const windUniform = { value: 0 };
  foliageMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniform;
    shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iOrigin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float sway = sin(uWindTime * 1.25 + iOrigin.x * 0.42 + iOrigin.z * 0.31) * 0.075 * max(position.y, 0.0);
          transformed.x += sway;
          transformed.z += sway * 0.55;
        #endif
      `
    );
  };
  foliageMat.customProgramCacheKey = () => 'aetheria-foliage-wind';

  positions.forEach(([x, z], i) => {
    scales[i] = 0.88 + rng() * 0.78;
  });

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex];
    const mesh = new THREE.InstancedMesh(layer.geo, foliageMat, positions.length);
    mesh.castShadow = quality !== 'low';
    mesh.receiveShadow = true;
    positions.forEach(([x, z], i) => {
      const h = heightAt(x, z);
      const s = scales[i];
      dummy.position.set(x, h - 0.2, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.9 + rng() * 0.3), s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(layer.colors[Math.floor(rng() * layer.colors.length)]);
      mesh.setColorAt(i, color);
      if (layerIndex === 0) {
        dummy.position.set(x, h - 0.2, z);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, h + 0.04, z);
        dummy.scale.set(1.7 * s, 1, 1.3 * s);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(i, dummy.matrix);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    foliageMeshes.push(mesh);
  }
  trunk.instanceMatrix.needsUpdate = true;
  shadowMesh.instanceMatrix.needsUpdate = true;
  scene.add(trunk);
  scene.add(shadowMesh);

  return { foliageMat, windUniform };
}

function makeRocks(scene, rng, quality) {
  const count = quality === 'low' ? 42 : 72;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = toon('#8e8d7f');
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const palette = [new THREE.Color('#8d8c7d'), new THREE.Color('#a3a090'), new THREE.Color('#797b70')];
  let placed = 0;
  for (let i = 0; i < count * 10 && placed < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 8 + Math.sqrt(rng()) * 79;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = heightAt(x, z);
    if (h < 0.4) continue;
    if (Math.hypot(x, z - 28) < 8) continue;
    if (Math.hypot(x, z - 32) < 18) continue;
    const s = 0.4 + rng() * 1.9;
    dummy.position.set(x, h + s * 0.25, z);
    dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    dummy.scale.set(s, s * (0.6 + rng() * 0.7), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    mesh.setColorAt(placed, palette[Math.floor(rng() * palette.length)]);
    placed++;
  }
  mesh.count = placed;
  mesh.castShadow = quality !== 'low';
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function makeGrassAndFlowers(scene, rng, quality) {
  const grassCount = quality === 'low' ? 1900 : 3400;
  const bladeGeo = new THREE.ConeGeometry(0.055, 0.62, 3);
  bladeGeo.translate(0, 0.31, 0);
  const grassMat = toon('#7fae5f', { side: THREE.DoubleSide });
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, grassCount);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = ['#7cae5c', '#8bbd66', '#6a9c53', '#96c674'];
  let placed = 0;
  for (let i = 0; i < grassCount * 6 && placed < grassCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 5 + Math.sqrt(rng()) * 80;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = heightAt(x, z);
    if (h < 1.5 || slopeAt(x, z) > 0.55) continue;
    const s = 0.7 + rng() * 1.1;
    dummy.position.set(x, h - 0.05, z);
    dummy.rotation.set((rng() - 0.5) * 0.25, rng() * 6.28, (rng() - 0.5) * 0.25);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grass.setMatrixAt(placed, dummy.matrix);
    grass.setColorAt(placed, color.set(palette[Math.floor(rng() * palette.length)]));
    placed++;
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  grass.instanceColor.needsUpdate = true;
  scene.add(grass);

  const flowerCount = quality === 'low' ? 70 : 180;
  const flowerGeo = new THREE.IcosahedronGeometry(0.085, 0);
  const flowerMat = toon('#ffe6a3');
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const flowerPalette = ['#ffe6a3', '#ffc0d4', '#e8f5ff', '#ffd27f'];
  let f = 0;
  for (let i = 0; i < flowerCount * 8 && f < flowerCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 6 + Math.sqrt(rng()) * 70;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = heightAt(x, z);
    if (h < 1.7 || slopeAt(x, z) > 0.45) continue;
    dummy.position.set(x, h + 0.34, z);
    dummy.rotation.set(0, rng() * 6.28, 0);
    const s = 0.8 + rng() * 1.3;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    flowers.setMatrixAt(f, dummy.matrix);
    flowers.setColorAt(f, color.set(flowerPalette[Math.floor(rng() * flowerPalette.length)]));
    f++;
  }
  flowers.count = f;
  flowers.instanceMatrix.needsUpdate = true;
  flowers.instanceColor.needsUpdate = true;
  scene.add(flowers);
  return grass;
}

function createHut(x, z, rotation, scale = 1) {
  const group = new THREE.Group();
  const plaster = toon('#d7c6a2');
  const plasterDark = toon('#c2ad86');
  const wood = toon('#5f4431');
  const woodLight = toon('#7a5a3e');
  const roofMat = toon('#a94e37');
  const roofDark = toon('#84382a');
  const stone = toon('#99968a');
  const dark = toon('#2f2a26');
  const glow = new THREE.MeshBasicMaterial({ color: '#ffd58f' });

  const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.5, 4.3), stone);
  foundation.position.y = 0.25;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.45, 3.6), plaster);
  walls.position.y = 1.55;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(4.28, 0.24, 3.68), wood);
  upper.position.y = 2.8;
  group.add(upper);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.17, 2.6, 0.17), wood);
      beam.position.set(sx * 2.06, 1.55, sz * 1.76);
      group.add(beam);
    }
  }
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.14), wood);
  crossBeam.position.set(0, 2.35, 1.84);
  group.add(crossBeam);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.35, 1.95, 4), roofMat);
  roof.position.y = 3.72;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.22, 1, 1.06);
  roof.castShadow = true;
  group.add(roof);

  const roofRidge = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.12, 0.12), roofDark);
  roofRidge.position.y = 4.66;
  roofRidge.rotation.y = Math.PI / 4;
  group.add(roofRidge);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.72, 0.12), dark);
  door.position.set(0, 1.1, 1.83);
  group.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.14, 0.18), woodLight);
  doorFrame.position.set(0, 1.98, 1.82);
  group.add(doorFrame);
  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.18), woodLight);
    jamb.position.set(sx * 0.56, 1.1, 1.82);
    group.add(jamb);
  }

  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.72, 0.1), wood);
  windowFrame.position.set(1.35, 1.72, 1.82);
  group.add(windowFrame);
  const windowGlow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.54, 0.06), glow);
  windowGlow.position.set(1.35, 1.72, 1.86);
  group.add(windowGlow);

  const sideWindow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.54, 0.6), glow);
  sideWindow.position.set(-2.14, 1.72, -0.4);
  group.add(sideWindow);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.5, 0.46), stone);
  chimney.position.set(1.16, 3.75, -1.15);
  chimney.castShadow = true;
  group.add(chimney);
  const chimneyTop = glowSprite('#ffc98c', 1.4, 0.35);
  chimneyTop.position.set(1.16, 4.65, -1.15);
  group.add(chimneyTop);

  const lantern = glowSprite('#ffcf8f', 1.5, 0.65);
  lantern.position.set(-0.95, 1.9, 1.98);
  group.add(lantern);
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 5), wood);
  lanternPost.position.set(-0.95, 1.55, 1.9);
  group.add(lanternPost);

  group.position.set(x, heightAt(x, z), z);
  group.rotation.y = rotation;
  group.scale.setScalar(scale);
  group.userData = { chimneyTop, lantern, phase: Math.random() * 6.28 };
  return group;
}

function createCampfire(x, z) {
  const group = new THREE.Group();
  const stone = toon('#8d897c');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.7 + Math.random() * 0.18;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stone);
    rock.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    rock.rotation.set(Math.random() * 2, Math.random() * 2, 0);
    rock.scale.set(1, 0.7, 1);
    group.add(rock);
  }
  const woodMat = toon('#5b3f2c');
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 5), woodMat);
    log.position.y = 0.16;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    group.add(log);
  }

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.85, 6),
    new THREE.MeshBasicMaterial({ color: '#ff9b3c', transparent: true, opacity: 0.92 })
  );
  flame.position.y = 0.55;
  group.add(flame);
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.55, 5),
    new THREE.MeshBasicMaterial({ color: '#ffe19a' })
  );
  inner.position.y = 0.48;
  group.add(inner);
  const halo = glowSprite('#ff9a4d', 3.2, 0.55);
  halo.position.y = 0.55;
  group.add(halo);
  const light = new THREE.PointLight('#ff9a4d', 8, 12, 2);
  light.position.y = 1.0;
  group.add(light);

  group.position.set(x, heightAt(x, z), z);
  group.userData = { flame, inner, halo, light, phase: Math.random() * 6.28 };
  return group;
}

function createPath(scene, rng) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 48),
    new THREE.Vector3(1.5, 0, 41),
    new THREE.Vector3(0.5, 0, 34),
    new THREE.Vector3(3.5, 0, 28),
    new THREE.Vector3(1.5, 0, 21),
    new THREE.Vector3(-2, 0, 13),
    new THREE.Vector3(-6, 0, 4),
  ]);
  const points = curve.getSpacedPoints(70);
  const geo = new THREE.CylinderGeometry(0.34, 0.38, 0.06, 6);
  const mat = toon('#a9a291');
  const mesh = new THREE.InstancedMesh(geo, mat, points.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = ['#aaa38f', '#9a9484', '#b7b09d'];
  points.forEach((p, i) => {
    const x = p.x + (rng() - 0.5) * 0.55;
    const z = p.z + (rng() - 0.5) * 0.55;
    dummy.position.set(x, heightAt(x, z) + 0.03, z);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    const s = 0.6 + rng() * 0.55;
    dummy.scale.set(s, 1, s * 0.8);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(palette[Math.floor(rng() * palette.length)]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createFenceSegment(x1, z1, x2, z2) {
  const group = new THREE.Group();
  const wood = toon('#6b4c35');
  const count = 5;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 1.15, 5), wood);
    post.position.set(x, heightAt(x, z) + 0.55, z);
    post.castShadow = true;
    group.add(post);
  }
  for (const h of [0.38, 0.82]) {
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), wood);
    rail.position.set(mx, heightAt(mx, mz) + h, mz);
    rail.rotation.y = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
    group.add(rail);
  }
  return group;
}

function createVillage(scene, rng) {
  const huts = [
    createHut(-15, 39, 0.7),
    createHut(15, 39, -2.35),
    createHut(-16, 23, 2.55),
    createHut(14, 22, 3.65),
  ];
  huts.forEach((hut) => scene.add(hut));

  const fire = createCampfire(-4.2, 28.2);
  scene.add(fire);

  createPath(scene, rng);
  scene.add(createFenceSegment(-19, 34, -13, 34));
  scene.add(createFenceSegment(11, 34, 19, 35));
  scene.add(createFenceSegment(-19, 20, -13, 19));

  // Simple benches around the fire.
  const benchMat = toon('#6d4d33');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const bx = -4.2 + Math.cos(a) * 2.2;
    const bz = 28.2 + Math.sin(a) * 2.2;
    const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.25, 6), benchMat);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = -a;
    bench.position.set(bx, heightAt(bx, bz) + 0.22, bz);
    bench.castShadow = true;
    scene.add(bench);
  }

  return { fire, huts };
}

/* ---------------- Points of interest ---------------- */

function createWisp(index) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    new THREE.MeshBasicMaterial({ color: '#c9fff4' })
  );
  core.name = 'core';
  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.025, 6, 32),
    new THREE.MeshBasicMaterial({ color: '#8cf0dd', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const halo = glowSprite('#8cf0dd', 3.6, 0.9);
  group.add(halo);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.42, 9, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#8cf0dd',
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beam.position.y = 4.5;
  group.add(beam);

  const spot = WISP_SPOTS[index];
  group.position.set(spot.x, heightAt(spot.x, spot.z) + 1.5, spot.z);
  group.userData = { baseY: group.position.y, phase: index * 2.1, collected: false, index, ring, core, halo };
  return group;
}

function createNPC(x, z) {
  const group = new THREE.Group();
  const skin = toon('#e8bf9b');
  const robe = toon('#34536b');
  const robeLight = toon('#4d7186');
  const gold = toon('#d9ba74');
  const dark = toon('#27343c');

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 1.25, 7), robe);
  body.position.y = 0.72;
  body.castShadow = true;
  group.add(body);

  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.36, 3, 8), robeLight);
  chest.position.y = 1.34;
  chest.castShadow = true;
  group.add(chest);

  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.055, 5, 16), gold);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 1.06;
  group.add(sash);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, 9), toon('#c5a465'));
  hat.position.y = 1.98;
  hat.castShadow = true;
  group.add(hat);

  const hatTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), gold);
  hatTip.position.y = 2.12;
  group.add(hatTip);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 3, 6), robe);
    arm.position.set(side * 0.34, 1.3, 0.02);
    arm.rotation.z = side * 0.28;
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 6), skin);
    hand.position.set(side * 0.42, 1.02, 0.04);
    group.add(hand);
  }

  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 1.9, 5), dark);
  staff.position.set(0.52, 1.05, 0.1);
  staff.rotation.z = -0.08;
  group.add(staff);
  const staffTip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.12, 0),
    new THREE.MeshBasicMaterial({ color: '#f3d998' })
  );
  staffTip.position.set(0.6, 2.0, 0.1);
  group.add(staffTip);
  const staffGlow = glowSprite('#f3d998', 0.9, 0.7);
  staffGlow.position.copy(staffTip.position);
  group.add(staffGlow);

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 6), toon('#d8d8d0'));
  beard.position.set(0, 1.63, 0.16);
  beard.rotation.x = 0.3;
  group.add(beard);

  group.position.set(x, heightAt(x, z), z);
  group.rotation.y = -0.6;
  group.userData = { staffTip, staffGlow, phase: 1.2 };
  return group;
}

function createChest(x, z) {
  const root = new THREE.Group();
  const wood = toon('#5e3f2a');
  const woodLight = toon('#7e5738');
  const gold = toon('#d8b56b');
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe4a3' });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.62, 0.82), wood);
  base.position.y = 0.31;
  base.castShadow = true;
  root.add(base);

  for (const xPos of [-0.45, 0.45]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.64, 0.86), gold);
    band.position.set(xPos, 0.31, 0);
    root.add(band);
  }

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.62, -0.41);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 1.25, 10, 1, false, 0, Math.PI), woodLight);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.set(0, 0, 0.41);
  lid.castShadow = true;
  lidPivot.add(lid);
  const lidBand = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.045, 5, 12, Math.PI), gold);
  lidBand.rotation.y = -Math.PI / 2;
  lidBand.position.set(0, 0, 0.41);
  lidPivot.add(lidBand);
  root.add(lidPivot);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.08), gold);
  lock.position.set(0, 0.46, 0.44);
  root.add(lock);

  const halo = glowSprite('#ffe0a0', 2.6, 0.6);
  halo.position.y = 0.65;
  root.add(halo);

  const rune = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.02, 40),
    new THREE.MeshBasicMaterial({
      color: '#f3d998',
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.05;
  root.add(rune);

  root.position.set(x, heightAt(x, z), z);
  root.rotation.y = 0.7;
  root.userData = { lidPivot, halo, rune, open: false, openT: 0 };
  return root;
}

function createStatue(x, z) {
  const group = new THREE.Group();
  const stone = toon('#b9b6a8');
  const stoneDark = toon('#8d8d80');
  const gold = toon('#e2c87e');

  const steps = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 0.55, 8), stoneDark);
  steps.position.y = 0.26;
  steps.receiveShadow = true;
  group.add(steps);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 0.6, 8), stone);
  base.position.y = 0.8;
  base.castShadow = true;
  group.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.62, 3.4, 7), stone);
  pillar.position.y = 2.7;
  pillar.castShadow = true;
  group.add(pillar);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.1, 5, 16), gold);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 4.2;
  group.add(collar);

  const wings = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.07, 5, 30, Math.PI * 1.25),
    gold
  );
  wings.position.y = 4.4;
  wings.rotation.x = Math.PI / 2.3;
  group.add(wings);

  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshBasicMaterial({ color: '#b8fff1', transparent: true, opacity: 0.95 })
  );
  crystal.position.y = 4.85;
  group.add(crystal);

  const halo = glowSprite('#8cf0dd', 5.5, 0.85);
  halo.position.y = 4.85;
  group.add(halo);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.022, 5, 48),
    new THREE.MeshBasicMaterial({ color: '#8cf0dd', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.position.y = 4.85;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const light = new THREE.PointLight('#8ff5e2', 14, 16, 2);
  light.position.y = 4.8;
  group.add(light);

  group.position.set(x, heightAt(x, z), z);
  group.userData = { crystal, ring, halo, light, phase: 0 };
  return group;
}

/* ---------------- World assembly ---------------- */

export function createWorld(scene, { quality = 'high' } = {}) {
  const rng = mulberry32(20260317);
  const objects = new THREE.Group();
  objects.name = 'world';
  scene.add(objects);

  scene.fog = new THREE.Fog('#cfe7ea', 105, 330);

  const hemi = new THREE.HemisphereLight('#cfeaff', '#4c5c40', 1.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6bb', 2.65);
  sun.position.set(-62, 88, 46);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 230;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight('#a9d9ff', 0.55);
  fill.position.set(45, 30, -60);
  scene.add(fill);

  const sky = makeSky(scene);
  const clouds = makeClouds(scene, rng, quality);
  const floating = makeFloatingIslands(scene, rng);
  const terrain = makeTerrain(scene, quality);
  const water = makeWater(scene);
  const foam = makeShoreFoam(scene, rng);
  const { windUniform } = makeTreeField(scene, rng, quality);
  makeRocks(scene, rng, quality);
  makeGrassAndFlowers(scene, rng, quality);
  const village = createVillage(objects, rng);

  const statue = createStatue(STATUE_POS.x, STATUE_POS.z);
  statue.position.y = heightAt(STATUE_POS.x, STATUE_POS.z);
  objects.add(statue);

  const npc = createNPC(NPC_POS.x, NPC_POS.z);
  npc.position.y = heightAt(NPC_POS.x, NPC_POS.z);
  objects.add(npc);

  const chest = createChest(CHEST_POS.x, CHEST_POS.z);
  chest.position.y = heightAt(CHEST_POS.x, CHEST_POS.z);
  objects.add(chest);

  const wisps = WISP_SPOTS.map((_, i) => {
    const wisp = createWisp(i);
    objects.add(wisp);
    return wisp;
  });

  // A few wind-bent banners near the village give the spawn a lived-in feel.
  const bannerMat = toon('#d9c38d', { side: THREE.DoubleSide });
  const poleMat = toon('#65503c');
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    const x = Math.cos(angle) * 11;
    const z = 32 + Math.sin(angle) * 11;
    const h = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 5), poleMat);
    pole.position.set(x, h + 1.4, z);
    pole.castShadow = true;
    objects.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5, 4, 2), bannerMat);
    flag.position.set(x + 0.48, h + 2.05, z);
    flag.rotation.y = angle;
    objects.add(flag);
    const lamp = glowSprite('#ffd58f', 1.1, 0.55);
    lamp.position.set(x, h + 2.85, z);
    objects.add(lamp);
  }

  const timeUniform = { value: 0 };
  const tmp = new THREE.Vector3();

  function update(dt, elapsed, playerPos) {
    timeUniform.value = elapsed;
    windUniform.value = elapsed;
    water.material.uniforms.time.value = elapsed;
    clouds.rotation.y += dt * 0.0045;
    floating.children.forEach((island) => {
      island.position.y += Math.sin(elapsed * 0.45 + island.userData.phase) * dt * 0.35;
      island.rotation.y += dt * 0.012;
    });

    statue.userData.crystal.rotation.y += dt * 0.8;
    statue.userData.crystal.position.y = 4.85 + Math.sin(elapsed * 1.4) * 0.12;
    statue.userData.ring.rotation.z += dt * 0.6;
    statue.userData.ring.rotation.x = Math.PI / 2 + Math.sin(elapsed * 0.7) * 0.18;
    statue.userData.light.intensity = 13 + Math.sin(elapsed * 2.2) * 3;

    if (village?.fire) {
      const fire = village.fire.userData;
      const flicker = 0.9 + Math.sin(elapsed * 13 + fire.phase) * 0.1 + Math.sin(elapsed * 23.7) * 0.05;
      fire.flame.scale.set(0.9 + flicker * 0.12, flicker * 1.1, 0.9 + flicker * 0.12);
      fire.inner.scale.setScalar(0.85 + Math.sin(elapsed * 17) * 0.12);
      fire.inner.position.y = 0.46 + Math.sin(elapsed * 9) * 0.04;
      fire.light.intensity = 6.5 + Math.sin(elapsed * 12.7) * 1.8 + Math.sin(elapsed * 27.1) * 0.7;
      fire.halo.material.opacity = 0.42 + Math.sin(elapsed * 10.5) * 0.1;
    }
    if (village?.huts) {
      village.huts.forEach((hut, i) => {
        hut.userData.lantern.material.opacity = 0.5 + Math.sin(elapsed * 2.2 + i * 1.4) * 0.12;
        hut.userData.chimneyTop.material.opacity = 0.22 + Math.sin(elapsed * 1.7 + i) * 0.07;
      });
    }

    npc.userData.staffTip.rotation.y += dt * 1.4;
    npc.userData.staffGlow.material.opacity = 0.5 + Math.sin(elapsed * 2.1) * 0.2;

    chest.userData.rune.rotation.z += dt * 0.25;
    chest.userData.halo.material.opacity = 0.42 + Math.sin(elapsed * 2) * 0.12;
    if (chest.userData.open) {
      chest.userData.openT = Math.min(1, chest.userData.openT + dt * 1.2);
      const t = chest.userData.openT;
      chest.userData.lidPivot.rotation.x = -1.35 * (1 - Math.pow(1 - t, 3));
      chest.userData.halo.material.opacity = 0.8 * (1 - t * 0.4);
      chest.userData.rune.material.opacity = 0.6 * (1 - t);
    }

    wisps.forEach((wisp) => {
      const data = wisp.userData;
      if (data.collected) return;
      wisp.position.y = data.baseY + Math.sin(elapsed * 1.8 + data.phase) * 0.28;
      wisp.rotation.y += dt * 0.9;
      data.ring.rotation.z += dt * 1.3;
      data.core.rotation.y -= dt * 1.6;
      const pulse = 1 + Math.sin(elapsed * 2.4 + data.phase) * 0.12;
      data.halo.scale.setScalar(3.6 * pulse);
    });

    // Sun glow follows the camera-facing sky, so keep the sky centred on the player.
    if (playerPos) {
      sky.position.set(playerPos.x, 0, playerPos.z);
      sun.position.set(playerPos.x - 62, 88, playerPos.z + 46);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      sun.target.updateMatrixWorld();
    }
  }

  function collectWisp(index) {
    const wisp = wisps[index];
    if (!wisp || wisp.userData.collected) return null;
    wisp.userData.collected = true;
    wisp.visible = false;
    return wisp.position.clone();
  }

  function openChest() {
    chest.userData.open = true;
    return chest.position.clone();
  }

  function chestOpened() {
    return chest.userData.open;
  }

  return {
    group: objects,
    terrain,
    water,
    foam,
    sky,
    sun,
    statue,
    npc,
    chest,
    wisps,
    update,
    collectWisp,
    openChest,
    chestOpened,
    heightAt,
    slopeAt,
  };
}
