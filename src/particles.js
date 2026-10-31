import * as THREE from 'three'

export class Particles {
  constructor(scene, max = 180) {
    this.max = max
    this.items = []
    this.geometry = new THREE.BoxGeometry(1, 1, 1)
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, max)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = max
    this.dummy = new THREE.Object3D()
    this.color = new THREE.Color()
    for (let i = 0; i < max; i++) {
      this.dummy.position.set(0, -999, 0)
      this.dummy.scale.setScalar(0.0001)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, this.color.set(0xffffff))
      this.items.push({ life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 0.1, spin: 0, rot: 0 })
    }
    this.mesh.instanceMatrix.needsUpdate = true
    this.mesh.instanceColor.needsUpdate = true
    scene.add(this.mesh)
    this.next = 0
  }

  spawn(x, y, z, color, count = 10, power = 1) {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const p = this.items[this.next]
      this.next = (this.next + 1) % this.max
      p.life = 0.45 + Math.random() * 0.6
      p.maxLife = p.life
      p.pos.set(x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.5 + (Math.random() - 0.5) * 0.6, z + 0.5 + (Math.random() - 0.5) * 0.6)
      p.vel.set((Math.random() - 0.5) * 3.2 * power, 1.2 + Math.random() * 2.8 * power, (Math.random() - 0.5) * 3.2 * power)
      p.size = 0.07 + Math.random() * 0.11
      p.rot = Math.random() * Math.PI
      p.spin = (Math.random() - 0.5) * 8
      this.mesh.setColorAt(this.items.indexOf(p), c)
    }
    this.mesh.instanceColor.needsUpdate = true
  }

  update(dt) {
    const dummy = this.dummy
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i]
      if (p.life > 0) {
        p.life -= dt
        p.vel.y -= 18 * dt
        p.pos.addScaledVector(p.vel, dt)
        p.rot += p.spin * dt
        const fade = Math.max(0, p.life / p.maxLife)
        const s = p.size * (0.35 + fade * 0.65)
        dummy.position.copy(p.pos)
        dummy.rotation.set(p.rot, p.rot * 0.7, 0)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        this.mesh.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -999, 0)
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
        this.mesh.setMatrixAt(i, dummy.matrix)
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }
}
