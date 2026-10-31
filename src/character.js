import * as THREE from 'three';
import { toon, clamp, damp } from './look.js';

export const CHARACTERS = [
  {
    id: 'aria',
    name: 'Aria',
    title: 'Penjaga Angin',
    element: 'anemo',
    elementLabel: 'Anemo',
    color: '#8cf0dd',
    colorSoft: '#d9fff8',
    outfit: '#276b78',
    outfitDark: '#174751',
    cloth: '#e8f4e8',
    trim: '#e3c67d',
    hair: '#d7f2e6',
    hairDark: '#8fc9bf',
    skin: '#f2c9a5',
    cape: '#5fc9bd',
    eye: '#1f5f5b',
    sword: '#bfefff',
    swordGlow: '#8cf0dd',
  },
  {
    id: 'ember',
    name: 'Ember',
    title: 'Bara Berjalan',
    element: 'pyro',
    elementLabel: 'Pyro',
    color: '#ffa267',
    colorSoft: '#ffe1c7',
    outfit: '#8d342e',
    outfitDark: '#5b1f1d',
    cloth: '#ffe6cf',
    trim: '#f0c272',
    hair: '#3c211f',
    hairDark: '#22110f',
    skin: '#eab28c',
    cape: '#c85038',
    eye: '#7a2a1c',
    sword: '#ffd3a1',
    swordGlow: '#ff8b4c',
  },
];

function capsule(radius, length, mat, segments = 6) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 3, segments), mat);
  mesh.castShadow = true;
  return mesh;
}

function makeCapeGeometry(width, height) {
  const geo = new THREE.PlaneGeometry(width, height, 5, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (height / 2 - y) / height;
    pos.setZ(i, -Math.sin(t * Math.PI * 0.75) * 0.14 - t * t * 0.12);
    pos.setX(i, pos.getX(i) * (1 - t * 0.28));
  }
  geo.computeVertexNormals();
  return geo;
}

export function createCharacter(index) {
  const data = CHARACTERS[index];
  const root = new THREE.Group();
  root.name = `character-${data.id}`;
  const body = new THREE.Group();
  root.add(body);

  const skinMat = toon(data.skin);
  const outfitMat = toon(data.outfit);
  const outfitDarkMat = toon(data.outfitDark);
  const clothMat = toon(data.cloth);
  const trimMat = toon(data.trim);
  const hairMat = toon(data.hair);
  const hairDarkMat = toon(data.hairDark);
  const bootMat = toon('#2b3136');
  const eyeMat = new THREE.MeshBasicMaterial({ color: data.eye });

  // ---- legs ----
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.135, 0.92, 0);
    const thigh = capsule(0.085, 0.28, clothMat);
    thigh.position.y = -0.19;
    pivot.add(thigh);
    const shin = capsule(0.07, 0.28, bootMat);
    shin.position.y = -0.56;
    pivot.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.27), bootMat);
    boot.position.set(0, -0.85, 0.05);
    boot.castShadow = true;
    pivot.add(boot);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 4, 10), trimMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.41;
    pivot.add(cuff);
    body.add(pivot);
    legs.push(pivot);
  }

  // ---- torso ----
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.16, 3, 8), outfitDarkMat);
  hips.position.y = 0.98;
  hips.scale.z = 0.8;
  body.add(hips);

  const torso = capsule(0.235, 0.34, outfitMat);
  torso.position.y = 1.29;
  torso.scale.set(1, 1, 0.82);
  torso.castShadow = true;
  body.add(torso);

  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.22, 0.34, 8), clothMat);
  vest.position.y = 1.35;
  vest.scale.z = 0.8;
  body.add(vest);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 4, 14), trimMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.07;
  belt.scale.z = 0.85;
  body.add(belt);

  const brooch = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), new THREE.MeshBasicMaterial({ color: data.color }));
  brooch.position.set(0, 1.44, 0.23);
  body.add(brooch);

  // ---- arms ----
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.48, 0);
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 7), outfitMat);
    shoulder.scale.set(1.2, 0.9, 1);
    pivot.add(shoulder);
    const upper = capsule(0.068, 0.24, outfitMat);
    upper.position.y = -0.17;
    pivot.add(upper);
    const fore = capsule(0.06, 0.24, clothMat);
    fore.position.y = -0.43;
    pivot.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 7), skinMat);
    hand.position.y = -0.62;
    hand.castShadow = true;
    pivot.add(hand);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 4, 10), trimMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.33;
    pivot.add(cuff);
    body.add(pivot);
    arms.push(pivot);
    pivot.userData.hand = hand;
  }

  // ---- sword (right hand) ----
  const sword = new THREE.Group();
  sword.position.y = -0.64;
  const bladeMat = toon(data.sword, {
    emissive: new THREE.Color(data.swordGlow),
    emissiveIntensity: 0.28,
  });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.86, 0.018), bladeMat);
  blade.position.y = -0.45;
  blade.castShadow = true;
  sword.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), bladeMat);
  tip.position.y = -0.94;
  tip.rotation.x = Math.PI;
  sword.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.05), trimMat);
  guard.position.y = -0.01;
  sword.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.16, 6), toon('#3c2b25'));
  grip.position.y = 0.08;
  sword.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 5), trimMat);
  pommel.position.y = 0.17;
  sword.add(pommel);
  const bladeGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: data.swordGlow,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })(),
    })
  );
  bladeGlow.scale.set(0.42, 1.4, 1);
  bladeGlow.position.y = -0.5;
  sword.add(bladeGlow);
  arms[1].add(sword);

  // ---- head ----
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 7), skinMat);
  neck.position.y = 1.57;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 14), skinMat);
  head.position.y = 1.79;
  head.scale.set(0.94, 1, 0.96);
  head.castShadow = true;
  body.add(head);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMat);
  jaw.position.set(0, 1.71, 0.035);
  jaw.scale.set(0.9, 0.9, 0.9);
  body.add(jaw);

  // eyes + brows give the tiny face some life.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), eyeMat);
    eye.position.set(side * 0.077, 1.815, 0.2);
    eye.scale.set(0.85, 1.25, 0.5);
    body.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    shine.position.set(side * 0.083, 1.824, 0.22);
    body.add(shine);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), hairDarkMat);
    brow.position.set(side * 0.077, 1.875, 0.205);
    brow.rotation.z = side * -0.12;
    body.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.01), toon('#a5554f'));
  mouth.position.set(0, 1.71, 0.215);
  body.add(mouth);

  // hair cap
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 15, 12, 0, Math.PI * 2, 0, Math.PI * 0.68), hairMat);
  hairCap.position.set(0, 1.81, -0.012);
  hairCap.scale.set(1.02, 1.05, 1.03);
  hairCap.castShadow = true;
  body.add(hairCap);

  const bangs = new THREE.Group();
  for (const side of [-1, 1]) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3, 5), hairMat);
    bang.position.set(side * 0.1, 1.79, 0.19);
    bang.rotation.set(0.32, 0, side * 0.2);
    bangs.add(bang);
  }
  const bangCenter = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.24, 5), hairMat);
  bangCenter.position.set(0.01, 1.83, 0.215);
  bangCenter.rotation.x = 0.24;
  bangs.add(bangCenter);
  body.add(bangs);

  // long back hair + ponytail
  const backHair = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), hairMat);
  backHair.position.set(0, 1.57, -0.13);
  backHair.scale.z = 0.7;
  body.add(backHair);

  const ponytailPivot = new THREE.Group();
  ponytailPivot.position.set(0, 1.86, -0.2);
  const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 4, 7), hairMat);
  ponytail.position.y = -0.27;
  ponytailPivot.add(ponytail);
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 5), hairDarkMat);
  tailTip.position.y = -0.62;
  tailTip.rotation.x = Math.PI;
  ponytailPivot.add(tailTip);
  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 4, 9), trimMat);
  hairTie.rotation.x = Math.PI / 2;
  hairTie.position.y = -0.02;
  ponytailPivot.add(hairTie);
  body.add(ponytailPivot);

  // head accessory: Aria gets a wind feather, Ember a small ember ornament.
  if (data.element === 'anemo') {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.38, 4), trimMat);
    feather.position.set(0.2, 1.98, -0.05);
    feather.rotation.set(0.1, 0, -0.75);
    body.add(feather);
  } else {
    const emberGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: '#ffcf7a' }));
    emberGem.position.set(0.2, 1.94, 0.02);
    body.add(emberGem);
  }

  // ---- cape / scarf ----
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 1.47, -0.16);
  const capeMat = toon(data.cape, { side: THREE.DoubleSide });
  const cape = new THREE.Mesh(makeCapeGeometry(0.58, 1.05), capeMat);
  cape.position.y = -0.52;
  cape.castShadow = true;
  capePivot.add(cape);
  const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), trimMat);
  capeTrim.position.set(0, -1.02, -0.02);
  capePivot.add(capeTrim);
  body.add(capePivot);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 5, 14), toon(data.color, { emissive: new THREE.Color(data.color), emissiveIntensity: 0.1 }));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.55;
  scarf.scale.z = 0.9;
  body.add(scarf);

  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })(),
      color: data.color,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  aura.scale.setScalar(2.6);
  aura.position.y = 1.05;
  body.add(aura);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 18),
    new THREE.MeshBasicMaterial({ color: '#081512', transparent: true, opacity: 0.28, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  const anim = {
    phase: 0,
    idle: Math.random() * 6,
    attack: -1,
    cast: -1,
    hurt: 0,
    glideBlend: 0,
    swimBlend: 0,
    lean: 0,
    attackKind: 'slash',
  };

  function update(dt, state) {
    const {
      speed = 0,
      onGround = true,
      gliding = false,
      swimming = false,
      elapsed = 0,
    } = state;

    const moveBlend = clamp(speed / 5.6, 0, 1.35);
    const stride = 0.55 + Math.min(speed, 9) * 0.055;
    if (onGround && !swimming && speed > 0.2) {
      anim.phase += dt * (5.5 + speed * 0.95);
    } else {
      anim.phase += dt * 1.5;
    }
    anim.glideBlend = damp(anim.glideBlend, gliding ? 1 : 0, 7, dt);
    anim.swimBlend = damp(anim.swimBlend, swimming ? 1 : 0, 6, dt);

    const swing = Math.sin(anim.phase);
    const legSwing = onGround ? swing * stride * moveBlend * (1 - anim.glideBlend) : 0.08;
    legs[0].rotation.x = legSwing;
    legs[1].rotation.x = -legSwing;
    legs[0].rotation.z = 0.02;
    legs[1].rotation.z = -0.02;

    const armSwing = -legSwing * 0.72;
    arms[0].rotation.x = armSwing;
    arms[1].rotation.x = -armSwing + (anim.attack >= 0 ? 0 : 0);
    arms[0].rotation.z = 0.1 + anim.glideBlend * 0.95 + anim.swimBlend * 0.5;
    arms[1].rotation.z = -0.1 - anim.glideBlend * 0.95 - anim.swimBlend * 0.5;

    // Attack overrides the sword arm with a quick overhead arc.
    if (anim.attack >= 0) {
      const t = anim.attack;
      const wind = Math.sin(Math.min(t / 0.32, 1) * Math.PI * 0.5);
      const strike = Math.sin(Math.max(0, (t - 0.28) / 0.42) * Math.PI * 0.5);
      const recover = Math.sin(Math.max(0, (t - 0.66) / 0.34) * Math.PI * 0.5);
      arms[1].rotation.x = 0.55 * wind - 2.5 * strike + 1.9 * recover;
      arms[1].rotation.z = -0.35 - 0.4 * wind + 0.7 * strike;
      arms[0].rotation.x = -0.2 + 0.5 * strike;
      arms[0].rotation.z = 0.3 + 0.35 * strike;
      body.rotation.y = 0.38 * wind - 0.62 * strike + 0.2 * recover;
      body.position.x = 0.04 * strike;
      head.rotation.y = -0.1 * strike;
    } else {
      body.rotation.y = damp(body.rotation.y, 0, 14, dt);
      body.position.x = damp(body.position.x, 0, 12, dt);
      head.rotation.y = 0;
      if (anim.cast >= 0) {
        const t = anim.cast;
        const push = Math.sin(clamp(t, 0, 1) * Math.PI);
        arms[0].rotation.x = -1.5 * push;
        arms[1].rotation.x = -1.5 * push;
        arms[0].rotation.z = 0.4 * push + 0.1;
        arms[1].rotation.z = -0.4 * push - 0.1;
        body.rotation.x = -0.08 * push;
      } else {
        body.rotation.x = damp(body.rotation.x, 0, 10, dt);
      }
    }

    if (gliding || swimming) {
      legs[0].rotation.x = gliding ? -0.25 : Math.sin(anim.phase * 1.5) * 0.35;
      legs[1].rotation.x = gliding ? -0.1 : Math.sin(anim.phase * 1.5 + 1.4) * 0.35;
      body.rotation.x = gliding ? -0.18 : 0;
    }

    const breathe = Math.sin(elapsed * 2 + anim.idle) * 0.012;
    body.position.y = breathe + (gliding ? 0.04 : 0) + (swimming ? -0.28 : 0);
    capePivot.rotation.x = -0.1 - moveBlend * 0.28 - anim.glideBlend * 0.45 + Math.sin(elapsed * 2.2 + anim.idle) * 0.025;
    capePivot.rotation.z = Math.sin(anim.phase * 0.5) * 0.05;
    ponytailPivot.rotation.x = 0.08 + moveBlend * 0.3 + anim.glideBlend * 0.5;
    ponytailPivot.rotation.z = Math.sin(elapsed * 1.7 + anim.idle) * 0.08;
    aura.material.opacity = 0.16 + Math.sin(elapsed * 2.6) * 0.05;

    if (anim.hurt > 0) {
      anim.hurt = Math.max(0, anim.hurt - dt * 3);
      body.rotation.z = Math.sin(anim.hurt * 28) * 0.05;
    } else {
      body.rotation.z = damp(body.rotation.z, 0, 10, dt);
    }
  }

  function setVisible(visible) {
    root.visible = visible;
  }

  root.scale.setScalar(1.02);
  return {
    root,
    data,
    anim,
    parts: { legs, arms, head, body, capePivot, ponytailPivot, sword, aura, bladeMat },
    update,
    setVisible,
    getHandPosition(target = new THREE.Vector3()) {
      return arms[1].userData.hand.getWorldPosition(target);
    },
    getSwordTip(target = new THREE.Vector3()) {
      blade.getWorldPosition(target);
      return target;
    },
  };
}
