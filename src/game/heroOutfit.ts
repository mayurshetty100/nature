import * as THREE from "three";
import type { HeroLook } from "./characters";
import { alongY, attach, bonePos, glowMat, materialPoints, ringAround, type HeroRig } from "./heroRig";

/**
 * Outfit layer built on top of an explorer: long coat / hoodie / open jacket
 * with glowing radium lines, muscle build (biceps, delts, forearms, V-taper),
 * baggy jeans and the cool extras (chain, headphones, gauntlets, wings, orbs,
 * rocket pack). Everything is made in bind-pose world space and tied to the
 * bone it belongs to, so it follows every animation.
 */
export function addOutfit(m: THREE.Group, look: HeroLook, R: number, rig: HeroRig) {
  const torso = m.getObjectByName("Torso") ?? m.getObjectByName("Abdomen");
  if (!torso) return;
  const np = bonePos(m, "Neck") ?? bonePos(m, "Torso")!;
  const hipP = bonePos(m, "Hips") ?? bonePos(m, "Abdomen")!;
  // the upper-arm joints bound the chest (the shoulder bones sit well inside it)
  const shL = bonePos(m, "UpperArmL") ?? bonePos(m, "ShoulderL");
  const shR = bonePos(m, "UpperArmR") ?? bonePos(m, "ShoulderR");
  const halfSpan = shL && shR ? Math.abs(shL.x - shR.x) / 2 : R * 1.2;
  const cxw = (hipP.x + np.x) / 2;
  const build = look.build ?? 1;

  // a glowing material on the model itself (belt / obi band)
  if (look.glow) {
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (mat.name !== look.glow!.mat || !mat.emissive) continue;
        mat.emissive.set(look.glow!.color);
        mat.emissiveIntensity = 0.9;
        mat.userData.base = 0.9;
        (rig.glows ??= []).push(mat);
      }
    });
  }

  // torso footprint (ignoring the arms) from the shirt / blazer vertices
  const matName = look.jacket?.mat ?? "Shirt";
  const body = materialPoints(m, matName).filter((p) => p.y > hipP.y - R * 0.2 && p.y < np.y && Math.abs(p.x - cxw) < halfSpan * 0.8);
  const tb = body.length > 20 ? new THREE.Box3().setFromPoints(body) : new THREE.Box3(new THREE.Vector3(cxw - R, hipP.y, hipP.z - R * 0.6), new THREE.Vector3(cxw + R, np.y, hipP.z + R * 0.6));
  const tc = tb.getCenter(new THREE.Vector3());
  const rx = ((tb.max.x - tb.min.x) / 2) * 1.03;
  const rz = ((tb.max.z - tb.min.z) / 2) * 1.08;
  const y0 = tb.min.y - R * 0.08;
  const y1 = np.y - R * 0.05;
  const hgt = y1 - y0;
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const blob = new THREE.SphereGeometry(1, 16, 12);
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3 | [number, number, number], scl: [number, number, number], rot?: [number, number, number]) => {
    const o = new THREE.Mesh(geo, mat);
    if (Array.isArray(pos)) o.position.set(pos[0], pos[1], pos[2]);
    else o.position.copy(pos);
    o.scale.set(scl[0], scl[1], scl[2]);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  const j = look.jacket;
  const sleeveColor = j ? (look.outfit?.[j.mat] ?? j.color) : look.skin;
  const sleeve = new THREE.MeshStandardMaterial({ color: sleeveColor, roughness: 0.82 });
  const trim = j ? glowMat(rig, j.trim, 1.5) : null;

  if (j) {
    const shellMat = new THREE.MeshStandardMaterial({ color: j.color, roughness: 0.8, side: THREE.DoubleSide });
    const hoodie = j.style === "hoodie";
    const open = hoodie ? 0.07 : 0.42;
    // V-taper: broad shoulders narrowing to the waist
    const topR = 1 + 0.1 * build;
    const botR = 1.03 - 0.07 * build;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, 1, 24, 1, true, open, Math.PI * 2 - open * 2), shellMat);
    shell.scale.set(rx, hgt, rz);
    shell.position.set(tc.x, y0 + hgt / 2, tc.z);
    shell.castShadow = true;
    g.add(shell);
    // shoulder yoke so the shell reads closed on top
    add(g, new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), shellMat, [tc.x, y1 - R * 0.22, tc.z], [rx * topR, R * 0.55, rz * topR]);
    const frontZ = (f: number) => tc.z + rz * (botR + (topR - botR) * f) * Math.cos(open);
    // shirt seen through the front
    const inner = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: j.inner, roughness: 0.85 }));
    inner.scale.set(Math.sin(open) * rx * 2.05, hgt * 0.98, R * 0.04);
    inner.position.set(tc.x, y0 + hgt / 2, frontZ(0.5) - R * 0.02);
    g.add(inner);
    if (trim) {
      if (hoodie) {
        // zipper line + chest band + hem rib, all glowing
        add(g, box, trim, [tc.x, y0 + hgt / 2, frontZ(0.5) + R * 0.012], [R * 0.05, hgt, R * 0.04]);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), trim);
        const f = 0.68;
        const rr = botR + (topR - botR) * f + 0.012;
        band.scale.set(rx * rr, R * 0.07, rz * rr);
        band.position.set(tc.x, y0 + hgt * f, tc.z);
        g.add(band);
      } else {
        // glowing piping down both front edges
        for (const side of [-1, 1]) add(g, box, trim, [tc.x + side * Math.sin(open) * rx * 1.04, y0 + hgt / 2, frontZ(0.5) + R * 0.01], [R * 0.06, hgt, R * 0.06]);
      }
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(botR + 0.02, botR + 0.02, 1, 24, 1, true, open, Math.PI * 2 - open * 2), hoodie ? new THREE.MeshStandardMaterial({ color: new THREE.Color(j.color).multiplyScalar(0.7), roughness: 0.85, side: THREE.DoubleSide }) : trim);
      hem.scale.set(rx, R * (hoodie ? 0.16 : 0.06), rz);
      hem.position.set(tc.x, y0 + R * (hoodie ? 0.08 : 0.03), tc.z);
      g.add(hem);
    }
    if (hoodie) {
      // hood resting on the upper back, rim glowing, drawstrings and a kangaroo pocket
      add(g, blob, shellMat, [tc.x, y1 - R * 0.28, tc.z - rz * 1.02], [rx * 0.56, R * 0.48, R * 0.26]);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 22, Math.PI * 1.25), shellMat);
      rim.scale.set(rx * 0.62, rz * 0.82, R * 0.9);
      rim.rotation.set(Math.PI / 2, 0, Math.PI * 0.125 + Math.PI);
      rim.position.set(tc.x, y1 + R * 0.06, tc.z - R * 0.05);
      rim.castShadow = true;
      g.add(rim);
      if (trim) add(g, new THREE.TorusGeometry(1, 0.05, 6, 22, Math.PI), trim, [tc.x, y1 - R * 0.22, tc.z - rz * 1.12], [rx * 0.5, R * 0.42, R], [0, 0, 0]);
      const cord = new THREE.MeshStandardMaterial({ color: "#f2efe8", roughness: 0.7 });
      for (const side of [-1, 1]) {
        add(g, new THREE.CylinderGeometry(1, 1, 1, 6), cord, [tc.x + side * R * 0.17, y1 - R * 0.3, frontZ(0.85) + R * 0.03], [R * 0.025, R * 0.55, R * 0.025]);
        if (trim) add(g, blob, trim, [tc.x + side * R * 0.17, y1 - R * 0.6, frontZ(0.8) + R * 0.035], [R * 0.045, R * 0.07, R * 0.045]);
      }
      const pocket = new THREE.MeshStandardMaterial({ color: new THREE.Color(j.color).multiplyScalar(0.82), roughness: 0.85 });
      add(g, box, pocket, [tc.x, y0 + hgt * 0.2, frontZ(0.2) + R * 0.03], [rx * 1.05, hgt * 0.24, R * 0.05]);
      if (trim) add(g, box, trim, [tc.x, y0 + hgt * 0.32, frontZ(0.3) + R * 0.06], [rx * 1.05, R * 0.035, R * 0.03]);
    } else {
      // popped collar / lapels
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.95, 1, 18, 1, true, Math.PI * 0.25, Math.PI * 1.5), shellMat);
      collar.scale.set(rx * 0.62, R * 0.42, rz * 0.7);
      collar.rotation.y = Math.PI;
      collar.position.set(tc.x, y1 + R * 0.12, tc.z - R * 0.04);
      g.add(collar);
    }
    if (j.style === "long") addCoatSkirt(m, look, R, rig, { tc, rx, rz, y0, botR, open, shellMat, trim });
  }

  addPhysique(m, R, build, sleeve, trim);
  addGear(m, look, R, rig, g, { tc, rx, rz, y0, y1, hgt });
  if (g.children.length) attach(torso, g);
  addJeans(m, look, R, rig);
}

type CoatFrame = { tc: THREE.Vector3; rx: number; rz: number; y0: number; botR: number; open: number; shellMat: THREE.Material; trim: THREE.Material | null };

/** Knee-length coat tails hanging from the hips, flaring out, open at the front. */
function addCoatSkirt(m: THREE.Group, _look: HeroLook, R: number, rig: HeroRig, f: CoatFrame) {
  const hips = m.getObjectByName("Hips") ?? m.getObjectByName("Abdomen");
  const knee = bonePos(m, "LowerLegL");
  if (!hips || !knee) return;
  const top = f.y0 + R * 0.06;
  const bottom = knee.y - R * 0.32;
  const len = top - bottom;
  const flare = 1.16;
  const open = f.open + 0.12;
  const pivot = new THREE.Group();
  pivot.position.set(f.tc.x, top, f.tc.z);
  // wide enough at the hips to hang over both (baggy) legs
  const ul = bonePos(m, "UpperLegL");
  const hx = bonePos(m, "Hips")?.x ?? f.tc.x;
  const rxs = Math.max(f.rx * f.botR, ul ? Math.abs(ul.x - hx) + R * 0.42 : 0);
  const rzs = Math.max(f.rz * f.botR, R * 0.52);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1, flare, 1, 26, 1, true, open, Math.PI * 2 - open * 2), f.shellMat);
  skirt.scale.set(rxs, len, rzs * 1.05);
  skirt.position.y = -len / 2;
  skirt.castShadow = true;
  pivot.add(skirt);
  if (f.trim) {
    // glowing hem and front edges
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(flare + 0.01, flare + 0.01, 1, 26, 1, true, open, Math.PI * 2 - open * 2), f.trim);
    hem.scale.set(rxs, R * 0.06, rzs * 1.05);
    hem.position.y = -len + R * 0.03;
    pivot.add(hem);
    for (const side of [-1, 1]) {
      const a = new THREE.Vector3(side * Math.sin(open) * rxs, 0, Math.cos(open) * rzs * 1.05);
      const b = new THREE.Vector3(side * Math.sin(open) * rxs * flare, -len, Math.cos(open) * rzs * 1.05 * flare);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), f.trim);
      edge.scale.set(R * 0.05, a.distanceTo(b), R * 0.05);
      alongY(edge, a, b);
      pivot.add(edge);
    }
  }
  const g = new THREE.Group();
  g.add(pivot);
  attach(hips, g);
  rig.coat = pivot;
}

/** Biceps, delts and forearms bulked up (sleeve-coloured), plus glowing radium rings on the sleeves. */
function addPhysique(m: THREE.Group, R: number, build: number, sleeve: THREE.Material, trim: THREE.Material | null) {
  const blob = new THREE.SphereGeometry(1, 18, 12);
  const ring = new THREE.TorusGeometry(1, 0.09, 6, 20);
  for (const s of ["L", "R"] as const) {
    const upper = m.getObjectByName(`UpperArm${s}`);
    const lower = m.getObjectByName(`LowerArm${s}`);
    const ua = bonePos(m, `UpperArm${s}`);
    const la = bonePos(m, `LowerArm${s}`);
    const fi = bonePos(m, `Fist${s}`);
    if (!upper || !lower || !ua || !la || !fi) continue;
    const ul = ua.distanceTo(la);
    const fl = la.distanceTo(fi);
    const gu = new THREE.Group();
    // deltoid cap
    const delt = new THREE.Mesh(blob, sleeve);
    delt.scale.set(R * (0.27 + 0.05 * build), ul * 0.26, R * (0.27 + 0.05 * build));
    alongY(delt, ua, la, 0.08);
    delt.castShadow = true;
    gu.add(delt);
    // bicep (bulges forward) + tricep
    const bi = new THREE.Mesh(blob, sleeve);
    bi.scale.set(R * (0.25 + 0.05 * build), ul * 0.36, R * (0.26 + 0.07 * build));
    alongY(bi, ua, la, 0.46);
    bi.position.z += R * 0.04 * build;
    bi.castShadow = true;
    gu.add(bi);
    if (trim) {
      const r1 = new THREE.Mesh(ring, trim);
      r1.scale.setScalar(R * (0.27 + 0.04 * build));
      ringAround(r1, ua, la, 0.84);
      gu.add(r1);
    }
    attach(upper, gu);
    const gl = new THREE.Group();
    const fore = new THREE.Mesh(blob, sleeve);
    fore.scale.set(R * (0.24 + 0.04 * build), fl * 0.34, R * (0.24 + 0.04 * build));
    alongY(fore, la, fi, 0.32);
    fore.castShadow = true;
    gl.add(fore);
    if (trim) {
      const r2 = new THREE.Mesh(ring, trim);
      r2.scale.setScalar(R * (0.24 + 0.03 * build));
      ringAround(r2, la, fi, 0.72);
      gl.add(r2);
    }
    attach(lower, gl);
  }
}

/** Loose, stacked baggy jeans over both legs with a glowing side stitch. */
function addJeans(m: THREE.Group, look: HeroLook, R: number, rig: HeroRig) {
  const jn = look.jeans;
  if (!jn) return;
  const denim = new THREE.MeshStandardMaterial({ color: jn.color, roughness: 0.9 });
  const fold = new THREE.MeshStandardMaterial({ color: new THREE.Color(jn.color).multiplyScalar(0.78), roughness: 0.92 });
  const stitch = glowMat(rig, jn.stitch, 1.3);
  const hipX = bonePos(m, "Hips")?.x ?? 0;
  for (const s of ["L", "R"] as const) {
    const thigh = m.getObjectByName(`UpperLeg${s}`);
    const shin = m.getObjectByName(`LowerLeg${s}`);
    const ul = bonePos(m, `UpperLeg${s}`);
    const ll = bonePos(m, `LowerLeg${s}`);
    const ft = bonePos(m, `Foot${s}`);
    if (!thigh || !shin || !ul || !ll || !ft) continue;
    const out = Math.sign(ul.x - hipX) || 1;
    // thigh: from just above the hip joint to past the knee
    const tTop = ul.clone().lerp(ll, -0.18);
    const tBot = ul.clone().lerp(ll, 1.06);
    const gt = new THREE.Group();
    const th = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.47, R * 0.42, 1, 16), denim);
    th.scale.y = tTop.distanceTo(tBot);
    alongY(th, tBot, tTop);
    th.castShadow = true;
    gt.add(th);
    const sideT = new THREE.Mesh(new THREE.BoxGeometry(R * 0.04, 1, R * 0.06), stitch);
    sideT.scale.y = tTop.distanceTo(tBot) * 0.9;
    alongY(sideT, tBot, tTop);
    sideT.position.x += out * R * 0.45;
    gt.add(sideT);
    attach(thigh, gt);
    // shin: knee → just above the shoe, flaring and stacking at the ankle
    const ankleY = ft.y + R * 0.5;
    const k = (ll.y - ankleY) / Math.max(1e-3, ll.y - ft.y);
    const sTop = ll.clone().lerp(ft, -0.06);
    const sBot = ll.clone().lerp(ft, k);
    const gs = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.43, R * 0.48, 1, 16), denim);
    sh.scale.y = sTop.distanceTo(sBot);
    alongY(sh, sBot, sTop);
    sh.castShadow = true;
    gs.add(sh);
    for (const [at, r] of [
      [0.82, 0.5],
      [0.96, 0.52],
    ] as const) {
      const stack = new THREE.Mesh(new THREE.TorusGeometry(1, 0.16, 6, 18), fold);
      stack.scale.setScalar(R * r);
      ringAround(stack, sTop, sBot, at);
      gs.add(stack);
    }
    const sideS = new THREE.Mesh(new THREE.BoxGeometry(R * 0.04, 1, R * 0.06), stitch);
    sideS.scale.y = sTop.distanceTo(sBot) * 0.8;
    alongY(sideS, sBot, sTop);
    sideS.position.x += out * R * 0.46;
    gs.add(sideS);
    attach(shin, gs);
  }
}

type TorsoFrame = { tc: THREE.Vector3; rx: number; rz: number; y0: number; y1: number; hgt: number };

/** Cool extras — never stick weapons. */
function addGear(m: THREE.Group, look: HeroLook, R: number, rig: HeroRig, g: THREE.Group, f: TorsoFrame) {
  const gear = look.gear;
  const kinds = gear?.kinds ?? [];
  const { tc, rx, rz, y0, y1, hgt } = f;
  const blob = new THREE.SphereGeometry(1, 16, 12);
  const backZ = tc.z - rz * 1.12 - R * 0.08;

  if (gear && kinds.includes("chain")) {
    // heavy gold chain with a glowing pendant
    const gold = new THREE.MeshStandardMaterial({ color: gear.color, roughness: 0.3, metalness: 0.65 });
    const chain = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 28), gold);
    chain.scale.set(rx * 0.52, rz * 1.0, R * 0.9);
    chain.rotation.x = Math.PI / 2 - 0.55;
    chain.position.set(tc.x, y1 - R * 0.2, tc.z + rz * 0.35);
    chain.castShadow = true;
    g.add(chain);
    const pend = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), glowMat(rig, gear.glow, 1.6));
    pend.scale.set(R * 0.1, R * 0.14, R * 0.05);
    pend.position.set(tc.x, y1 - R * 0.62, tc.z + rz * 1.18);
    g.add(pend);
  }
  if (gear && kinds.includes("headphones")) {
    // DJ headphones resting round the neck
    const shell = new THREE.MeshStandardMaterial({ color: gear.color, roughness: 0.45, metalness: 0.2 });
    const glow = glowMat(rig, gear.glow, 1.8);
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 24, Math.PI * 1.15), shell);
    band.scale.set(R * 0.62, R * 0.62, R * 0.62);
    band.rotation.set(Math.PI / 2, 0, Math.PI + Math.PI * 0.075);
    band.position.set(tc.x, y1 + R * 0.02, tc.z - R * 0.02);
    band.castShadow = true;
    g.add(band);
    for (const side of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.26, R * 0.26, R * 0.16, 18), shell);
      cup.rotation.z = Math.PI / 2;
      cup.rotation.y = side * 0.5;
      cup.position.set(tc.x + side * R * 0.6, y1 - R * 0.02, tc.z + R * 0.22);
      cup.castShadow = true;
      g.add(cup);
      const face = new THREE.Mesh(new THREE.TorusGeometry(R * 0.18, R * 0.04, 6, 18), glow);
      face.rotation.y = Math.PI / 2 + side * 0.5;
      face.position.set(tc.x + side * R * 0.7, y1 - R * 0.02, tc.z + R * 0.22 + side * R * 0.05);
      g.add(face);
    }
  }
  if (gear && kinds.includes("gauntlets")) {
    // armoured fists with a glowing knuckle bar and core
    const shell = new THREE.MeshStandardMaterial({ color: gear.color, roughness: 0.5, metalness: 0.3 });
    const glow = glowMat(rig, gear.glow, 2);
    for (const s of ["L", "R"] as const) {
      const fist = m.getObjectByName(`Fist${s}`);
      const la = bonePos(m, `LowerArm${s}`);
      const fp = bonePos(m, `Fist${s}`);
      if (!fist || !la || !fp) continue;
      const dir = fp.clone().sub(la).normalize();
      const gg = new THREE.Group();
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.34, R * 0.5, 14), shell);
      alongY(cuff, fp.clone().addScaledVector(dir, -R * 0.4), fp.clone().addScaledVector(dir, R * 0.05));
      cuff.castShadow = true;
      gg.add(cuff);
      const knuckle = new THREE.Mesh(new THREE.TorusGeometry(R * 0.3, R * 0.06, 6, 18), glow);
      ringAround(knuckle, la, fp.clone().addScaledVector(dir, R * 0.04), 1);
      gg.add(knuckle);
      const core = new THREE.Mesh(blob, glow);
      core.scale.setScalar(R * 0.09);
      core.position.copy(fp).addScaledVector(dir, -R * 0.15).add(new THREE.Vector3(0, 0, R * 0.32));
      gg.add(core);
      attach(fist, gg);
    }
  }
  if (gear && kinds.includes("wings")) {
    // translucent sakura-petal wings that flutter
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.35, 0.25, 0.95, 0.75, 1, 1.15);
    shape.bezierCurveTo(0.7, 1.15, 0.25, 0.75, 0, 0);
    const big = new THREE.ShapeGeometry(shape, 12);
    const petal = new THREE.MeshBasicMaterial({ color: gear.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const vein = new THREE.MeshBasicMaterial({ color: gear.glow, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    for (const side of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(tc.x + side * R * 0.12, y0 + hgt * 0.72, backZ + R * 0.02);
      const upper = new THREE.Mesh(big, petal);
      upper.scale.set(side * R * 1.5, R * 1.25, 1);
      const lower = new THREE.Mesh(big, petal);
      lower.scale.set(side * R * 1.0, -R * 0.8, 1);
      const edge = new THREE.Mesh(big, vein);
      edge.scale.set(side * R * 1.45, R * 1.2, 1);
      edge.position.z = -0.002;
      (edge.material as THREE.MeshBasicMaterial).wireframe = false;
      const spine = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.02, R * 0.02, R * 1.5, 5), vein);
      spine.position.set(side * R * 0.55, R * 0.62, 0.003);
      spine.rotation.z = -side * 0.72;
      w.add(lower, upper, spine);
      w.rotation.y = -side * 0.55;
      w.userData.base = -side * 0.55;
      w.userData.side = side;
      g.add(w);
      (rig.wings ??= []).push(w);
    }
  }
  if (gear && kinds.includes("orbs")) {
    // three infinity orbs circling the explorer at chest height
    const glow = glowMat(rig, gear.glow, 2);
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(tc.x, y0 + hgt * (0.45 + i * 0.12), tc.z);
      pivot.userData.y = pivot.position.y;
      pivot.userData.R = R;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(R * 0.16, 14, 10), i === 1 ? glowMat(rig, gear.color, 2) : glow);
      orb.position.x = rx * 2.2;
      pivot.add(orb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.24, R * 0.02, 6, 20), new THREE.MeshBasicMaterial({ color: gear.glow, transparent: true, opacity: 0.5, depthWrite: false }));
      ring.position.x = rx * 2.2;
      ring.rotation.x = Math.PI / 2;
      pivot.add(ring);
      g.add(pivot);
      (rig.orbs ??= []).push(pivot);
    }
  }
  if (look.jetpack) {
    // compact rocket pack worn on the back; flames light up when it flies
    const jp = look.jetpack;
    const pack = new THREE.Group();
    pack.position.set(tc.x, y0 + hgt * 0.55, backZ - R * 0.1);
    const shell = new THREE.MeshStandardMaterial({ color: jp.color, roughness: 0.45, metalness: 0.4 });
    const fire = new THREE.MeshBasicMaterial({ color: jp.flame, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    const core = new THREE.MeshBasicMaterial({ color: "#fff4d6", transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(rx * 1.05, hgt * 0.55, R * 0.1), shell);
    pack.add(plate);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(rx * 0.7, R * 0.05, R * 0.02), glowMat(rig, jp.glow, 1.4));
    stripe.position.set(0, hgt * 0.12, -R * 0.06);
    pack.add(stripe);
    for (const side of [-1, 1]) {
      const tank = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.17, hgt * 0.36, 6, 12), shell);
      tank.position.set(side * rx * 0.36, 0, -R * 0.16);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.11, R * 0.16, R * 0.2, 12), glowMat(rig, jp.glow, 1.8));
      nozzle.position.set(side * rx * 0.36, -hgt * 0.31, -R * 0.16);
      const flame = new THREE.Group();
      flame.position.set(side * rx * 0.36, -hgt * 0.4, -R * 0.16);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(R * 0.15, R * 1.1, 10), fire);
      outer.rotation.x = Math.PI;
      outer.position.y = -R * 0.55;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(R * 0.07, R * 0.6, 8), core);
      inner.rotation.x = Math.PI;
      inner.position.y = -R * 0.3;
      flame.add(outer, inner);
      flame.visible = false;
      pack.add(tank, nozzle, flame);
      (rig.flames ??= []).push(flame);
    }
    pack.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !(o.parent && rig.flames?.includes(o.parent))) (o as THREE.Mesh).castShadow = true;
    });
    rig.jet = pack;
    g.add(pack);
  }
}
