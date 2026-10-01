# 시바 인형 (참고: 엎드린 식빵 모양 시바 인형 사진). 실행: python tools/blender/shiba.py [미리보기.png]
# 게임 좌표와 같은 크기: 키 약 0.9, 앞뒤 약 1.0 (인형 키 30cm = 1칸)
import math
import sys
import bpy
from mathutils import Vector
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import common as C

ORANGE = C.srgb('#e89a3a')
CREAM = C.srgb('#fdf8ef')
EAR_INNER = C.srgb('#f4d9b0')
EYE = C.srgb('#3a2a20')
BLUSH = C.srgb('#f4a3b4')

C.reset()

# ---------- 1. 몸: 앞뒤로 긴 식빵 + 볼·배 + 발 + 주둥이 ----------
body = C.blobs('shiba', [
    ((0, 0.05, 0.36), (0.50, 0.58, 0.36)),     # 머리까지 한 덩어리, 앞뒤로 긴 식빵 몸
    ((0, -0.22, 0.27), (0.45, 0.34, 0.27)),    # 볼록한 볼·배
    ((0, -0.5, 0.4), (0.12, 0.08, 0.08)),      # 작은 주둥이
    ((-0.2, -0.42, 0.07), (0.12, 0.13, 0.08)), # 앞발
    ((0.2, -0.42, 0.07), (0.12, 0.13, 0.08)),
    ((-0.3, 0.45, 0.08), (0.11, 0.12, 0.08)),  # 뒷발
    ((0.3, 0.45, 0.08), (0.11, 0.12, 0.08)),
])

# ---------- 2. 삼각 귀 (앞으로 살짝 숙임) + 등 위 말린 꼬리 ----------
parts = [body]
for side in (-1, 1):
    # 아래가 넓고 위가 좁은 두 덩어리 → 녹이면 끝이 둥근 삼각 귀 (앞으로 살짝 숙임)
    ear = C.blobs('ear', [
        ((side * 0.27, -0.14, 0.7), (0.13, 0.075, 0.1)),
        ((side * 0.29, -0.17, 0.8), (0.065, 0.05, 0.07)),
    ])
    parts.append(ear)
bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.065, location=(0.04, 0.55, 0.6),
                                 rotation=(0, math.radians(90), math.radians(-20)))
parts.append(bpy.context.active_object)

# 하나로 합쳐서 고르게 다시 짜고 매끈하게 (귀·꼬리는 꿰매 붙인 듯 이어짐)
body = C.join('shiba', parts)
C.remesh_smooth(body, voxel=0.011, smooth=1.0, iters=30)
C.decimate(body, 0.45)  # 게임용으로 면 수 줄이기

# ---------- 3. 솔기: 머리~등 가운데, 크림색 경계 ----------
def cream_k(co):
    """크림 영역 안쪽 정도 (1 안, 0 밖): 얼굴 아래·배를 감싸는 타원체"""
    d = ((co.x / 0.48) ** 2 + ((co.y + 0.22) / 0.4) ** 2 + ((co.z - 0.2) / 0.28) ** 2) ** 0.5
    return d

C.pinch_seam(body, lambda co: co.x if co.z > 0.5 and -0.05 < co.y < 0.45 and abs(co.x) < 0.1 else None, width=0.03, depth=0.008)
C.pinch_seam(body, lambda co: (cream_k(co) - 1) * 0.3 if co.y < 0.25 else None, width=0.02, depth=0.006)

# ---------- 4. 색: 주황 등, 크림 볼·배·주둥이, 귀 안쪽, 꼬리 끝 ----------
def color(co, n):
    c = ORANGE
    c = C.mix(c, CREAM, C.smoothstep(1.03, 0.95, cream_k(co)))
    muzzle = ((co.x / 0.15) ** 2 + ((co.y + 0.5) / 0.11) ** 2 + ((co.z - 0.4) / 0.11) ** 2) ** 0.5
    c = C.mix(c, CREAM, C.smoothstep(1.05, 0.9, muzzle))
    # 귀 앞면 가운데 (가장자리는 주황 테두리)
    for side in (-1, 1):
        e = (((co.x - side * 0.28) / 0.07) ** 2 + ((co.z - 0.76) / 0.075) ** 2) ** 0.5
        if n.y < -0.3 and co.y < -0.15:
            c = C.mix(c, EAR_INNER, C.smoothstep(1.0, 0.8, e))
    tip = (Vector((co.x, co.y, co.z)) - Vector((0.04, 0.62, 0.68))).length
    c = C.mix(c, CREAM, C.smoothstep(0.08, 0.04, tip))
    return c

C.paint(body, color)
C.shade_smooth(body)
fabric = C.fabric_material()
body.data.materials.append(fabric)

# ---------- 5. 얼굴: 단추 눈, 눈썹 점, 코, ω 입, 볼터치 ----------
button = C.glossy_material()
front = (0, 1, 0)
deco = []
for x in (-0.15, 0.15):
    deco.append(C.decal('eye', body, (x, -2, 0.54), front, (0.06, 0.07), EYE, flat=0.45, material=button))
    deco.append(C.decal('brow', body, (x, -2, 0.65), front, (0.08, 0.05), CREAM, flat=0.25, material=fabric))
    deco.append(C.decal('blush', body, (x * 1.75, -2, 0.3), front, (0.12, 0.07), BLUSH, flat=0.12, lift=0.002, material=fabric))
    deco.append(C.decal('mouth', body, (x * 0.2, -2, 0.395), front, (0.05, 0.016), EYE, flat=0.3, material=fabric))
deco.append(C.decal('nose', body, (0, -2, 0.47), front, (0.08, 0.05), EYE, flat=0.5, material=button))
deco = [d for d in deco if d]

objs = [body] + deco
out = '/home/user/repo/public/models/shiba.glb'
C.export_glb(out, objs)
print('exported', out, 'verts', len(body.data.vertices), 'decals', len(deco))
if len(sys.argv) > 1:
    C.render_preview(sys.argv[1], objs, angle=float(sys.argv[2]) if len(sys.argv) > 2 else 0.5)
