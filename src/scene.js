import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createCharacter } from "./characters.js";

const gold = 0xb99a53;
const materials = new Map();
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const ramp = (t, from, to) => THREE.MathUtils.smoothstep(t, from, to);

function material(color, metalness = 0.15) {
  const key = `${color}-${metalness}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness, flatShading: true }),
    );
  return materials.get(key);
}

function mesh(parent, geometry, color, x = 0, y = 0, z = 0, metalness) {
  const item = new THREE.Mesh(geometry, material(color, metalness));
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function box(parent, color, x, y, z, w, h, d) {
  return mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
}

function cylinder(parent, color, x, y, z, top, bottom, height, sides = 10) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, sides), color, x, y, z);
}

function sphere(parent, color, x, y, z, radius) {
  return mesh(parent, new THREE.SphereGeometry(radius, 10, 8), color, x, y, z);
}

function stoneTexture(light) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = light ? "#b9ae98" : "#48494a";
  ctx.fillRect(0, 0, 128, 128);
  let seed = light ? 17 : 93;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(${random() > 0.5 ? "255,244,215" : "20,29,21"},${random() * 0.1})`;
    ctx.fillRect(random() * 128, random() * 128, random() * 7, 1);
  }
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(random() * 128, random() * 128);
    ctx.bezierCurveTo(
      random() * 128,
      random() * 128,
      random() * 128,
      random() * 128,
      random() * 128,
      random() * 128,
    );
    ctx.strokeStyle = light ? "#655e451c" : "#a3aa8b20";
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Builds and renders the chess stage. Board state remains owned by the chess rules engine. */
export function createStage(canvas, onSquare) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment).texture;
  scene.environmentIntensity = 0.5;
  environment.dispose();
  pmrem.dispose();
  const camera = new THREE.OrthographicCamera(-7, 7, 6, -6, 0.1, 100);
  let flipped = false;
  const court = new THREE.Group();
  scene.add(court);
  scene.add(new THREE.HemisphereLight(0xdce2e8, 0x352c23, 1.5));
  const sun = new THREE.DirectionalLight(0xffe1b4, 2.8);
  sun.position.set(-3, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.1, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xc1cddd, 1.8);
  rim.position.set(4, 5, -6);
  scene.add(rim);
  const floor = mesh(scene, new THREE.PlaneGeometry(200, 200), 0x0c120f, 0, -0.55, 0);
  floor.rotation.x = -Math.PI / 2;
  box(court, 0x393c31, 0, -0.3, 0, 9.1, 0.45, 9.1);
  box(court, 0x71664a, 0, -0.07, 0, 8.85, 0.12, 8.85);
  box(court, 0x34392f, 0, 0.005, 0, 8.62, 0.08, 8.62);
  for (const z of [-4.4, 4.4]) box(court, gold, 0, 0.02, z, 8.85, 0.035, 0.035);
  for (const x of [-4.4, 4.4]) box(court, gold, x, 0.02, 0, 0.035, 0.035, 8.85);
  for (let x = -4; x <= 4; x++) {
    for (const z of [-4.555, 4.555]) {
      box(court, 0x555544, x, -0.31, z, 0.015, 0.36, 0.008);
    }
  }
  const textures = [stoneTexture(false), stoneTexture(true)];
  const tiles = [];
  const labels = new THREE.Group();
  court.add(labels);
  function label(text, x, z, rotation = 0) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#b5a273";
    ctx.font = "32px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(text, 32, 43);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    m.rotation.set(-Math.PI / 2, 0, rotation);
    m.position.set(x, 0.066, z);
    labels.add(m);
  }
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = `${"abcdefgh"[file]}${8 - rank}`;
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.987, 0.1, 0.987),
        new THREE.MeshStandardMaterial({
          map: textures[(file + rank) % 2 ? 0 : 1],
          roughness: 0.87,
          metalness: 0.05,
        }),
      );
      tile.position.set(file - 3.5, 0.06, rank - 3.5);
      tile.receiveShadow = true;
      tile.userData.square = square;
      court.add(tile);
      tiles.push(tile);
    }
    label("abcdefgh"[rank], rank - 3.5, 4.21);
    label(String(8 - rank), -4.2, rank - 3.5);
  }
  for (const x of [-4.36, 4.36])
    for (const z of [-4.36, 4.36]) {
      cylinder(court, gold, x, 0.07, z, 0.11, 0.11, 0.09, 8);
      sphere(court, 0xe3c382, x, 0.13, z, 0.045);
    }
  // Stone braziers frame the board without competing with the playable squares.
  for (const x of [-5.1, 5.1]) {
    cylinder(scene, 0x4a4c3b, x, -0.15, -3.8, 0.29, 0.4, 0.65, 8);
    cylinder(scene, gold, x, 0.2, -3.8, 0.4, 0.25, 0.18, 8);
    const flame = mesh(scene, new THREE.ConeGeometry(0.16, 0.53, 7), 0xeea23b, x, 0.52, -3.8);
    flame.material = new THREE.MeshBasicMaterial({ color: 0xffbc58 });
    const glow = new THREE.PointLight(0xffb84c, 4, 5);
    glow.position.set(x, 0.9, -3.8);
    scene.add(glow);
  }
  const pieces = new Map();
  const markers = new THREE.Group();
  court.add(markers);
  const effects = new THREE.Group();
  scene.add(effects);
  const debrisMaterials = [0x353d47, 0xe2dbca].map(
    (color) => new THREE.MeshBasicMaterial({ color }),
  );
  const impactLight = new THREE.PointLight(0xffd693, 0, 5);
  scene.add(impactLight);
  const squarePosition = (square) => v(square.charCodeAt(0) - 100.5, 0.12, 4.5 - Number(square[1]));
  const buttons = new Map();
  const overlay = document.querySelector("#squares");
  for (const tile of tiles) {
    const button = document.createElement("button");
    button.className = "square-hit";
    button.dataset.square = tile.userData.square;
    button.setAttribute("aria-label", tile.userData.square);
    button.onclick = () => onSquare(tile.userData.square);
    overlay.append(button);
    buttons.set(tile.userData.square, button);
  }
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects([...pieces.values(), ...tiles], true)[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.square) object = object.parent;
      if (object) onSquare(object.userData.square);
    }
  });
  let animation = null;
  let dirty = true;
  let lastFrame = 0;
  let renderedAt = null;
  function resize() {
    dirty = true;
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const halfWidth = aspect < 1 ? 6.9 : Math.max(6.6, aspect * 4.65);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfWidth / aspect;
    camera.bottom = -halfWidth / aspect;
    camera.position.set(0, 26, flipped ? -15 : 15);
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const [square, button] of buttons) {
      const p = squarePosition(square).project(camera);
      button.style.left = `${((p.x + 1) * width) / 2}px`;
      button.style.top = `${((-p.y + 1) * height) / 2}px`;
      button.style.width = `${Math.max(22, (width / (halfWidth * 2)) * 0.63)}px`;
      button.style.height = `${Math.max(15, (width / (halfWidth * 2)) * 0.38)}px`;
    }
  }
  new ResizeObserver(resize).observe(canvas);
  function disposeGroup(group) {
    group.traverse((item) => {
      if (item.geometry) item.geometry.dispose();
    });
  }
  function sync(board) {
    dirty = true;
    for (const piece of pieces.values()) {
      court.remove(piece);
      disposeGroup(piece);
    }
    pieces.clear();
    for (const row of board)
      for (const item of row)
        if (item) {
          const figure = createCharacter(item.type, item.color);
          figure.position.copy(squarePosition(item.square));
          figure.userData.square = item.square;
          pieces.set(item.square, figure);
          court.add(figure);
        }
    for (const [square, button] of buttons) {
      const piece = pieces.get(square);
      const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
      button.setAttribute(
        "aria-label",
        `${square}${piece ? ` ${piece.userData.color === "w" ? "Ivory" : "Crimson"} ${names[piece.userData.type]}` : " empty"}`,
      );
      button.dataset.piece = piece ? `${piece.userData.color}${piece.userData.type}` : "";
    }
  }
  function highlight(selected, moves, last) {
    dirty = true;
    for (const child of [...markers.children]) {
      markers.remove(child);
      child.geometry.dispose();
      child.material.dispose();
    }
    function mark(square, color, ring) {
      const geometry = ring
        ? new THREE.RingGeometry(0.34, 0.39, 32)
        : new THREE.CircleGeometry(0.095, 20);
      const item = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }),
      );
      item.rotation.x = -Math.PI / 2;
      item.position.copy(squarePosition(square));
      item.position.y = 0.125;
      markers.add(item);
    }
    for (const tile of tiles) {
      const sq = tile.userData.square;
      tile.material.color.set(
        sq === selected ? 0xffdd87 : last?.includes(sq) ? 0xd5bd71 : 0xffffff,
      );
      buttons.get(sq).setAttribute("aria-pressed", String(sq === selected));
      buttons.get(sq).dataset.legal = String(moves.some((move) => move.to === sq));
    }
    for (const move of moves)
      mark(move.to, move.captured ? 0xe99166 : 0xe4d79f, Boolean(move.captured));
    if (selected) mark(selected, 0xffdf8f, true);
  }
  function animateMove(move, duration, onImpact) {
    return new Promise((resolve) => {
      const attacker = pieces.get(move.from);
      const victimSquare = move.flags.includes("e") ? `${move.to[0]}${move.from[1]}` : move.to;
      const victim = pieces.get(victimSquare);
      const cinematic = Boolean(victim && duration > 1000);
      const direction = squarePosition(victimSquare).sub(squarePosition(move.from)).normalize();
      const endpoint = squarePosition(victimSquare).addScaledVector(direction, -1.25);
      animation = {
        move,
        attacker,
        victim,
        cinematic,
        direction,
        endpoint,
        victimPosition: squarePosition(victimSquare),
        from: squarePosition(move.from),
        to: squarePosition(move.to),
        start: performance.now(),
        duration,
        resolve,
        onImpact,
        impacted: false,
        cameraPosition: camera.position.clone(),
        halfWidth: camera.right,
      };
      if (cinematic) {
        for (const piece of pieces.values())
          piece.visible = piece === attacker || piece === victim;
        attacker.rotation.y = Math.atan2(
          victim.position.x - attacker.position.x,
          victim.position.z - attacker.position.z,
        );
        victim.rotation.y = attacker.rotation.y + Math.PI;
        const victimCenter = victim.position.clone().add(v(0, 0.8, 0));
        impactLight.position.copy(victimCenter);
        // Fixed trajectories keep debris deterministic and independent of the render frame rate.
        for (let i = 0; i < 28; i++) {
          const angle = i * 2.39996;
          const fragment = new THREE.Mesh(
            new THREE.TetrahedronGeometry(0.035 + (i % 5) * 0.014),
            debrisMaterials[move.color === "w" ? 0 : 1],
          );
          fragment.userData.velocity = v(
            Math.cos(angle) * (0.65 + (i % 4) * 0.3),
            1.8 + (i % 6) * 0.32,
            Math.sin(angle) * (0.65 + (i % 4) * 0.3),
          );
          fragment.visible = false;
          effects.add(fragment);
        }
      }
    });
  }
  function tick(now) {
    requestAnimationFrame(tick);
    // Lower pixel fill only when the preceding draw stalls, preserving detail on faster GPUs.
    // ponytail: resolution only drops; add recovery if transient stalls blur otherwise-fast GPUs.
    if (renderedAt !== null && now - renderedAt > 100 && renderer.getPixelRatio() > 0.75) {
      renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() / 2));
      dirty = true;
    }
    renderedAt = null;
    if ((!animation && !dirty) || now - lastFrame < 1000 / 30) return;
    lastFrame = now;
    if (animation) {
      const a = animation;
      const t = Math.min(1, (now - a.start) / a.duration);
      const attacker = a.attacker;
      if (attacker) {
        if (a.cinematic) {
          const approach = ramp(t, 0, 0.19);
          const windup = ramp(t, 0.2, 0.4);
          const strike = ramp(t, 0.4, 0.48);
          const recover = ramp(t, 0.56, 0.74);
          const swing = windup * (1 - recover);
          const type = a.move.piece;
          const magic = type === "q" || type === "b";
          attacker.position.lerpVectors(a.from, a.endpoint, approach);
          attacker.position.addScaledVector(a.direction, strike * (1 - recover) * 0.36);
          if (attacker.userData.arm)
            attacker.userData.arm.rotation.x = magic
              ? -swing * 1.2
              : -windup * 2.3 + strike * 3.2 - recover * 0.9;
          attacker.userData.body.rotation.x = type === "n"
            ? -windup * 0.3 + strike * 0.45 - recover * 0.15
            : -windup * 0.12 + strike * 0.25 - recover * 0.13;
          if (type === "r") {
            attacker.userData.golem.visible = t > 0.17 && t < 0.83;
            attacker.scale.y = 1 + swing * 0.22;
            attacker.userData.golem.rotation.x = -windup * 0.8 + strike * 1.5 - recover * 0.7;
          }
          if (magic) {
            attacker.position.y = 0.12 + swing * 0.16;
            impactLight.intensity = t < 0.48 ? windup * 3 : 0;
          }
          const guard = ramp(t, 0.23, 0.4) * (1 - ramp(t, 0.48, 0.6));
          a.victim.userData.body.rotation.x = -guard * 0.16;
          if (a.victim.userData.arm) a.victim.userData.arm.rotation.x = -guard * 0.65;
          if (t >= 0.48) {
            if (!a.impacted) {
              a.onImpact();
              a.impacted = true;
            }
            const defeat = ramp(t, 0.48, 0.67);
            a.victim.rotation.x = defeat * 1.25;
            a.victim.position.copy(a.victimPosition).addScaledVector(a.direction, defeat * 0.28);
            a.victim.scale.setScalar(Math.max(0.001, 1 - defeat));
            a.victim.visible = t < 0.67;
            const elapsed = (t - 0.48) * a.duration / 1000;
            impactLight.intensity = Math.max(0, 18 * (1 - elapsed / 0.28));
            for (const fragment of effects.children) {
              fragment.visible = elapsed < 1.1;
              fragment.position.copy(impactLight.position)
                .addScaledVector(fragment.userData.velocity, elapsed);
              fragment.position.y = Math.max(0.16, fragment.position.y - 3.2 * elapsed ** 2);
              fragment.rotation.set(elapsed * 3, elapsed * 5, elapsed * 2);
              fragment.scale.setScalar(1 - ramp(elapsed, 0.65, 1.1));
            }
          }
          const settle = ramp(t, 0.83, 1);
          attacker.position.lerp(a.to, settle);
          // Frame the two figures in profile, then return to the exact board view for input.
          const focus = a.endpoint.clone().lerp(a.victimPosition, 0.5).add(v(0, 0.9, 0));
          const side = v(-a.direction.z, 0, a.direction.x);
          const closePosition = focus.clone().addScaledVector(side, 7)
            .addScaledVector(a.direction, -2).add(v(0, 3.2, 0));
          const zoom = ramp(t, 0.06, 0.22) * (1 - ramp(t, 0.8, 1));
          camera.position.lerpVectors(a.cameraPosition, closePosition, zoom);
          camera.lookAt(v(0, 0.1, 0).lerp(focus, zoom));
          const width = THREE.MathUtils.lerp(a.halfWidth, 2.5, zoom);
          const aspect = canvas.clientWidth / canvas.clientHeight;
          camera.left = -width;
          camera.right = width;
          camera.top = width / aspect;
          camera.bottom = -width / aspect;
          camera.updateProjectionMatrix();
        } else {
          const smooth = t * t * (3 - 2 * t);
          attacker.position.lerpVectors(a.from, a.to, smooth);
          attacker.position.y += Math.sin(t * Math.PI) * (a.move.piece === "n" ? 0.8 : 0.09);
          attacker.userData.body.rotation.z = Math.sin(t * Math.PI * 6) * 0.035;
        }
      }
      if (t === 1) {
        animation = null;
        impactLight.intensity = 0;
        disposeGroup(effects);
        effects.clear();
        resize();
        a.resolve();
      }
    }
    renderedAt = now;
    renderer.render(scene, camera);
    dirty = false;
  }
  requestAnimationFrame(tick);
  resize();
  return {
    sync,
    highlight,
    animateMove,
    /** Ends the current cinematic on the next frame without applying the chess move again. */
    skipBattle() {
      if (animation?.cinematic) animation.start = performance.now() - animation.duration;
    },
    flip() {
      flipped = !flipped;
      resize();
    },
    get busy() {
      return Boolean(animation);
    },
  };
}
