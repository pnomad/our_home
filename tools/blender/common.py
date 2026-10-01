# 블렌더로 인형 모델 만드는 공통 도구 (bpy 모듈로 실행: python tools/blender/<인형>.py)
# 좌표: 블렌더는 Z 위, -Y 앞. glb 로 내보내면 three.js 기준 Y 위, +Z 앞이 된다.
import math
import bpy
import bmesh
from mathutils import Vector


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def metaball(name, parts, resolution=0.02, threshold=0.6):
    """타원체 덩어리들을 부드럽게 녹여 붙인 메타볼 → 메시. parts: [(중심, 반지름(x,y,z))]"""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = threshold
    obj = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(obj)
    for c, r in parts:
        el = mb.elements.new(type='ELLIPSOID')
        el.co = c
        el.radius = 1.0
        el.size_x, el.size_y, el.size_z = r
        el.stiffness = 2.0
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.context.view_layer.update()
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active


def blobs(name, parts):
    """정확한 크기의 타원체들을 하나로 (나중에 remesh_smooth 로 녹여 붙임). parts: [(중심, 반지름(x,y,z))]"""
    objs = []
    for c, r in parts:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=c)
        o = bpy.context.active_object
        o.scale = r
        bpy.ops.object.transform_apply(scale=True)
        objs.append(o)
    return join(name, objs)


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def remesh_smooth(obj, voxel=0.012, smooth=0.6, iters=12):
    """복셀 리메시로 고른 면을 만들고 살짝 매끈하게 (솜 넣은 천 느낌)"""
    m = obj.modifiers.new('remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    s = obj.modifiers.new('smooth', 'LAPLACIANSMOOTH')
    s.lambda_factor = smooth
    s.iterations = iters
    apply_all(obj)


def decimate(obj, ratio):
    d = obj.modifiers.new('decimate', 'DECIMATE')
    d.ratio = ratio
    apply_all(obj)


def apply_all(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def paint(obj, color_fn, name='Col'):
    """정점마다 color_fn(위치, 법선) → (r,g,b) 로 색칠 (선형 색공간)"""
    me = obj.data
    if name not in me.color_attributes:
        me.color_attributes.new(name, 'FLOAT_COLOR', 'POINT')
    attr = me.color_attributes[name]
    for v in me.vertices:
        r, g, b = color_fn(v.co, v.normal)
        attr.data[v.index].color = (r, g, b, 1.0)


def srgb(h):
    """#rrggbb → 선형 (r,g,b)"""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(h[i:i + 2], 16)) for i in (1, 3, 5))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def pinch_seam(obj, dist_fn, width, depth):
    """솔기: dist_fn(위치) 가 0 인 선 근처를 안쪽으로 살짝 눌러 꿰맨 홈처럼"""
    me = obj.data
    me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
    for v in me.vertices:
        d = dist_fn(v.co)
        if d is None or abs(d) >= width:
            continue
        k = (1 - abs(d) / width) ** 2
        v.co -= v.normal * depth * k


def surface_hit(obj, origin, direction):
    """물체 표면에서 광선이 맞는 점과 법선 (물체 좌표)"""
    ok, loc, nrm, _ = obj.ray_cast(origin, direction)
    return (loc, nrm) if ok else (None, None)


def decal(name, target, origin, direction, size, color_lin, flat=0.35, lift=0.004, material=None):
    """표면에 붙는 납작한 단추·자수 (눈, 코, 눈썹 점 등). size=(가로, 세로)"""
    loc, nrm = surface_hit(target, Vector(origin), Vector(direction).normalized())
    if loc is None:
        return None
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0] / 2, size[1] / 2, max(size[0], size[1]) / 2 * flat)
    # 구의 Z 축이 표면 법선을 보도록
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(nrm)
    ob.location = loc + nrm * lift
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    shade_smooth(ob)
    paint(ob, lambda co, n: color_lin)
    if material:
        ob.data.materials.append(material)
    return ob


def fabric_material(name='fabric'):
    """정점 색을 쓰는 천 재질 (glb 로 나갈 때 baseColor = 정점 색)"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    if 'Sheen Weight' in bsdf.inputs:
        bsdf.inputs['Sheen Weight'].default_value = 0.6
    return m


def glossy_material(name='button'):
    """플라스틱 단추 눈·코 (살짝 반짝)"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    nt.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.25
    return m


def export_glb(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_normals=True,
        export_vertex_color='ACTIVE', export_all_vertex_colors=False,
        export_materials='EXPORT',
    )


def render_preview(path, objects, angle=0.5, size=512, samples=24):
    """확인용 렌더 (Cycles CPU)"""
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = samples
    scn.render.resolution_x = scn.render.resolution_y = size
    scn.render.film_transparent = False
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.95, 0.9, 0.84, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    scn.world = world
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objects:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 50
    cam = bpy.data.objects.new('cam', cam_data)
    scn.collection.objects.link(cam)
    dist = radius * 3.0
    cam.location = center + Vector((math.sin(angle) * dist, -math.cos(angle) * dist, radius * 1.2))
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scn.camera = cam
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = 3.5
    sun = bpy.data.objects.new('sun', sun_data)
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    scn.collection.objects.link(sun)
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
