import * as THREE from 'three';
import { glowSprite, clamp } from './look.js';

export const ELEMENT_COLORS = {
  anemo: '#8cf0dd',
  pyro: '#ff9a5c',
  hydro: '#6fc9ff',
  electro: '#c69bff',
  physical: '#fff1cf',
};

const particleVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (340.0 / max(1.0, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;

const particleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float a = smoothstep(0.5, 0.03, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

class Particles {
  constructor(scene, capacity = 700) {
    this.capacity = capacity;
    this.cursor = 0;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.positions[i * 3 + 1] = -999;
      this.sizes[i] = 0;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }

  spawn(position, color, opts = {}) {
    const {
      count = 12,
      speed = 3,
      spread = 1,
      size = 0.3,
      life = 0.7,
      gravity = 7,
      drag = 2.5,
      up = 1.2,
      radius = 0,
    } = opts;
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      this.positions[i * 3] = position.x + Math.cos(angle) * r;
      this.positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * radius * 0.8;
      this.positions[i * 3 + 2] = position.z + Math.sin(angle) * r;
      const sp = speed * (0.35 + Math.random() * 0.95);
      const dir = new THREE.Vector3(
        Math.cos(angle) * spread,
        up + (Math.random() - 0.5) * spread,
        Math.sin(angle) * spread
      ).normalize().multiplyScalar(sp);
      this.velocities[i * 3] = dir.x;
      this.velocities[i * 3 + 1] = dir.y;
      this.velocities[i * 3 + 2] = dir.z;
      const shade = 0.72 + Math.random() * 0.42;
      this.colors[i * 3] = c.r * shade;
      this.colors[i * 3 + 1] = c.g * shade;
      this.colors[i * 3 + 2] = c.b * shade;
      this.baseSize[i] = size * (0.55 + Math.random() * 1.1);
      this.sizes[i] = this.baseSize[i];
      this.alphas[i] = 0.95;
      this.maxLife[i] = life * (0.65 + Math.random() * 0.8);
      this.life[i] = this.maxLife[i];
      this.gravity[i] = gravity;
      this.drag[i] = drag;
    }
  }

  update(dt) {
    const pos = this.positions;
    const vel = this.velocities;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.sizes[i] = 0;
        pos[i * 3 + 1] = -999;
        continue;
      }
      const drag = Math.max(0, 1 - this.drag[i] * dt);
      vel[i * 3] *= drag;
      vel[i * 3 + 1] = vel[i * 3 + 1] * drag - this.gravity[i] * dt;
      vel[i * 3 + 2] *= drag;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alphas[i] = Math.min(1, t * 1.7);
      this.sizes[i] = this.baseSize[i] * (0.45 + t * 0.75);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.particles = new Particles(scene);
    this.effects = [];
    this.damageLayer = document.getElementById('damage-layer');
    this.numbers = [];
    this.projectile = new THREE.Vector3();
  }

  update(dt) {
    this.particles.update(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      const t = 1 - Math.max(0, effect.life) / effect.maxLife;
      effect.update?.(t, dt);
      if (effect.life <= 0) {
        effect.dispose?.();
        this.effects.splice(i, 1);
      }
    }
    this.updateNumbers(dt);
  }

  addEffect(effect) {
    this.effects.push(effect);
    return effect;
  }

  spark(position, element = 'physical', opts = {}) {
    this.particles.spawn(position, ELEMENT_COLORS[element] || element, {
      count: opts.count ?? 14,
      speed: opts.speed ?? 4.4,
      size: opts.size ?? 0.28,
      life: opts.life ?? 0.55,
      gravity: opts.gravity ?? 6,
      up: opts.up ?? 1.1,
      spread: 1.3,
      radius: opts.radius ?? 0.1,
    });
  }

  hit(position, element = 'physical', crit = false) {
    this.spark(position, element, { count: crit ? 24 : 15, speed: crit ? 6 : 4.6, size: 0.3 });
    this.spark(position, '#ffffff', { count: 5, speed: 3, size: 0.16, life: 0.3, gravity: 2 });
  }

  pickup(position, color = '#f3d998') {
    this.particles.spawn(position, color, {
      count: 12,
      speed: 2.2,
      size: 0.26,
      life: 0.9,
      gravity: -1.6,
      up: 1.4,
      radius: 0.25,
    });
  }

  heal(position) {
    this.particles.spawn(position, '#9cf5b3', {
      count: 20,
      speed: 1.6,
      size: 0.3,
      life: 1.4,
      gravity: -2,
      up: 1.8,
      radius: 0.7,
    });
  }

  burst(position, element, count = 70) {
    const color = ELEMENT_COLORS[element] || element;
    this.particles.spawn(position, color, {
      count,
      speed: 9,
      size: 0.42,
      life: 1.1,
      gravity: 2.5,
      up: 0.5,
      radius: 0.5,
    });
    this.particles.spawn(position, '#ffffff', {
      count: Math.floor(count * 0.25),
      speed: 12,
      size: 0.2,
      life: 0.6,
      gravity: 1,
      up: 0.4,
      radius: 0.3,
    });
  }

  slash(position, yaw, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const geo = new THREE.RingGeometry(1.0, 2.05, 32, 1, -0.5, 1.85);
    const arc = new THREE.Mesh(geo, mat);
    arc.rotation.z = 0.4;
    group.add(arc);
    const geo2 = new THREE.RingGeometry(0.8, 1.15, 24, 1, -0.3, 1.5);
    const arc2 = new THREE.Mesh(geo2, mat.clone());
    arc2.material.opacity = 0.5;
    arc2.rotation.z = 0.7;
    group.add(arc2);
    group.position.set(position.x, position.y + 1.15, position.z);
    group.rotation.y = yaw;
    group.scale.setScalar(0.75);
    this.scene.add(group);
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    group.position.addScaledVector(forward, 0.4);

    const effect = {
      life: 0.26,
      maxLife: 0.26,
      update: (t) => {
        group.scale.setScalar(0.78 + t * 0.55);
        group.position.y += 0.35 * (1 - t);
        mat.opacity = 0.9 * (1 - t);
        arc2.material.opacity = 0.55 * (1 - t);
        group.rotation.z = -0.7 * t;
      },
      dispose: () => {
        this.scene.remove(group);
        geo.dispose();
        geo2.dispose();
        mat.dispose();
        arc2.material.dispose();
      },
    };
    this.addEffect(effect);
  }

  shockwave(position, color, radius = 5, opts = {}) {
    const plane = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.66, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(position.x, position.y + (opts.height ?? 0.12), position.z);
    this.scene.add(plane);
    const maxLife = opts.life ?? 0.65;
    const effect = {
      life: maxLife,
      maxLife,
      update: (t) => {
        const s = 1 + t * radius;
        plane.scale.setScalar(s);
        plane.material.opacity = 0.85 * (1 - t) ** 1.4;
      },
      dispose: () => {
        this.scene.remove(plane);
        plane.geometry.dispose();
        plane.material.dispose();
      },
    };
    this.addEffect(effect);
  }

  explosion(position, element, radius = 3.2) {
    const color = ELEMENT_COLORS[element] || element;
    this.shockwave(position, color, radius * 2.1, { life: 0.5 });
    this.particles.spawn(position, color, {
      count: 38,
      speed: radius * 2.4,
      size: 0.38,
      life: 0.85,
      gravity: 4,
      up: 0.7,
      radius: 0.35,
    });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sphere.position.copy(position).add(new THREE.Vector3(0, 0.8, 0));
    this.scene.add(sphere);
    const maxLife = 0.5;
    this.addEffect({
      life: maxLife,
      maxLife,
      update: (t) => {
        sphere.scale.setScalar(1 + t * radius * 1.4);
        sphere.material.opacity = 0.6 * (1 - t) ** 1.5;
      },
      dispose: () => {
        this.scene.remove(sphere);
        sphere.geometry.dispose();
        sphere.material.dispose();
      },
    });
  }

  vortex(position, element = 'anemo', duration = 1.6) {
    const color = ELEMENT_COLORS[element] || element;
    const group = new THREE.Group();
    group.position.copy(position);
    group.position.y += 0.9;
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.7 + i * 0.35, 0.035, 5, 40),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.55 - i * 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.25;
      ring.rotation.z = i * 0.4;
      group.add(ring);
      rings.push(ring);
    }
    const glow = glowSprite(color, 4, 0.5);
    group.add(glow);
    this.scene.add(group);

    const effect = {
      life: duration,
      maxLife: duration,
      update: (t, dt) => {
        group.rotation.y += dt * 5.5;
        rings.forEach((ring, i) => {
          ring.rotation.z += dt * (2.6 + i);
          ring.scale.setScalar(1 + Math.sin(t * 8 + i) * 0.12);
          ring.material.opacity = (0.5 - i * 0.09) * (1 - t * 0.45);
        });
        group.position.y += Math.sin(t * Math.PI) * dt * 0.5;
        if (Math.random() < dt * 40) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.6 + Math.random() * 1.8;
          this.particles.spawn(
            new THREE.Vector3(
              position.x + Math.cos(a) * r,
              position.y + Math.random() * 1.5,
              position.z + Math.sin(a) * r
            ),
            color,
            { count: 1, speed: 1.2, size: 0.22, life: 0.8, gravity: -1.8, up: 2.2, radius: 0 }
          );
        }
      },
      dispose: () => {
        this.scene.remove(group);
        rings.forEach((r) => {
          r.geometry.dispose();
          r.material.dispose();
        });
        glow.material.dispose();
      },
    };
    return this.addEffect(effect);
  }

  pillar(position, color, height = 8, duration = 1.1) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.1, height, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.position.set(position.x, position.y + height / 2, position.z);
    this.scene.add(mesh);
    const effect = {
      life: duration,
      maxLife: duration,
      update: (t) => {
        mesh.scale.set(1 + t * 0.5, 1, 1 + t * 0.5);
        mesh.material.opacity = 0.38 * (1 - t) ** 1.3;
      },
      dispose: () => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      },
    };
    return this.addEffect(effect);
  }

  meteor(from, to, color, duration, onImpact) {
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    ball.add(glowSprite(color, 2.6, 0.9));
    ball.position.copy(from);
    this.scene.add(ball);
    const effect = {
      life: duration,
      maxLife: duration,
      update: (t) => {
        const eased = t * t;
        ball.position.lerpVectors(from, to, eased);
        if (Math.random() < 0.8) {
          this.particles.spawn(ball.position, color, {
            count: 1,
            speed: 0.6,
            size: 0.3,
            life: 0.5,
            gravity: -0.4,
            up: 0.3,
            radius: 0.1,
          });
        }
      },
      dispose: () => {
        this.scene.remove(ball);
        ball.geometry.dispose();
        ball.material.dispose();
        onImpact?.(to);
      },
    };
    return this.addEffect(effect);
  }

  floatText(position, text, opts = {}) {
    const el = document.createElement('div');
    el.className = `dmg${opts.kind ? ` ${opts.kind}` : ''}`;
    el.textContent = text;
    this.damageLayer.appendChild(el);
    this.numbers.push({
      el,
      position: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5)),
      life: 0.95,
      maxLife: 0.95,
      drift: (Math.random() - 0.5) * 20,
    });
  }

  updateNumbers(dt) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const item = this.numbers[i];
      item.life -= dt;
      if (item.life <= 0) {
        item.el.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      this.projectile.copy(item.position).project(this.camera);
      if (this.projectile.z > 1) {
        item.el.style.display = 'none';
        continue;
      }
      item.el.style.display = '';
      const x = (this.projectile.x * 0.5 + 0.5) * w;
      const y = (-this.projectile.y * 0.5 + 0.5) * h;
      item.el.style.left = `${x + item.drift * (1 - item.life / item.maxLife)}px`;
      item.el.style.top = `${y}px`;
    }
  }

  clearNumbers() {
    for (const n of this.numbers) n.el.remove();
    this.numbers.length = 0;
  }
}
