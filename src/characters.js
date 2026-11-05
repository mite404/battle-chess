import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const gold = 0xb58a38;
const steel = 0x8c9ba0;
const leather = 0x30251e;
const skin = 0xc49a76;
const hair = 0x403027;
const surfaces = new Map();
const textures = new Map();

function grain(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#888";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 1489;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647) * 25;
      const value = kind === "cloth" ? 100 + ((x + y) % 3) * 28 + noise : 110 + noise;
      ctx.fillStyle = `rgb(${value},${value},${value})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "cloth" ? 3 : 2, 3);
  textures.set(kind, texture);
  return texture;
}

function surface(color, kind = "cloth") {
  const key = `${color}-${kind}`;
  if (!surfaces.has(key)) {
    const metal = kind === "metal";
    surfaces.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        metalness: metal ? 0.78 : 0.02,
        roughness: metal ? 0.29 : kind === "skin" ? 0.65 : 0.88,
        bumpMap: kind === "skin" ? null : grain(kind),
        bumpScale: metal ? 0.002 : 0.009,
      }),
    );
  }
  return surfaces.get(key);
}

function part(parent, geometry, color, position, scale = [1, 1, 1], kind) {
  const mesh = new THREE.Mesh(geometry, surface(color, kind));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ellipsoid(parent, color, position, scale, kind = "metal") {
  return part(parent, new THREE.SphereGeometry(1, 20, 14), color, position, scale, kind);
}

function block(parent, color, position, size, kind = "metal") {
  return part(parent, new THREE.BoxGeometry(...size), color, position, [1, 1, 1], kind);
}

function tube(parent, color, from, to, radius, endRadius = radius, kind = "metal") {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to);
  const mesh = part(
    parent,
    new THREE.CylinderGeometry(endRadius, radius, a.distanceTo(b), 12),
    color,
    a.clone().add(b).multiplyScalar(0.5).toArray(),
    [1, 1, 1],
    kind,
  );
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return mesh;
}

function ring(parent, color, position, radius, thickness, vertical = false) {
  const mesh = part(
    parent,
    new THREE.TorusGeometry(radius, thickness, 6, 32),
    color,
    position,
    [1, 1, 1],
    "metal",
  );
  if (!vertical) mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function garment(parent, color, bottom, height, lowerRadius, upperRadius, folds = 12) {
  const geometry = new THREE.CylinderGeometry(upperRadius, lowerRadius, height, 48, 12, true);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const drop = 0.5 - positions.getY(i) / height;
    const pleat = 1 + Math.cos(angle * folds) * 0.07 * (0.3 + drop);
    positions.setXYZ(i, x * pleat, positions.getY(i), z * pleat * 0.82);
  }
  geometry.computeVertexNormals();
  return part(parent, geometry, color, [0, bottom + height / 2, 0], [1, 1, 1], "cloth");
}

function face(parent, y, queen = false, beard = false) {
  ellipsoid(parent, skin, [0, y, 0.015], [0.105, 0.145, 0.096], "skin");
  ellipsoid(parent, skin, [0, y - 0.065, 0.07], [0.072, 0.067, 0.06], "skin");
  ellipsoid(parent, skin, [0, y - 0.003, 0.113], [0.023, 0.042, 0.039], "skin");
  for (const side of [-1, 1]) {
    ellipsoid(parent, skin, [side * 0.106, y - 0.008, 0], [0.022, 0.043, 0.025], "skin");
    ellipsoid(parent, 0xe1d2b4, [side * 0.043, y + 0.027, 0.101], [0.025, 0.012, 0.008], "skin");
    ellipsoid(parent, 0x292b27, [side * 0.043, y + 0.027, 0.108], [0.009, 0.01, 0.006], "skin");
    const brow = block(
      parent,
      hair,
      [side * 0.043, y + 0.053, 0.102],
      [0.052, 0.012, 0.012],
      "cloth",
    );
    brow.rotation.z = side * -0.12;
  }
  block(parent, 0x7d4b3d, [0, y - 0.065, 0.12], [0.042, 0.009, 0.009], "skin");
  if (queen) {
    for (const side of [-1, 1]) {
      ellipsoid(parent, hair, [side * 0.101, y - 0.095, -0.025], [0.045, 0.2, 0.082], "cloth");
      for (let i = 0; i < 5; i++) {
        ellipsoid(
          parent,
          0x66472e,
          [side * 0.108, y - 0.055 - i * 0.039, 0.015],
          [0.029, 0.03, 0.03],
          "cloth",
        );
      }
      ellipsoid(parent, gold, [side * 0.115, y - 0.05, 0.034], [0.013, 0.025, 0.012]);
    }
  } else if (beard) {
    for (let i = -2; i <= 2; i++) {
      ellipsoid(
        parent,
        0x8f897b,
        [i * 0.025, y - 0.108, 0.078],
        [0.023, 0.074 - Math.abs(i) * 0.01, 0.032],
        "cloth",
      );
    }
    for (const side of [-1, 1]) {
      ellipsoid(parent, 0xaaa18d, [side * 0.028, y - 0.043, 0.114], [0.036, 0.017, 0.018], "cloth");
    }
  }
}

function coronet(parent, y, king, gem) {
  ring(parent, gold, [0, y, 0], 0.115, 0.023);
  ring(parent, gold, [0, y + 0.054, 0], 0.12, 0.014);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = Math.cos(a) * 0.118,
      z = Math.sin(a) * 0.118;
    tube(parent, gold, [x, y, z], [x * 1.04, y + 0.13, z * 1.04], 0.012, 0.006);
    ellipsoid(parent, gold, [x * 1.04, y + 0.13, z * 1.04], [0.022, 0.023, 0.022]);
    ellipsoid(parent, gem, [x * 1.1, y + 0.026, z * 1.1], [0.018, 0.025, 0.018], "metal");
  }
  if (king) {
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.12, y + 0.05, 0),
        new THREE.Vector3(side * 0.09, y + 0.17, 0),
        new THREE.Vector3(0, y + 0.19, 0),
      ]);
      part(
        parent,
        new THREE.TubeGeometry(curve, 12, 0.012, 6, false),
        gold,
        [0, 0, 0],
        [1, 1, 1],
        "metal",
      );
    }
    block(parent, gold, [0, y + 0.235, 0], [0.024, 0.13, 0.025]);
    block(parent, gold, [0, y + 0.26, 0], [0.085, 0.025, 0.025]);
  }
}

function blade(parent, scale = 1) {
  const sword = new THREE.Group();
  sword.position.set(0, -0.29, 0.085);
  sword.scale.setScalar(scale);
  tube(sword, leather, [0, -0.12, 0], [0, 0.08, 0], 0.025, 0.025, "cloth");
  ellipsoid(sword, gold, [0, -0.14, 0], [0.04, 0.04, 0.025]);
  block(sword, gold, [0, 0.09, 0], [0.24, 0.035, 0.055]);
  const shape = new THREE.Shape();
  shape.moveTo(-0.047, 0.12);
  shape.lineTo(0.047, 0.12);
  shape.lineTo(0.035, 0.68);
  shape.lineTo(0, 0.8);
  shape.lineTo(-0.035, 0.68);
  shape.closePath();
  part(
    sword,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSize: 0.007,
      bevelThickness: 0.006,
      bevelSegments: 1,
      steps: 1,
    }),
    0xbac6c9,
    [0, 0, 0],
    [1, 1, 1],
    "metal",
  );
  tube(sword, 0x71838b, [0, 0.17, 0.021], [0, 0.64, 0.021], 0.005);
  parent.add(sword);
}

function shield(parent, cloth, gem, y) {
  const group = new THREE.Group();
  group.position.set(-0.31, y, 0.14);
  group.rotation.y = -0.3;
  const shape = new THREE.Shape();
  shape.moveTo(-0.16, 0.19);
  shape.lineTo(0.16, 0.19);
  shape.lineTo(0.14, -0.08);
  shape.quadraticCurveTo(0.09, -0.19, 0, -0.25);
  shape.quadraticCurveTo(-0.09, -0.19, -0.14, -0.08);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.008,
    bevelSegments: 2,
    steps: 1,
  });
  part(group, geometry, gold, [0, 0, 0], [1, 1, 1], "metal");
  part(group, geometry.clone(), cloth, [0, 0, 0.016], [0.87, 0.87, 1], "cloth");
  block(group, gold, [0, -0.005, 0.066], [0.028, 0.3, 0.014]);
  block(group, gold, [0, 0.06, 0.066], [0.2, 0.027, 0.014]);
  ellipsoid(group, gem, [0, 0.06, 0.081], [0.026, 0.031, 0.015]);
  for (const side of [-1, 1])
    for (const h of [-0.07, 0.14])
      ellipsoid(group, gold, [side * 0.12, h, 0.055], [0.009, 0.009, 0.008]);
  parent.add(group);
}

function horse(parent, cloth, dark, ivory) {
  const coat = ivory ? 0x554336 : 0x252a2c;
  ellipsoid(parent, coat, [0, 0.56, -0.03], [0.235, 0.26, 0.4], "skin");
  garment(parent, cloth, 0.31, 0.35, 0.27, 0.25, 14).scale.z = 1.55;
  for (const side of [-1, 1]) {
    for (const z of [-0.28, 0.22]) {
      const offset = z > 0 ? side * 0.03 : -side * 0.025;
      tube(
        parent,
        coat,
        [side * 0.155, 0.53, z],
        [side * 0.18, 0.25, z + offset],
        0.068,
        0.041,
        "skin",
      );
      tube(
        parent,
        coat,
        [side * 0.18, 0.25, z + offset],
        [side * 0.18, 0.095, z + 0.035],
        0.039,
        0.03,
        "skin",
      );
      ellipsoid(parent, leather, [side * 0.18, 0.08, z + 0.06], [0.058, 0.055, 0.085], "cloth");
    }
  }
  const neck = ellipsoid(parent, coat, [0, 0.84, 0.26], [0.15, 0.35, 0.19], "skin");
  neck.rotation.x = 0.3;
  ellipsoid(parent, coat, [0, 1.075, 0.4], [0.125, 0.17, 0.17], "skin");
  const muzzle = ellipsoid(parent, coat, [0, 0.98, 0.53], [0.103, 0.105, 0.18], "skin");
  muzzle.rotation.x = -0.4;
  for (const side of [-1, 1]) {
    const ear = part(
      parent,
      new THREE.ConeGeometry(0.045, 0.17, 12),
      coat,
      [side * 0.075, 1.25, 0.35],
      [0.65, 1, 0.6],
      "skin",
    );
    ear.rotation.z = side * -0.18;
    ellipsoid(parent, 0x111311, [side * 0.115, 1.09, 0.466], [0.012, 0.017, 0.016], "skin");
    tube(parent, gold, [side * 0.113, 1.08, 0.4], [side * 0.08, 0.98, 0.59], 0.009);
    tube(
      parent,
      leather,
      [side * 0.1, 1.03, 0.48],
      [side * 0.16, 1.1, -0.08],
      0.008,
      0.008,
      "cloth",
    );
  }
  for (let i = 0; i < 7; i++) {
    ellipsoid(parent, dark, [0, 1.12 - i * 0.065, 0.23 - i * 0.033], [0.049, 0.075, 0.08], "cloth");
  }
  const tail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.69, -0.39),
    new THREE.Vector3(0.03, 0.47, -0.53),
    new THREE.Vector3(0.1, 0.2, -0.5),
  ]);
  part(
    parent,
    new THREE.TubeGeometry(tail, 12, 0.035, 8, false),
    dark,
    [0, 0, 0],
    [1, 1, 1],
    "cloth",
  );
  ellipsoid(parent, leather, [0, 0.82, -0.12], [0.22, 0.055, 0.21], "cloth");
  for (const side of [-1, 1])
    tube(parent, gold, [side * 0.24, 0.48, -0.29], [side * 0.24, 0.48, 0.26], 0.01);
}

// Static detail is merged per material without merging the joints that combat moves.
function batch(joint, joints) {
  joint.updateWorldMatrix(true, true);
  const inverse = joint.matrixWorld.clone().invert();
  const byMaterial = new Map();
  function collect(group) {
    for (const child of [...group.children]) {
      if (joints.includes(child)) continue;
      if (child.isMesh) {
        const geometry = child.geometry.index
          ? child.geometry.toNonIndexed()
          : child.geometry.clone();
        geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld));
        if (!byMaterial.has(child.material)) byMaterial.set(child.material, []);
        byMaterial.get(child.material).push(geometry);
        child.geometry.dispose();
        group.remove(child);
      } else collect(child);
    }
  }
  collect(joint);
  for (const [material, geometries] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = mesh.receiveShadow = true;
    joint.add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }
}

/** Creates an original medieval figure with independent body, weapon-arm, and golem joints. */
export function createCharacter(type, color) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    arm = new THREE.Group();
  const ivory = color === "w";
  const cloth = ivory ? 0xd7c9aa : 0x7b1f27;
  const dark = ivory ? 0x827756 : 0x380e19;
  const gem = ivory ? 0x25675b : 0xc64c32;
  root.add(body);
  const joints = [root, body, arm];
  ring(root, gold, [0, 0.025, 0], 0.31, 0.012);
  if (type === "r") {
    const stone = ivory ? 0x9e9a87 : 0x66645f;
    for (let level = 0; level < 7; level++) {
      for (let i = 0; i < 8; i++) {
        const a = ((i + (level % 2) * 0.5) * Math.PI) / 4;
        const brick = block(
          body,
          level % 3 === i % 3 ? stone : stone - 0x080807,
          [Math.sin(a) * 0.255, 0.13 + level * 0.16, Math.cos(a) * 0.255],
          [0.208, 0.153, 0.135],
          "stone",
        );
        brick.rotation.y = a;
      }
    }
    for (const y of [0.075, 1.17]) {
      part(
        body,
        new THREE.CylinderGeometry(0.35, 0.36, 0.11, 32),
        stone,
        [0, y, 0],
        [1, 1, 1],
        "stone",
      );
      ring(body, gold, [0, y + 0.047, 0], 0.342, 0.009);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const merlon = block(
        body,
        stone,
        [Math.sin(a) * 0.29, 1.31, Math.cos(a) * 0.29],
        [0.16, 0.2, 0.16],
        "stone",
      );
      merlon.rotation.y = a;
    }
    block(body, 0x171c19, [0, 0.81, 0.325], [0.075, 0.22, 0.025], "cloth");
    shield(body, cloth, gem, 0.53);
    const golem = new THREE.Group();
    for (const side of [-1, 1]) {
      ellipsoid(golem, stone, [side * 0.39, 0.88, 0], [0.14, 0.16, 0.15], "stone");
      tube(golem, stone, [side * 0.42, 0.83, 0], [side * 0.47, 0.46, 0.07], 0.11, 0.095, "stone");
      block(golem, stone, [side * 0.47, 0.39, 0.1], [0.2, 0.19, 0.23], "stone");
      ellipsoid(golem, gem, [side * 0.1, 1.0, 0.33], [0.038, 0.02, 0.017]);
    }
    golem.visible = false;
    body.add(golem);
    root.userData.golem = golem;
    joints.push(golem);
  } else {
    const mounted = type === "n",
      royal = type === "q" || type === "k",
      robed = royal || type === "b";
    const waist = mounted ? 1.04 : 0.78;
    const shoulder = mounted ? 1.4 : robed ? 1.22 : 1.02;
    const head = mounted ? 1.65 : robed ? 1.47 : 1.25;
    if (mounted) horse(body, cloth, dark, ivory);
    for (const side of [-1, 1]) {
      const hip = [side * 0.115, waist, 0];
      const knee = [side * (mounted ? 0.275 : 0.12), mounted ? 0.83 : 0.45, mounted ? 0.07 : 0.02];
      const ankle = [side * (mounted ? 0.3 : 0.14), mounted ? 0.61 : 0.16, mounted ? -0.12 : 0];
      tube(body, leather, hip, knee, 0.083, 0.067, "cloth");
      ellipsoid(body, steel, knee, [0.082, 0.084, 0.075]);
      tube(body, steel, knee, ankle, 0.065, 0.045);
      ellipsoid(
        body,
        leather,
        [ankle[0], ankle[1] - 0.045, ankle[2] + 0.053],
        [0.077, 0.075, 0.14],
        "cloth",
      );
    }
    if (robed) {
      garment(body, cloth, 0.1, 0.76, 0.29, 0.135, 16);
      garment(body, cloth, 0.78, 0.43, 0.145, 0.2);
      ring(body, gold, [0, 0.12, 0], 0.28, 0.012).scale.z = 0.82;
      for (const side of [-1, 1]) {
        const stole = block(body, gold, [side * 0.1, 0.8, 0.17], [0.035, 0.92, 0.018], "cloth");
        stole.rotation.z = side * -0.07;
      }
      for (let i = 0; i < 7; i++) {
        ellipsoid(body, gem, [0, 0.75 - i * 0.075, 0.18 + i * 0.008], [0.012, 0.012, 0.009]);
      }
      const capeGeometry = new THREE.CylinderGeometry(
        0.19,
        0.32,
        1.02,
        32,
        10,
        true,
        Math.PI / 2,
        Math.PI,
      );
      const drape = capeGeometry.attributes.position;
      for (let i = 0; i < drape.count; i++) {
        const x = drape.getX(i),
          z = drape.getZ(i);
        const fold = 1 + Math.cos(Math.atan2(z, x) * 16) * 0.11;
        drape.setXYZ(i, x * fold, drape.getY(i), z * fold);
      }
      capeGeometry.computeVertexNormals();
      const cape = part(body, capeGeometry, dark, [0, 0.72, -0.04], [1, 1, 0.85], "cloth");
      cape.material.side = THREE.DoubleSide;
      for (const side of [-1, 1]) {
        tube(
          body,
          gold,
          [side * 0.175, 1.18, -0.09],
          [side * 0.3, 0.23, -0.09],
          0.009,
          0.009,
          "cloth",
        );
      }
      tube(body, gold, [0, 0.43, -0.27], [0, 0.83, -0.24], 0.013, 0.013, "cloth");
      tube(body, gold, [-0.09, 0.7, -0.26], [0.09, 0.7, -0.26], 0.013, 0.013, "cloth");
      if (royal) {
        for (let i = 0; i < 13; i++) {
          const a = (i * Math.PI) / 12;
          ellipsoid(
            body,
            0xe1d8bf,
            [Math.cos(a) * 0.225, 1.18, -Math.sin(a) * 0.15],
            [0.043, 0.053, 0.04],
            "cloth",
          );
        }
      }
    } else {
      garment(body, cloth, waist - 0.17, 0.24, 0.205, 0.145);
      ellipsoid(body, steel, [0, shoulder - 0.15, 0], [0.19, 0.24, 0.125]);
      block(body, cloth, [0, shoulder - 0.16, 0.124], [0.21, 0.33, 0.015], "cloth");
      block(body, gold, [0, shoulder - 0.15, 0.14], [0.018, 0.24, 0.013]);
      block(body, gold, [0, shoulder - 0.1, 0.14], [0.13, 0.02, 0.013]);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++)
          ellipsoid(body, steel, [side * 0.205, shoulder - i * 0.037, 0], [0.098, 0.055, 0.12]);
      }
    }
    ring(body, leather, [0, waist, 0], 0.165, 0.026).scale.z = 0.8;
    block(body, gold, [0, waist, 0.145], [0.065, 0.047, 0.02]);
    tube(body, skin, [0, shoulder + 0.04, 0], [0, head - 0.1, 0], 0.048, 0.048, "skin");
    face(body, head, type === "q", type === "k" || type === "b");
    for (const side of [-1, 1]) {
      const joint = side === 1 ? arm : body;
      if (side === 1) {
        arm.position.set(0.22, shoulder, 0);
        body.add(arm);
      }
      const x = side === 1 ? 0 : -0.23,
        y = side === 1 ? 0 : shoulder;
      tube(
        joint,
        robed ? cloth : steel,
        [x, y, 0],
        [x + side * 0.035, y - 0.17, 0.04],
        0.078,
        0.065,
        robed ? "cloth" : "metal",
      );
      ellipsoid(
        joint,
        robed ? cloth : steel,
        [x + side * 0.035, y - 0.17, 0.04],
        [0.066, 0.07, 0.066],
        robed ? "cloth" : "metal",
      );
      tube(
        joint,
        robed ? cloth : steel,
        [x + side * 0.035, y - 0.17, 0.04],
        [x, y - 0.29, 0.09],
        0.06,
        0.05,
        robed ? "cloth" : "metal",
      );
      ring(joint, gold, [x, y - 0.27, 0.083], 0.05, 0.008);
      ellipsoid(
        joint,
        robed ? skin : steel,
        [x, y - 0.31, 0.095],
        [0.046, 0.058, 0.045],
        robed ? "skin" : "metal",
      );
    }
    if (!robed) {
      const helm = part(
        body,
        new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.57),
        steel,
        [0, head + 0.035, 0],
        [0.124, 0.16, 0.12],
        "metal",
      );
      helm.rotation.x = -0.09;
      ring(body, gold, [0, head + 0.014, 0], 0.122, 0.009);
      for (const side of [-1, 1])
        block(body, steel, [side * 0.098, head - 0.055, 0.045], [0.032, 0.13, 0.08]);
      if (mounted) {
        block(body, steel, [0, head - 0.005, 0.118], [0.2, 0.11, 0.025]);
        block(body, 0x172125, [0, head + 0.019, 0.134], [0.16, 0.014, 0.009], "cloth");
        for (let i = -2; i <= 2; i++)
          block(body, 0x303c40, [i * 0.025, head - 0.035, 0.134], [0.008, 0.028, 0.008], "cloth");
        for (let i = 0; i < 6; i++)
          ellipsoid(
            body,
            cloth,
            [0, head + 0.2 + Math.sin(i * 0.5) * 0.07, -i * 0.05],
            [0.037, 0.08, 0.055],
            "cloth",
          );
      } else {
        ring(body, steel, [0, head - 0.01, 0], 0.15, 0.018);
        block(body, steel, [0, head - 0.005, 0.121], [0.02, 0.14, 0.018]);
      }
      shield(body, cloth, gem, shoulder - 0.2);
      blade(arm, mounted ? 0.86 : 0.72);
    } else if (type === "b") {
      const shape = new THREE.Shape();
      shape.moveTo(-0.135, 0);
      shape.lineTo(0.135, 0);
      shape.quadraticCurveTo(0.16, 0.18, 0, 0.36);
      shape.quadraticCurveTo(-0.16, 0.18, -0.135, 0);
      part(
        body,
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.1,
          bevelEnabled: true,
          bevelSize: 0.018,
          bevelThickness: 0.018,
          bevelSegments: 2,
          steps: 1,
        }),
        cloth,
        [0, head + 0.085, -0.05],
        [1, 1, 1],
        "cloth",
      );
      block(body, gold, [0, head + 0.23, 0.071], [0.022, 0.23, 0.014]);
      block(body, gold, [0, head + 0.23, 0.074], [0.12, 0.022, 0.016]);
      tube(arm, gold, [0, -0.87, 0.1], [0, 0.51, 0.1], 0.018);
      ring(arm, gold, [0.058, 0.59, 0.1], 0.085, 0.018, true);
      ellipsoid(arm, gem, [0.058, 0.59, 0.1], [0.03, 0.034, 0.03]);
    } else {
      coronet(body, head + 0.1, type === "k", gem);
      ellipsoid(body, gem, [0, shoulder - 0.02, 0.154], [0.035, 0.045, 0.023]);
      for (let i = -3; i <= 3; i++)
        ellipsoid(
          body,
          gold,
          [i * 0.04, shoulder - 0.04 - Math.cos(i * 0.3) * 0.06, 0.15],
          [0.016, 0.016, 0.012],
        );
      if (type === "k") blade(arm, 0.9);
      else {
        tube(arm, gold, [0, -0.55, 0.1], [0, 0.24, 0.1], 0.018);
        ellipsoid(arm, gem, [0, 0.29, 0.1], [0.064, 0.073, 0.064]);
        ring(arm, gold, [0, 0.29, 0.1], 0.067, 0.008);
      }
    }
    root.userData.arm = arm;
  }
  root.userData.body = body;
  root.userData.type = type;
  root.userData.color = color;
  root.rotation.y = ivory ? Math.PI : 0;
  for (const joint of joints) batch(joint, joints);
  return root;
}
