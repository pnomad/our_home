// 인형 천이 집게 발에 눌려 움푹 들어가는 겉모습.
// 충돌 모양(속심)은 겉모습보다 작아서 발이 겉 솜 속으로 파고드는데, 그 자리의 천을 발 모양대로 밀어 넣어
// "발이 인형에 푹 파고든" 것처럼 보이게 한다. 발이 떨어지면 천은 천천히 원래대로 부푼다.
import * as THREE from 'three';
import { RAPIER } from '../physics/world';
import { plushFabric } from '../physics/plushMesh';

interface Probe {
  col: RAPIER.Collider;
  points: THREE.Vector3[]; // 충돌체 좌표계의 구 중심들
  r: number;
}

interface Dent {
  base: Float32Array; // 원래 위치
  baseNormal: Float32Array;
  dented: boolean;
}

const tmp = new THREE.Vector3();
const q = new THREE.Quaternion();
const inv = new THREE.Matrix4();

/** 집게 발 충돌체를 작은 구 몇 개로 근사 (천을 밀어내는 모양) */
export function fingerProbes(world: RAPIER.World, handles: Set<number>): Probe[] {
  const probes: Probe[] = [];
  for (const h of handles) {
    const col = world.getCollider(h);
    const sh = col.shape;
    if (sh.type === RAPIER.ShapeType.Ball) {
      probes.push({ col, points: [new THREE.Vector3()], r: (sh as RAPIER.Ball).radius });
    } else if (sh.type === RAPIER.ShapeType.Capsule) {
      const c = sh as RAPIER.Capsule;
      probes.push({ col, points: line(new THREE.Vector3(0, 1, 0), c.halfHeight, c.radius), r: c.radius });
    } else if (sh.type === RAPIER.ShapeType.Cuboid) {
      const e = (sh as RAPIER.Cuboid).halfExtents;
      const ext = [e.x, e.y, e.z];
      const long = ext.indexOf(Math.max(...ext));
      const others = ext.filter((_, i) => i !== long);
      const axis = new THREE.Vector3(long === 0 ? 1 : 0, long === 1 ? 1 : 0, long === 2 ? 1 : 0);
      const r = (others[0] + others[1]) / 2;
      probes.push({ col, points: line(axis, ext[long] - r, r), r });
    }
  }
  return probes;
}

/** 축을 따라 반지름 r 간격으로 구 중심을 늘어놓음 */
function line(axis: THREE.Vector3, half: number, r: number) {
  const n = Math.max(1, Math.ceil((2 * half) / r));
  return Array.from({ length: n + 1 }, (_, i) => axis.clone().multiplyScalar(-half + (2 * half * i) / n));
}

/** 지금 발 위치의 구들 (세상 좌표) */
export function probeSpheres(probes: Probe[]) {
  const out: { c: THREE.Vector3; r: number }[] = [];
  for (const p of probes) {
    const t = p.col.translation(), r = p.col.rotation();
    q.set(r.x, r.y, r.z, r.w);
    for (const pt of p.points) out.push({ c: pt.clone().applyQuaternion(q).add(tmp.set(t.x, t.y, t.z)), r: p.r });
  }
  return out;
}

/** 경품 겉모습(천 메시)을 발 구들에 맞춰 움푹 / 원래대로 */
export function dentPrize(objs: THREE.Object3D[], spheres: { c: THREE.Vector3; r: number }[]) {
  for (const obj of objs) {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material === plushFabric) dentMesh(mesh, spheres);
    });
  }
}

function dentMesh(mesh: THREE.Mesh, spheres: { c: THREE.Vector3; r: number }[]) {
  let d = mesh.userData.dent as Dent | undefined;
  mesh.updateWorldMatrix(true, false);
  inv.copy(mesh.matrixWorld).invert();
  const scale = 1 / mesh.matrixWorld.getMaxScaleOnAxis();
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  const bs = mesh.geometry.boundingSphere!;
  // 이 메시 근처에 있는 발 구만 (메시 좌표로)
  const near: { c: THREE.Vector3; r: number }[] = [];
  for (const s of spheres) {
    const c = s.c.clone().applyMatrix4(inv), r = s.r * scale;
    if (c.distanceTo(bs.center) < bs.radius + r) near.push({ c, r });
  }
  if (!near.length && (!d || !d.dented)) return;
  if (!d) {
    // 처음 눌릴 때 이 인형만의 메시로 복사 (같은 모양 인형들이 공유하던 것)
    mesh.geometry = mesh.geometry.clone();
    d = {
      base: (mesh.geometry.getAttribute('position').array as Float32Array).slice(),
      baseNormal: (mesh.geometry.getAttribute('normal').array as Float32Array).slice(),
      dented: false,
    };
    mesh.userData.dent = d;
  }
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const a = pos.array as Float32Array;
  let moved = false, any = false;
  for (let i = 0; i < a.length; i += 3) {
    let tx = d.base[i], ty = d.base[i + 1], tz = d.base[i + 2];
    for (const s of near) {
      const dx = tx - s.c.x, dy = ty - s.c.y, dz = tz - s.c.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < s.r && dist > 1e-6) {
        // 발 속에 들어온 천은 발 표면까지 밀려남 (발을 감싸며 움푹)
        const k = s.r / dist;
        tx = s.c.x + dx * k; ty = s.c.y + dy * k; tz = s.c.z + dz * k;
      }
    }
    // 눌릴 때는 바로, 부풀 때는 천천히
    const pressing = tx !== d.base[i] || ty !== d.base[i + 1] || tz !== d.base[i + 2];
    if (pressing) any = true;
    const k = pressing ? 0.6 : 0.12;
    const nx = a[i] + (tx - a[i]) * k, ny = a[i + 1] + (ty - a[i + 1]) * k, nz = a[i + 2] + (tz - a[i + 2]) * k;
    if (Math.abs(nx - a[i]) + Math.abs(ny - a[i + 1]) + Math.abs(nz - a[i + 2]) > 1e-6) {
      a[i] = nx; a[i + 1] = ny; a[i + 2] = nz;
      moved = true;
    } else {
      a[i] = tx; a[i + 1] = ty; a[i + 2] = tz;
    }
  }
  if (!moved) {
    if (d.dented && !any) {
      // 다 부풀었으면 원래 법선으로
      (mesh.geometry.getAttribute('normal').array as Float32Array).set(d.baseNormal);
      mesh.geometry.getAttribute('normal').needsUpdate = true;
      d.dented = false;
    }
    return;
  }
  d.dented = true;
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
