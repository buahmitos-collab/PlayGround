import * as THREE from 'three'
import { createSunTexture, createMoonTexture } from './textures.js'

const DAY_TOP = new THREE.Color('#3f7fd8')
const DAY_BOTTOM = new THREE.Color('#d6ecff')
const NIGHT_TOP = new THREE.Color('#040812')
const NIGHT_BOTTOM = new THREE.Color('#111a30')
const DUSK_TOP = new THREE.Color('#4b3f78')
const DUSK_BOTTOM = new THREE.Color('#ff9a5a')
const FOG_DAY = new THREE.Color('#cfe6f7')
const FOG_NIGHT = new THREE.Color('#0b1322')
const FOG_DUSK = new THREE.Color('#e7a074')

export class Environment {
  constructor(scene, renderer, camera) {
    this.scene = scene
    this.renderer = renderer
    this.camera = camera
    this.underwater = false
    this.isNight = false
    this.sunDirection = new THREE.Vector3(0, 1, 0)

    scene.fog = new THREE.Fog(FOG_DAY.clone(), 40, 110)

    this.hemi = new THREE.HemisphereLight(0xdff0ff, 0x5a6b3d, 0.8)
    scene.add(this.hemi)

    this.ambient = new THREE.AmbientLight(0xffffff, 0.12)
    scene.add(this.ambient)

    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 1.25)
    this.sunLight.position.set(60, 100, 30)
    this.sunLight.target.position.set(0, 0, 0)
    scene.add(this.sunLight)
    scene.add(this.sunLight.target)

    const skyGeo = new THREE.SphereGeometry(420, 32, 20)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: DAY_TOP.clone() },
        bottomColor: { value: DAY_BOTTOM.clone() },
        horizonColor: { value: new THREE.Color('#ffffff') },
        sunDirection: { value: this.sunDirection },
        sunColor: { value: new THREE.Color('#fff3c4') },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition - cameraPosition);
          float up = clamp(dir.y, -1.0, 1.0);
          float t = pow(max(up, 0.0), 0.58);
          vec3 col = mix(bottomColor, topColor, t);
          float horizon = exp(-abs(up) * 7.0);
          col = mix(col, horizonColor, horizon * 0.72);
          float sun = pow(max(dot(dir, sunDirection), 0.0), 320.0);
          col += sunColor * sun * 2.0;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    this.sky = new THREE.Mesh(skyGeo, this.skyMat)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -10
    scene.add(this.sky)

    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createSunTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }))
    this.sun.scale.set(52, 52, 1)
    this.sun.renderOrder = -8
    scene.add(this.sun)

    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createMoonTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    }))
    this.moon.scale.set(34, 34, 1)
    this.moon.renderOrder = -8
    scene.add(this.moon)

    const starGeo = new THREE.BufferGeometry()
    const starPos = []
    for (let i = 0; i < 900; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 380
      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = Math.abs(r * Math.cos(phi)) * 0.9 + 20
      const z = r * Math.sin(phi) * Math.sin(theta)
      starPos.push(x, y, z)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.starMat = new THREE.PointsMaterial({
      color: 0xf7fbff,
      size: 2.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    })
    this.stars = new THREE.Points(starGeo, this.starMat)
    this.stars.frustumCulled = false
    this.stars.renderOrder = -9
    scene.add(this.stars)

    // Blocky cloud deck made of soft overlapping clusters.
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1)
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      fog: true,
    })
    this.clouds = new THREE.InstancedMesh(cloudGeo, this.cloudMat, 240)
    this.clouds.frustumCulled = false
    this.clouds.renderOrder = 3
    const dummy = new THREE.Object3D()
    let cloudIndex = 0
    for (let cluster = 0; cluster < 34 && cloudIndex < 240; cluster++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.sqrt(Math.random()) * 260
      const cx = Math.cos(angle) * radius
      const cz = Math.sin(angle) * radius
      const cy = 90 + Math.random() * 8
      const count = 4 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count && cloudIndex < 240; i++) {
        const w = 4 + Math.random() * 8
        const d = 4 + Math.random() * 8
        dummy.position.set(
          cx + (Math.random() - 0.5) * 15,
          cy + (Math.random() - 0.5) * 2.2,
          cz + (Math.random() - 0.5) * 15,
        )
        dummy.scale.set(w, 1.5 + Math.random() * 1.8, d)
        dummy.rotation.y = Math.random() * Math.PI
        dummy.updateMatrix()
        this.clouds.setMatrixAt(cloudIndex, dummy.matrix)
        cloudIndex++
      }
    }
    this.clouds.count = cloudIndex
    this.clouds.instanceMatrix.needsUpdate = true
    scene.add(this.clouds)

    // Warm fireflies after dark.
    const flyGeo = new THREE.BufferGeometry()
    const flyPos = []
    for (let i = 0; i < 90; i++) {
      flyPos.push((Math.random() - 0.5) * 40, 1 + Math.random() * 8, (Math.random() - 0.5) * 40)
    }
    flyGeo.setAttribute('position', new THREE.Float32BufferAttribute(flyPos, 3))
    this.flyMat = new THREE.PointsMaterial({
      color: 0xffe08a,
      size: 3.2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
    this.fireflies = new THREE.Points(flyGeo, this.flyMat)
    this.fireflies.frustumCulled = false
    scene.add(this.fireflies)
    this.flyBase = flyPos.slice()

    this.tmpColor = new THREE.Color()
    this.tmpColor2 = new THREE.Color()
    this.horizonTmp = new THREE.Color('#fff4d6')
    this.time = 0
    this.cloudDrift = 0
  }

  setUnderwater(value) {
    this.underwater = value
  }

  update(dt, dayTime, cameraPos, fogFar) {
    this.time += dt
    this.cloudDrift += dt * 0.35
    const angle = (dayTime - 0.25) * Math.PI * 2
    const sunDir = this.sunDirection.set(Math.cos(angle), Math.sin(angle), 0.28).normalize()
    const alt = sunDir.y
    const day = Math.max(0, Math.min(1, (alt + 0.12) / 0.3))
    const twilight = Math.exp(-Math.abs(alt) * 5.5) * (1 - day * 0.5)
    this.isNight = alt < -0.06

    // Sky gradient.
    const top = this.tmpColor.copy(NIGHT_TOP).lerp(DAY_TOP, day)
    top.lerp(DUSK_TOP, twilight * 0.45)
    const bottom = this.tmpColor2.copy(NIGHT_BOTTOM).lerp(DAY_BOTTOM, day)
    bottom.lerp(DUSK_BOTTOM, twilight * 0.55)
    this.skyMat.uniforms.topColor.value.copy(top)
    this.skyMat.uniforms.bottomColor.value.copy(bottom)
    this.skyMat.uniforms.horizonColor.value.copy(bottom).lerp(this.horizonTmp, twilight * 0.3)
    this.skyMat.uniforms.sunColor.value.setRGB(1, 0.92, 0.72)

    // Fog and lights.
    const fogColor = this.tmpColor.copy(NIGHT_BOTTOM).lerp(FOG_DAY, day).lerp(FOG_DUSK, twilight * 0.45)
    if (this.underwater) {
      fogColor.set('#0a3560')
    }
    this.scene.fog.color.copy(fogColor)
    this.scene.fog.near = this.underwater ? 0.5 : Math.max(24, fogFar * 0.42)
    this.scene.fog.far = this.underwater ? 19 : fogFar
    this.renderer.setClearColor(fogColor)

    this.hemi.intensity = 0.3 + day * 0.68
    this.hemi.color.setRGB(0.76 + day * 0.18, 0.84 + day * 0.1, 1)
    this.hemi.groundColor.setRGB(0.2 + day * 0.2, 0.24 + day * 0.16, 0.14 + day * 0.12)
    this.ambient.intensity = 0.11 + day * 0.08
    this.sunLight.intensity = 0.1 + day * 1.28
    this.sunLight.color.setRGB(1, 0.86 + day * 0.12, 0.68 + day * 0.24)

    // Sky objects follow the camera so the horizon never runs out.
    this.sky.position.copy(cameraPos)
    this.stars.position.copy(cameraPos)
    this.stars.rotation.y = this.time * 0.002
    this.starMat.opacity = Math.max(0, Math.min(1, -alt * 2.2 - 0.05))
    this.sun.position.copy(cameraPos).addScaledVector(sunDir, 300)
    this.sun.material.opacity = Math.max(0, Math.min(1, alt * 3 + 0.35))
    this.moon.position.copy(cameraPos).addScaledVector(sunDir, -300)
    this.moon.material.opacity = Math.max(0, Math.min(1, -alt * 2.5 + 0.2))
    this.sunLight.position.copy(cameraPos).addScaledVector(sunDir, 90)
    this.sunLight.target.position.copy(cameraPos)

    this.clouds.position.set(cameraPos.x + this.cloudDrift, 0, cameraPos.z)
    this.cloudMat.color.setRGB(0.78 + day * 0.22, 0.82 + day * 0.18, 0.92 + day * 0.08)
    this.cloudMat.opacity = 0.48 + day * 0.34

    this.fireflies.position.set(cameraPos.x, cameraPos.y - 4, cameraPos.z)
    this.flyMat.opacity = Math.max(0, Math.min(0.85, -alt * 2.2)) * (this.underwater ? 0 : 1)
    if (this.flyMat.opacity > 0.01) {
      const pos = this.fireflies.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const bx = this.flyBase[i * 3]
        const by = this.flyBase[i * 3 + 1]
        const bz = this.flyBase[i * 3 + 2]
        pos.setXYZ(
          i,
          bx + Math.sin(this.time * 0.7 + i) * 1.5,
          by + Math.sin(this.time * 1.1 + i * 1.7) * 0.6,
          bz + Math.cos(this.time * 0.6 + i * 0.8) * 1.5,
        )
      }
      pos.needsUpdate = true
    }
  }
}
