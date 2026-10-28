import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "@/game/world";
import { measureHeight, stylizeModel } from "@/game/models";
import { paint } from "./boatGeometry";

const WHALE_URL = "/models/animals/Whale.glb";
type Ripple = { x: number; z: number; born: number; size: number };
type Surface = { rings: Ripple[]; cursor: number };
function splash(pool: Surface, x: number, z: number, t: number, size = 1) {
  const ring = pool.rings[pool.cursor];
  pool.cursor = (pool.cursor + 1) % pool.rings.length;
  ring.x = x; ring.z = z; ring.born = t; ring.size = size;
}
function SplashRings({ pool }: { pool: Surface }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const geometry = new THREE.RingGeometry(0.8, 1, 24);
    geometry.rotateX(-Math.PI / 2);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(pool.rings.length), 1);
    geometry.setAttribute("instanceAlpha", alpha);
    const dummy = new THREE.Object3D();
    return { geometry, alpha, dummy };
  }, [pool]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    for (let i = 0; i < pool.rings.length; i++) {
      const r = pool.rings[i];
      const age = (clock.elapsedTime - r.born) / 0.8;
      const active = age >= 0 && age < 1;
      data.dummy.position.set(r.x, 0.035, r.z);
      data.dummy.scale.setScalar(active ? r.size * (0.25 + age * 1.8) : 0);
      data.dummy.updateMatrix();
      mesh.current.setMatrixAt(i, data.dummy.matrix);
      data.alpha.setX(i, active ? (1 - age) * 0.65 : 0);
    }
    data.alpha.needsUpdate = true;
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[data.geometry, undefined, pool.rings.length]} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide}
      vertexShader={`attribute float instanceAlpha; varying float fade;
        void main(){fade=instanceAlpha; gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`}
      fragmentShader={`varying float fade; void main(){gl_FragColor=vec4(0.94,0.98,1.,fade);}`} />
  </instancedMesh>;
}

/** Jittered, non-overlapping school slots keep breaches sparse (at most three). */
function FishSchools({ pool }: { pool: Surface }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    // little reef fish (nose +z): tinted body, pale belly, dark stripes, forked tail,
    // dorsal + side fins and big glossy eyes (instance colour tints the light parts)
    const parts: THREE.BufferGeometry[] = [];
    const tri = (pts: number[], c: string) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      g.computeVertexNormals();
      parts.push(paint(g, c));
    };
    const body = new THREE.SphereGeometry(1, 14, 10);
    body.scale(0.12, 0.17, 0.42);
    parts.push(paint(body, "#e6e6e6"));
    const belly = new THREE.SphereGeometry(1, 12, 8);
    belly.scale(0.1, 0.1, 0.34);
    belly.translate(0, -0.07, 0.03);
    parts.push(paint(belly, "#ffffff"));
    for (const z of [0.08, -0.12]) {
      const band = new THREE.CylinderGeometry(1, 1, 0.035, 14, 1, true);
      band.rotateX(Math.PI / 2);
      band.scale(0.124 - Math.abs(z) * 0.05, 0.172 - Math.abs(z) * 0.08, 1);
      band.translate(0, 0, z);
      parts.push(paint(band, "#3a3a46"));
    }
    // forked tail fin (two lobes) on a narrow stalk
    const stalk = new THREE.ConeGeometry(0.06, 0.16, 8);
    stalk.rotateX(-Math.PI / 2);
    stalk.translate(0, 0, -0.44);
    parts.push(paint(stalk, "#e6e6e6"));
    tri([0, 0, -0.48, 0, 0.17, -0.68, 0, 0.02, -0.6], "#f4f4f4");
    tri([0, 0, -0.48, 0, -0.02, -0.6, 0, -0.17, -0.68], "#f4f4f4");
    tri([0, 0, -0.48, 0, -0.17, -0.68, 0, 0.17, -0.68].slice(0, 9), "#f4f4f4");
    // dorsal and belly fins
    tri([0, 0.15, 0.12, 0, 0.27, -0.08, 0, 0.13, -0.2], "#f4f4f4");
    tri([0, -0.14, -0.05, 0, -0.22, -0.18, 0, -0.12, -0.22], "#f4f4f4");
    // pectoral fins + eyes on both sides
    for (const sd of [-1, 1]) {
      tri([sd * 0.1, -0.04, 0.14, sd * 0.24, -0.1, 0.0, sd * 0.1, -0.06, 0.02], "#f4f4f4");
      const eye = new THREE.SphereGeometry(0.042, 10, 8);
      eye.translate(sd * 0.085, 0.045, 0.27);
      parts.push(paint(eye, "#ffffff"));
      const pupil = new THREE.SphereGeometry(0.026, 8, 6);
      pupil.translate(sd * 0.112, 0.048, 0.285);
      parts.push(paint(pupil, "#0d0d12"));
    }
    // little mouth
    const mouth = new THREE.TorusGeometry(0.025, 0.008, 4, 8, Math.PI);
    mouth.rotateX(Math.PI / 2);
    mouth.translate(0, -0.02, 0.41);
    parts.push(paint(mouth, "#3a1f1f"));
    return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  }, []);
  const fish = useMemo(() => {
    const random = rng(91);
    const schools = [[205,-30,"#ff9f43"],[236,40,"#5ec8f0"],[190,70,"#ffd166"],[250,-70,"#f78fb3"],[170,-80,"#7bed9f"]] as const;
    return Array.from({ length: 90 }, (_, i) => {
      const s = schools[i % 5];
      return { cx: s[0], cz: s[1], color: new THREE.Color(s[2]), phase: random()*Math.PI*2,
        radius: 3+random()*6, speed: 0.24+random()*0.12, dir: random()<0.5?-1:1,
        slot: Math.floor(i/5)%3, offset: random()*2, wasAbove: false, last: -1 };
    });
  }, []);
  const dummy = useMemo(() => { const d = new THREE.Object3D(); d.rotation.order = "YXZ"; return d; }, []);
  useLayoutEffect(() => {
    if (!ref.current) return;
    fish.forEach((f,i) => ref.current!.setColorAt(i,f.color));
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [fish]);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      const school = i%5;
      const local = (t+school*3.1)%18;
      const slot = Math.floor(i/5);
      const u = local-(slot*0.9+f.offset*0.15);
      const jumping = u>=0 && u<1.6;
      // A ballistic arc begins and ends at cruising depth; crossings trigger rings.
      const y = jumping ? -1.4+6.5*u-4.0625*u*u : -1.4;
      const vy = jumping ? 6.5-8.125*u : 0;
      const a = t*f.speed*f.dir+f.phase;
      const x = f.cx+Math.cos(a)*f.radius+0.65*Math.sin(t*0.19+f.phase);
      const z = f.cz+Math.sin(a)*f.radius;
      const vx = -Math.sin(a)*f.radius*f.speed*f.dir+0.1235*Math.cos(t*0.19+f.phase);
      const vz = Math.cos(a)*f.radius*f.speed*f.dir;
      const above = y>=0;
      if (above!==f.wasAbove && f.last>=0 && t-f.last<0.25) splash(pool,x,z,t,0.45);
      f.wasAbove=above; f.last=t;
      dummy.position.set(x,y,z);
      dummy.rotation.set(-Math.atan2(vy,Math.hypot(vx,vz)),Math.atan2(vx,vz),0,"YXZ");
      dummy.scale.setScalar(y> -0.9 ? 1 : 0);
      dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={ref} args={[geometry,undefined,90]} frustumCulled={false}>
    <meshStandardMaterial vertexColors roughness={0.45} />
  </instancedMesh>;
}

/** Merged +Z-nosed cetacean / shark, with distinct horizontal / vertical flukes. */
function swimmerGeometry(shark: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const skin = shark ? "#59798b" : "#6d8fae";
  function ellipsoid(x: number,y: number,z: number,sx: number,sy: number,sz: number,color: string) {
    const g = new THREE.SphereGeometry(1,10,6); g.scale(sx,sy,sz); g.translate(x,y,z); parts.push(paint(g,color));
  }
  function fin(points: number[], color: string) {
    const g = new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    g.computeVertexNormals(); parts.push(paint(g,color));
  }
  ellipsoid(0,0,0,0.43,0.42,1.4,skin);
  ellipsoid(0,-0.2,0.1,0.37,0.26,1.16,"#dfe9ef");
  if (!shark) ellipsoid(0,-0.04,1.42,0.14,0.12,0.44,skin);
  // eyes with a catch-light, blowhole / gill slits, mouth line
  for (const side of [-1,1]) {
    const ez = shark ? 0.95 : 1.05;
    ellipsoid(side*0.3,0.1,ez,0.075,0.075,0.06,"#0d1014");
    ellipsoid(side*0.335,0.13,ez+0.03,0.025,0.025,0.02,"#ffffff");
    if (shark) for (let k=0;k<4;k++) ellipsoid(side*0.4,0.02,0.55-k*0.11,0.012,0.13,0.025,"#3c5563");
    // mouth: a darker crease along the snout
    ellipsoid(side*0.2,-0.14,shark?1.08:1.5,0.12,0.018,shark?0.28:0.3,shark?"#2f3d45":"#4b6680");
  }
  if (!shark) ellipsoid(0,0.4,0.55,0.05,0.02,0.05,"#3f5873");
  if (shark) for (let k=0;k<7;k++) ellipsoid(0,-0.25,1.0-k*0.02,0.16-k*0.008,0.012,0.012,"#ffffff");
  fin([0,0.27,0.35, 0,shark?1.2:0.85,-0.15, 0,0.25,-0.65],skin);
  for (const side of [-1,1]) {
    fin([side*0.2,-0.12,0.5, side*1.05,-0.3,-0.4, side*0.25,-0.18,-0.45],skin);
    if (shark) fin([0,0,-1.2, 0,side*(side>0?1:0.65),-1.95, 0,0,-1.8],skin);
    else fin([0,0,-1.2, side*0.85,0,-1.65, 0,0,-1.85],skin);
  }
  return mergeGeometries(parts,false)!;
}

function Swimmers({ pool }: { pool: Surface }) {
  const refs = useRef<(THREE.Mesh|null)[]>([]);
  const wakes = useRef<(THREE.Mesh|null)[]>([]);
  const geometries = useMemo(() => [swimmerGeometry(false),swimmerGeometry(true)],[]);
  const states = useMemo(() => Array.from({length:7},()=>({ above:false, last:-1 })),[]);
  const wakeGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute([
      -0.15,0,0, -0.9,0,-2.5, -0.7,0,-2.5,
      0.15,0,0, 0.7,0,-2.5, 0.9,0,-2.5],3)); return g;
  },[]);
  useFrame(({ clock }) => {
    const t=clock.elapsedTime;
    for (let i=0;i<7;i++) {
      const m=refs.current[i]; if (!m) continue;
      const shark=i>=5;
      const index=i-5;
      const a=shark?t*0.024+index*2:t*0.105-i*0.09;
      const rx=shark?34:22+i*0.65;
      const rz=shark?29:16+i*0.5;
      const speed=shark?0.024:0.105;
      const cx=shark?(index===0?250:230):200;
      const cz=shark?(index===0?-60:80):14;
      const vx=-Math.sin(a)*rx*speed;
      const vz=Math.cos(a)*rz*speed;
      let y=-0.78, vy=0;
      if (shark) {
        const cycle=(t+index*13)%27;
        // Smooth six-second dive; body and fin become fully hidden at depth.
        if (cycle>19 && cycle<26) {
          const u=(cycle-19)/7;
          y-=2.8*Math.sin(Math.PI*u)**2;
          vy=-2.8*Math.PI/7*Math.sin(2*Math.PI*u);
        }
      } else {
        const round=Math.floor(t/11);
        const count=1+round%3;
        const rank=(i-round%5+5)%5;
        const u=t%11-2-rank*0.48;
        y=-1.05;
        if (rank<count && u>=0 && u<1.5) {
          y=-1.05+8.4*u-5.6*u*u;
          vy=8.4-11.2*u;
        }
      }
      m.position.set(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz);
      m.rotation.set(-Math.atan2(vy,Math.hypot(vx,vz)),Math.atan2(vx,vz),0,"YXZ");
      m.visible=y> -0.9;
      const state=states[i]; const above=y>=0;
      if (!shark && above!==state.above && state.last>=0 && t-state.last<0.25)
        splash(pool,m.position.x,m.position.z,t,1);
      state.above=above; state.last=t;
      if (shark) {
        const wake=wakes.current[index];
        if (wake) {
          wake.visible=y> -0.9;
          wake.position.set(m.position.x,0.045,m.position.z);
          wake.rotation.y=m.rotation.y;
        }
      }
    }
  });
  return <group>
    {states.map((_,i)=><mesh key={i} ref={el=>{refs.current[i]=el;}} geometry={geometries[i>=5?1:0]}>
      <meshStandardMaterial vertexColors roughness={0.6} side={THREE.DoubleSide}/>
    </mesh>)}
    {[0,1].map(i=><mesh key={i} ref={el=>{wakes.current[i]=el;}} geometry={wakeGeometry}>
      <meshBasicMaterial color="#deeff5" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>)}
  </group>;
}

function Whale({ pool }: { pool: Surface }) {
  const { scene,animations }=useGLTF(WHALE_URL);
  const { model,scale,top,head,back }=useMemo(()=>{
    const model=clone(scene); stylizeModel(model,WHALE_URL);
    const scale=4.2/measureHeight(model,1);
    const box=new THREE.Box3().setFromObject(model);
    return { model,scale,top:box.max.y*scale, head:box.max.z*scale*0.65, back:box.min.z*scale };
  },[scene]);
  const root=useRef<THREE.Group>(null);
  const spout=useRef<THREE.Mesh>(null);
  const state=useRef({phase:-1,last:-1});
  const { actions }=useAnimations(animations,root);
  useLayoutEffect(()=>{
    const action=Object.values(actions)[0]; action?.reset().play();
    return ()=>{action?.stop();};
  },[actions]);
  useFrame(({clock})=>{
    const g=root.current; if (!g) return;
    const t=clock.elapsedTime;
    const a=t*0.012;
    const vx=-60*0.012*Math.sin(a), vz=90*0.012*Math.cos(a);
    const c=(t+12)%43;
    // Deep for 31s, rise over 3s, cruise for 7s, then fluke-out dive.
    let depth=-8,vy=0;
    let phase=0;
    if (c>=31 && c<34) {
      const u=(c-31)/3; depth=-8+8*u*u*(3-2*u); vy=16*u*(1-u); phase=1;
    } else if (c>=34 && c<41) {depth=0;phase=2;}
    else if (c>=41) {
      const u=(c-41)/2; depth=-8*u*u; vy=-8*u; phase=3;
    }
    const pitch=-Math.atan2(vy,Math.hypot(vx,vz));
    // Keep the back at waterline at rest. Nose-down rotation lifts the -Z flukes.
    g.position.set(285+60*Math.cos(a),-top+0.3+depth,10+90*Math.sin(a));
    g.rotation.set(pitch,Math.atan2(vx,vz),0,"YXZ");
    const tailHeight=g.position.y+top*Math.cos(pitch)-back*Math.sin(pitch);
    g.visible=depth> -0.9 || tailHeight> -0.9;
    if (phase!==state.current.phase && state.current.last>=0 && t-state.current.last<0.25 && (phase===2 || phase===3))
      splash(pool,g.position.x,g.position.z,t,2.5);
    state.current.phase=phase;state.current.last=t;
    if (spout.current) {
      const u=c-35;
      const pulse=u>=0 && u<0.9?u:u>=3 && u<3.9?u-3:-1;
      spout.current.visible=phase===2 && pulse>=0;
      if (pulse>=0) {
        spout.current.scale.set(0.5+pulse,1+3*pulse,0.5+pulse);
        (spout.current.material as THREE.MeshBasicMaterial).opacity=0.65*(1-pulse/0.9);
      }
    }
  });
  return <group ref={root}>
    <group scale={scale}><primitive object={model}/></group>
    <mesh ref={spout} position={[0,top+0.8,head]} visible={false}>
      <coneGeometry args={[0.35,1.6,8,1,true]}/>
      <meshBasicMaterial color="#f4fbff" transparent depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
  </group>;
}
/** Striped marker buoys bobbing around the bay (they mark the sailing area). */
function Buoys() {
  const ref = useRef<THREE.Group>(null);
  const spots = useMemo(() => {
    const out: [number, number][] = [];
    for (let k = 0; k < 10; k++) {
      const a = -1.1 + (k / 9) * 2.2;
      out.push([200 + Math.cos(a) * 70, Math.sin(a) * 110]);
    }
    return out;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ref.current?.children.forEach((c, i) => {
      c.position.y = Math.sin(t * 1.6 + i) * 0.12;
      c.rotation.z = Math.sin(t * 1.2 + i * 2) * 0.12;
    });
  });
  return (
    <group ref={ref}>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <group>
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.35, 0.5, 1.0, 10]} />
              <meshStandardMaterial color={i % 2 ? "#e2483c" : "#f4f1ea"} />
            </mesh>
            <mesh position={[0, 1.0, 0]}>
              <sphereGeometry args={[0.18, 10, 8]} />
              <meshStandardMaterial color="#ffe08a" emissive="#ffcf5a" emissiveIntensity={0.6} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

export function OceanLife() {
  const pool=useMemo<Surface>(()=>({cursor:0,rings:Array.from({length:24},()=>({x:0,z:0,born:-100,size:1}))}),[]);
  return <group>
    <FishSchools pool={pool}/><Swimmers pool={pool}/><Whale pool={pool}/>
    <SplashRings pool={pool}/><Buoys/>
  </group>;
}
useGLTF.preload(WHALE_URL);
