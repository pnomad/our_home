// 축구공: 3일째부터 거실 소파 앞에 놓인다. 바닥에서 굴러가고(점점 느려짐), 가구·벽에 맞으면 튕기고,
// 플레이어나 걷는 인형이 부딪히면 밀려난다. 인형들은 이걸로 공놀이(패스)를 한다 (entities/life.ts).
import * as THREE from 'three';

const R = 0.33; // 공 반지름 (인형 키의 1/3쯤)
const ROLL_FRICTION = 1.6; // 굴러가며 느려지는 정도 (칸/초²)
const BOUNCE = 0.6; // 가구·벽에 맞고 남는 속도 비율

/** 축구공 무늬: 정이십면체를 한 번 쪼개서, 원래 꼭짓점 12곳 둘레를 까만 오각형으로 */
function soccerGeometry() {
  const geo = new THREE.IcosahedronGeometry(R, 1);
  const base = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < base.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(base, i).normalize();
    if (!corners.some((c) => c.distanceTo(p) < 1e-3)) corners.push(p);
  }
  const pos = geo.getAttribute('position');
  const colors: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const mid = a.add(b).add(c).normalize();
    const black = corners.some((k) => k.angleTo(mid) < 0.36);
    const col = black ? [0.06, 0.06, 0.07] : [0.95, 0.95, 0.93];
    colors.push(...col, ...col, ...col);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export interface Pusher {
  pos: THREE.Vector3;
  moving: boolean;
}

export function createBall(parent: THREE.Object3D, heightAt: (x: number, z: number) => number) {
  const mesh = new THREE.Mesh(soccerGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true;
  mesh.visible = false;
  parent.add(mesh);
  const vel = new THREE.Vector2();
  const axis = new THREE.Vector3();

  /** 공이 (x, z)에 있으면 가구·벽에 박히는지 (바닥보다 높은 곳이 공 둘레에 있음) */
  const blocked = (x: number, z: number) => {
    const k = R * 0.85;
    return Math.max(heightAt(x - k, z), heightAt(x + k, z), heightAt(x, z - k), heightAt(x, z + k)) > 0.05;
  };

  return {
    mesh,
    radius: R,
    get pos() {
      return mesh.position;
    },
    get speed() {
      return vel.length();
    },
    get visible() {
      return mesh.visible;
    },
    /** 공을 놓음 (바닥 위) */
    place(x: number, z: number) {
      mesh.position.set(x, R, z);
      vel.set(0, 0);
      mesh.visible = true;
    },
    /** (dx, dz) 방향으로 차기 */
    kick(dx: number, dz: number, speed: number) {
      const len = Math.hypot(dx, dz) || 1;
      vel.set((dx / len) * speed, (dz / len) * speed);
    },
    update(dt: number, pushers: Pusher[]) {
      if (!mesh.visible) return;
      const p = mesh.position;
      // 걸어오다 부딪히면 툭 밀림
      for (const q of pushers) {
        if (Math.abs(q.pos.y - 0) > 0.3) continue;
        const dx = p.x - q.pos.x, dz = p.z - q.pos.z;
        const d = Math.hypot(dx, dz);
        const min = R + 0.35;
        if (d < min && d > 1e-4) {
          if (!blocked(q.pos.x + (dx / d) * min, q.pos.z + (dz / d) * min)) {
            p.x = q.pos.x + (dx / d) * min;
            p.z = q.pos.z + (dz / d) * min;
          }
          if (q.moving && vel.length() < 2) vel.set((dx / d) * 2.4, (dz / d) * 2.4);
        }
      }
      const speed = vel.length();
      if (speed < 0.02) {
        vel.set(0, 0);
        return;
      }
      vel.multiplyScalar(Math.max(0, speed - ROLL_FRICTION * dt) / speed);
      // 축마다 따로: 막히면 그 축만 튕김 (벽을 따라 미끄러지듯)
      const nx = p.x + vel.x * dt;
      if (blocked(nx, p.z)) vel.x *= -BOUNCE;
      else p.x = nx;
      const nz = p.z + vel.y * dt;
      if (blocked(p.x, nz)) vel.y *= -BOUNCE;
      else p.z = nz;
      // 굴러가는 만큼 회전
      const dist = vel.length() * dt;
      if (dist > 0) {
        axis.set(vel.y, 0, -vel.x).normalize();
        mesh.rotateOnWorldAxis(axis, dist / R);
      }
    },
  };
}

export type Ball = ReturnType<typeof createBall>;
