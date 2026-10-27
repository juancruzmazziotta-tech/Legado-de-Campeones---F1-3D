import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CarSpecs } from '../types/game';

/**
 * Helper ready to load custom .glb / .gltf models whenever the user uploads them
 */
const modelCache = new Map<string, THREE.Group>();

export async function loadCustomGLTFModel(url: string): Promise<THREE.Group | null> {
  if (modelCache.has(url)) {
    return modelCache.get(url)!.clone(true);
  }

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        if (!root || root.children.length === 0) {
          resolve(null);
          return;
        }
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        modelCache.set(url, root);
        resolve(root.clone(true));
      },
      undefined,
      (err) => {
        console.warn('Custom GLTF model load error at:', url, err);
        resolve(null);
      }
    );
  });
}

/**
 * Split a mesh whose geometry spans across X < 0 and X > 0 into two separate meshes
 */
function splitIndexedMeshByX(mesh: THREE.Mesh): { left: THREE.Mesh; right: THREE.Mesh } {
  const geom = mesh.geometry;
  const posAttr = geom.attributes.position;
  const index = geom.index;

  const leftIndices: number[] = [];
  const rightIndices: number[] = [];

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      const ax = posAttr.getX(a);
      const bx = posAttr.getX(b);
      const cx = posAttr.getX(c);
      const midX = (ax + bx + cx) / 3;
      if (midX < 0) {
        leftIndices.push(a, b, c);
      } else {
        rightIndices.push(a, b, c);
      }
    }
  }

  const leftGeom = geom.clone();
  leftGeom.setIndex(leftIndices);
  const leftMesh = new THREE.Mesh(leftGeom, mesh.material);
  leftMesh.name = `${mesh.name}_left`;

  const rightGeom = geom.clone();
  rightGeom.setIndex(rightIndices);
  const rightMesh = new THREE.Mesh(rightGeom, mesh.material);
  rightMesh.name = `${mesh.name}_right`;

  return { left: leftMesh, right: rightMesh };
}

/**
 * Helper to pivot any wheel node in place around its local geometric center
 */
function rigWheelNodeInPlace(wheelNode: THREE.Object3D): { steerGroup: THREE.Group; rollGroup: THREE.Group } {
  wheelNode.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wheelNode);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const parent = wheelNode.parent || wheelNode;
  parent.worldToLocal(center);

  const steerGroup = new THREE.Group();
  steerGroup.name = `${wheelNode.name}_steer_hub`;
  steerGroup.position.copy(center);

  const rollGroup = new THREE.Group();
  rollGroup.name = `${wheelNode.name}_roll_axle`;
  steerGroup.add(rollGroup);

  parent.add(steerGroup);

  wheelNode.position.sub(center);
  rollGroup.add(wheelNode);

  return { steerGroup, rollGroup };
}

/**
 * Creates procedural textures without any external assets
 */
function createCarbonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, 64, 64);

  ctx.fillStyle = '#2d2d2d';
  for (let i = 0; i < 64; i += 8) {
    for (let j = 0; j < 64; j += 8) {
      if ((i / 8 + j / 8) % 2 === 0) {
        ctx.fillRect(i, j, 8, 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTireSidewallTexture(colorStripe: string = '#E10600'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, 256, 256);

  // Outer ring
  ctx.strokeStyle = colorStripe;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(128, 128, 105, 0, Math.PI * 2);
  ctx.stroke();

  // Branding text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P ZERO', 128, 55);
  ctx.fillText('F1', 128, 205);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface F1CarController {
  carGroup: THREE.Group;
  steeringWheelMesh: THREE.Group;
  cockpitCameraAnchor: THREE.Object3D;
  chaseCameraAnchor: THREE.Object3D;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  rearRainLight: THREE.Mesh;
  drsFlap: THREE.Mesh;
  inspectableParts: THREE.Object3D[];
  setCockpitView: (isCockpit: boolean) => void;
  update: (steerAngle: number, speedKmh: number, delta: number, isBraking: boolean, drsActive: boolean) => void;
  dispose: () => void;
}

export function buildF1Car(specs: CarSpecs): F1CarController {
  const carGroup = new THREE.Group();
  carGroup.name = `F1_${specs.name}`;

  const carbonTex = createCarbonTexture();
  const tireTex = createTireSidewallTexture(specs.accentColor);

  // Materials
  const isMatte = specs.id === 'f1_2022';
  const bodyPaintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(specs.primaryColor),
    roughness: isMatte ? 0.55 : 0.18,
    metalness: isMatte ? 0.1 : 0.45,
  });

  const secondaryPaintMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(specs.secondaryColor),
    roughness: 0.3,
    metalness: 0.4,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(specs.accentColor),
    roughness: 0.25,
    metalness: 0.5,
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    map: carbonTex,
    color: new THREE.Color('#222222'),
    roughness: 0.7,
    metalness: 0.2,
  });

  const tireRubberMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a1a1a'),
    roughness: 0.9,
    metalness: 0.05,
  });

  const tireWallMaterial = new THREE.MeshStandardMaterial({
    map: tireTex,
    roughness: 0.8,
    metalness: 0.1,
  });

  const haloMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(specs.secondaryColor),
    roughness: 0.25,
    metalness: 0.85,
  });

  const inspectableParts: THREE.Object3D[] = [];

  // ==========================================
  // 1. MAIN CHASSIS & MONOCOQUE
  // ==========================================
  const chassisGroup = new THREE.Group();

  // Nose cone (tapered)
  const noseGeom = new THREE.ConeGeometry(0.35, 2.2, 8);
  noseGeom.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeom, bodyPaintMaterial);
  noseMesh.position.set(0, 0.42, 1.8);
  noseMesh.scale.set(0.7, 0.45, 1.0);
  noseMesh.castShadow = true;
  chassisGroup.add(noseMesh);

  // Center Cockpit Tub
  const tubGeom = new THREE.BoxGeometry(0.75, 0.48, 2.0);
  const tubMesh = new THREE.Mesh(tubGeom, bodyPaintMaterial);
  tubMesh.position.set(0, 0.46, 0.3);
  tubMesh.castShadow = true;
  chassisGroup.add(tubMesh);

  // Engine cover & shark fin
  const engineCoverGeom = new THREE.BoxGeometry(0.68, 0.65, 1.7);
  const engineCover = new THREE.Mesh(engineCoverGeom, secondaryPaintMaterial);
  engineCover.position.set(0, 0.6, -0.9);
  engineCover.scale.set(0.85, 0.7, 1.0);
  engineCover.castShadow = true;
  chassisGroup.add(engineCover);

  // Shark Fin (Upper Spine)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, 0.45);
  finShape.lineTo(-1.3, 0.25);
  finShape.lineTo(-1.3, 0);
  finShape.closePath();
  const finGeom = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
  finGeom.center();
  const finMesh = new THREE.Mesh(finGeom, accentMaterial);
  finMesh.rotation.y = Math.PI / 2;
  finMesh.position.set(0, 0.95, -1.0);
  chassisGroup.add(finMesh);

  // Sidepods (Left & Right)
  const sidepodGeom = new THREE.BoxGeometry(0.38, 0.38, 1.6);
  const sidepodLeft = new THREE.Mesh(sidepodGeom, bodyPaintMaterial);
  sidepodLeft.position.set(-0.55, 0.4, -0.2);
  sidepodLeft.rotation.y = -0.05;
  sidepodLeft.castShadow = true;
  chassisGroup.add(sidepodLeft);

  const sidepodRight = new THREE.Mesh(sidepodGeom, bodyPaintMaterial);
  sidepodRight.position.set(0.55, 0.4, -0.2);
  sidepodRight.rotation.y = 0.05;
  sidepodRight.castShadow = true;
  chassisGroup.add(sidepodRight);

  // Underfloor / Floor Plank
  const floorGeom = new THREE.BoxGeometry(1.5, 0.06, 3.8);
  const floorMesh = new THREE.Mesh(floorGeom, carbonMaterial);
  floorMesh.position.set(0, 0.18, 0.1);
  floorMesh.receiveShadow = true;
  chassisGroup.add(floorMesh);

  // Rear Diffuser
  const diffuserGeom = new THREE.BoxGeometry(1.2, 0.22, 0.6);
  const diffuserMesh = new THREE.Mesh(diffuserGeom, carbonMaterial);
  diffuserMesh.position.set(0, 0.28, -2.0);
  diffuserMesh.rotation.x = 0.3;
  chassisGroup.add(diffuserMesh);

  // Tag Power Unit
  engineCover.userData = {
    partName: 'Unidad de Potencia V6 Turbo Híbrida',
    specs: specs.powerUnit,
    description: 'Motor de combustión interna 1.6L sobrealimentado acoplado a MGU-K y MGU-H con 1000+ HP y 50% de eficiencia térmica.',
  };
  inspectableParts.push(engineCover);

  carGroup.add(chassisGroup);

  // ==========================================
  // 2. FRONT WING (Composite Assembly)
  // ==========================================
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.22, 2.7);

  // Main Plane
  const fwMainGeom = new THREE.BoxGeometry(1.85, 0.04, 0.35);
  const fwMainMesh = new THREE.Mesh(fwMainGeom, carbonMaterial);
  fwMainMesh.castShadow = true;
  frontWingGroup.add(fwMainMesh);

  // Upper Flap (Livery color)
  const fwUpperGeom = new THREE.BoxGeometry(1.7, 0.03, 0.2);
  const fwUpperMesh = new THREE.Mesh(fwUpperGeom, accentMaterial);
  fwUpperMesh.position.set(0, 0.07, -0.05);
  fwUpperMesh.rotation.x = -0.15;
  frontWingGroup.add(fwUpperMesh);

  // Endplates (Left & Right)
  const endplateGeom = new THREE.BoxGeometry(0.04, 0.22, 0.45);
  const fwEndplateLeft = new THREE.Mesh(endplateGeom, bodyPaintMaterial);
  fwEndplateLeft.position.set(-0.93, 0.08, 0);
  frontWingGroup.add(fwEndplateLeft);

  const fwEndplateRight = new THREE.Mesh(endplateGeom, bodyPaintMaterial);
  fwEndplateRight.position.set(0.93, 0.08, 0);
  frontWingGroup.add(fwEndplateRight);

  fwMainMesh.userData = {
    partName: 'Alerón Delantero Complejo',
    specs: 'Efecto Outwash & Downforce',
    description: 'Genera el 35% de la sustentación negativa delantera y canaliza el flujo turbulento lejos de las ruedas hacia los pontones.',
  };
  inspectableParts.push(fwMainMesh);

  carGroup.add(frontWingGroup);

  // ==========================================
  // 3. REAR WING WITH DRS FLAP
  // ==========================================
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 0.95, -2.15);

  // Twin vertical pillars
  const pillarGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.65, 8);
  const pillarLeft = new THREE.Mesh(pillarGeom, carbonMaterial);
  pillarLeft.position.set(-0.25, -0.25, 0);
  rearWingGroup.add(pillarLeft);
  const pillarRight = new THREE.Mesh(pillarGeom, carbonMaterial);
  pillarRight.position.set(0.25, -0.25, 0);
  rearWingGroup.add(pillarRight);

  // Endplates
  const rwEndplateGeom = new THREE.BoxGeometry(0.03, 0.5, 0.45);
  const rwEndplateLeft = new THREE.Mesh(rwEndplateGeom, bodyPaintMaterial);
  rwEndplateLeft.position.set(-0.65, 0, 0);
  rearWingGroup.add(rwEndplateLeft);

  const rwEndplateRight = new THREE.Mesh(rwEndplateGeom, bodyPaintMaterial);
  rwEndplateRight.position.set(0.65, 0, 0);
  rearWingGroup.add(rwEndplateRight);

  // Lower Main Plane
  const rwMainGeom = new THREE.BoxGeometry(1.28, 0.04, 0.32);
  const rwMainMesh = new THREE.Mesh(rwMainGeom, secondaryPaintMaterial);
  rwMainMesh.position.set(0, -0.06, 0);
  rearWingGroup.add(rwMainMesh);

  // DRS Flap (Upper movable wing)
  const drsGeom = new THREE.BoxGeometry(1.26, 0.03, 0.22);
  const drsFlap = new THREE.Mesh(drsGeom, accentMaterial);
  drsFlap.position.set(0, 0.12, -0.04);
  drsFlap.rotation.x = -0.2;
  rearWingGroup.add(drsFlap);

  rwMainMesh.userData = {
    partName: 'Alerón Trasero con DRS',
    specs: 'Apertura de Flap Hidráulico',
    description: 'Genera carga aerodinámica posterior. Cuando el DRS se activa en zonas autorizadas, el flap superior se eleva reduciendo el arrastre y otorgando +20 km/h.',
  };
  inspectableParts.push(rwMainMesh);

  carGroup.add(rearWingGroup);

  // Rear Rain Safety LED
  const rainLightGeom = new THREE.BoxGeometry(0.12, 0.08, 0.05);
  const rainLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const rearRainLight = new THREE.Mesh(rainLightGeom, rainLightMat);
  rearRainLight.position.set(0, 0.35, -2.25);
  carGroup.add(rearRainLight);

  // ==========================================
  // 4. TITANIUM HALO COCKPIT STRUCTURE
  // ==========================================
  const haloGroup = new THREE.Group();
  haloGroup.position.set(0, 0.76, 0.35);

  // Center Front Strut
  const centerStrutGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.38, 8);
  const centerStrut = new THREE.Mesh(centerStrutGeom, haloMaterial);
  centerStrut.position.set(0, -0.04, 0.45);
  centerStrut.rotation.x = -0.3;
  haloGroup.add(centerStrut);

  // Curved Ring (Half Torus)
  const haloRingGeom = new THREE.TorusGeometry(0.28, 0.025, 8, 24, Math.PI);
  const haloRing = new THREE.Mesh(haloRingGeom, haloMaterial);
  haloRing.rotation.x = Math.PI / 2;
  haloRing.rotation.z = Math.PI;
  haloRing.position.set(0, 0.1, 0.16);
  haloRing.scale.set(1.0, 1.4, 1.0);
  haloGroup.add(haloRing);

  // Halo Rear Mounts
  const mountGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6);
  const mountLeft = new THREE.Mesh(mountGeom, haloMaterial);
  mountLeft.position.set(-0.27, 0.02, -0.2);
  mountLeft.rotation.z = -0.2;
  haloGroup.add(mountLeft);

  const mountRight = new THREE.Mesh(mountGeom, haloMaterial);
  mountRight.position.set(0.27, 0.02, -0.2);
  mountRight.rotation.z = 0.2;
  haloGroup.add(mountRight);

  haloRing.userData = {
    partName: 'Halo de Titanio Grado 5',
    specs: 'Resistencia: 125 kiloNewtons (12 Toneladas)',
    description: 'Elemento obligatorio de seguridad que protege la cabeza del piloto contra impactos directos de objetos grandes y ruedas desprendidas.',
  };
  inspectableParts.push(haloRing);

  carGroup.add(haloGroup);

  // ==========================================
  // 5. COCKPIT INTERIOR & STEERING WHEEL
  // ==========================================
  const cockpitGroup = new THREE.Group();
  cockpitGroup.position.set(0, 0.62, 0.42);

  // Driver Helmet Group (Toggled off in cockpit view so it does not block the camera!)
  const helmetGroup = new THREE.Group();
  const helmetGeom = new THREE.SphereGeometry(0.14, 16, 16);
  const helmetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(specs.accentColor),
    roughness: 0.2,
    metalness: 0.6,
  });
  const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
  helmetMesh.position.set(0, 0.08, -0.15);
  helmetMesh.scale.set(0.9, 1.0, 1.1);
  helmetGroup.add(helmetMesh);

  // Helmet Visor (Dark Chrome)
  const visorGeom = new THREE.BoxGeometry(0.18, 0.05, 0.08);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.05,
    metalness: 0.95,
  });
  const visorMesh = new THREE.Mesh(visorGeom, visorMat);
  visorMesh.position.set(0, 0.08, -0.05);
  helmetGroup.add(visorMesh);
  cockpitGroup.add(helmetGroup);

  // Carbon F1 Steering Wheel
  const steeringWheelMesh = new THREE.Group();
  steeringWheelMesh.position.set(0, -0.02, 0.2);

  // Wheel Main Body (Butterfly yoke)
  const wheelBodyGeom = new THREE.BoxGeometry(0.28, 0.16, 0.03);
  const wheelBody = new THREE.Mesh(wheelBodyGeom, carbonMaterial);
  steeringWheelMesh.add(wheelBody);

  // Wheel Grips (Left / Right)
  const gripGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8);
  const gripLeft = new THREE.Mesh(gripGeom, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
  gripLeft.position.set(-0.13, 0, 0);
  steeringWheelMesh.add(gripLeft);

  const gripRight = new THREE.Mesh(gripGeom, new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
  gripRight.position.set(0.13, 0, 0);
  steeringWheelMesh.add(gripRight);

  // LCD Telemetry Display Screen (Faces backward toward the driver looking forward!)
  const screenGeom = new THREE.PlaneGeometry(0.12, 0.07);
  screenGeom.rotateY(Math.PI); // Orient plane to face driver at -Z
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x001824 });
  const screenMesh = new THREE.Mesh(screenGeom, screenMat);
  screenMesh.position.set(0, 0.02, -0.018);
  steeringWheelMesh.add(screenMesh);

  // Shift LEDs bar (Faces driver)
  const ledBarGeom = new THREE.BoxGeometry(0.12, 0.012, 0.01);
  const ledBarMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });
  const ledBarMesh = new THREE.Mesh(ledBarGeom, ledBarMat);
  ledBarMesh.position.set(0, 0.065, -0.018);
  steeringWheelMesh.add(ledBarMesh);

  cockpitGroup.add(steeringWheelMesh);
  carGroup.add(cockpitGroup);

  // Side Mirrors
  const mirrorGeom = new THREE.BoxGeometry(0.1, 0.05, 0.04);
  const mirrorLeft = new THREE.Mesh(mirrorGeom, bodyPaintMaterial);
  mirrorLeft.position.set(-0.46, 0.65, 0.65);
  carGroup.add(mirrorLeft);

  const mirrorRight = new THREE.Mesh(mirrorGeom, bodyPaintMaterial);
  mirrorRight.position.set(0.46, 0.65, 0.65);
  carGroup.add(mirrorRight);

  // ==========================================
  // 6. WHEELS & SUSPENSION WISHBONES
  // ==========================================
  function createWheel(isFront: boolean): { wheelGroup: THREE.Group; tireMesh: THREE.Mesh } {
    const wheelGroup = new THREE.Group();

    // Wheel dimensions: F1 rear wheels are wider (0.42m) than front (0.32m)
    const width = isFront ? 0.32 : 0.42;
    const radius = 0.34;

    const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeom.rotateZ(Math.PI / 2);

    // Multi-material cylinder: sides with Pirelli livery, tread with rubber
    const materials = [
      tireRubberMaterial, // outer tread
      tireWallMaterial,   // sidewall 1
      tireWallMaterial,   // sidewall 2
    ];

    const tireMesh = new THREE.Mesh(tireGeom, materials);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Center Rim Cap / Wheel Cover (18 inch aero covers)
    const rimGeom = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.01, 16);
    rimGeom.rotateZ(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.3,
      metalness: 0.7,
    });
    const rimMesh = new THREE.Mesh(rimGeom, rimMat);
    wheelGroup.add(rimMesh);

    // Center Nut (Red or Blue per F1 regulation)
    const nutGeom = new THREE.CylinderGeometry(0.04, 0.04, width + 0.04, 8);
    nutGeom.rotateZ(Math.PI / 2);
    const nutMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, metalness: 0.9, roughness: 0.2 });
    const nutMesh = new THREE.Mesh(nutGeom, nutMat);
    wheelGroup.add(nutMesh);

    return { wheelGroup, tireMesh };
  }

  // Create 4 Wheels
  const fl = createWheel(true);
  const fr = createWheel(true);
  const rl = createWheel(false);
  const rr = createWheel(false);

  // Positions
  // Front axle: Z = 1.6, X = ±0.88, Y = 0.34
  // Rear axle: Z = -1.5, X = ±0.92, Y = 0.34
  const frontLeftWheel = new THREE.Group();
  frontLeftWheel.position.set(-0.88, 0.34, 1.6);
  frontLeftWheel.add(fl.wheelGroup);

  const frontRightWheel = new THREE.Group();
  frontRightWheel.position.set(0.88, 0.34, 1.6);
  frontRightWheel.add(fr.wheelGroup);

  const rearLeftWheel = new THREE.Group();
  rearLeftWheel.position.set(-0.94, 0.34, -1.5);
  rearLeftWheel.add(rl.wheelGroup);

  const rearRightWheel = new THREE.Group();
  rearRightWheel.position.set(0.94, 0.34, -1.5);
  rearRightWheel.add(rr.wheelGroup);

  carGroup.add(frontLeftWheel);
  carGroup.add(frontRightWheel);
  carGroup.add(rearLeftWheel);
  carGroup.add(rearRightWheel);

  // Suspension wishbone struts (Diagonal carbon tubes)
  function createSuspensionWishbones(originX: number, originZ: number, targetX: number, targetZ: number) {
    const wishboneGeom = new THREE.CylinderGeometry(0.016, 0.016, 1, 6);
    const wishboneUpper = new THREE.Mesh(wishboneGeom, carbonMaterial);
    const wishboneLower = new THREE.Mesh(wishboneGeom, carbonMaterial);

    const start = new THREE.Vector3(originX, 0.42, originZ);
    const end = new THREE.Vector3(targetX, 0.34, targetZ);
    const mid = start.clone().lerp(end, 0.5);
    const len = start.distanceTo(end);

    wishboneUpper.scale.set(1, len, 1);
    wishboneUpper.position.copy(mid);
    wishboneUpper.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());

    const startLow = new THREE.Vector3(originX, 0.22, originZ);
    const endLow = new THREE.Vector3(targetX, 0.24, targetZ);
    const midLow = startLow.clone().lerp(endLow, 0.5);
    const lenLow = startLow.distanceTo(endLow);

    wishboneLower.scale.set(1, lenLow, 1);
    wishboneLower.position.copy(midLow);
    wishboneLower.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endLow.clone().sub(startLow).normalize());

    carGroup.add(wishboneUpper);
    carGroup.add(wishboneLower);
  }

  // Front suspension
  createSuspensionWishbones(-0.35, 1.5, -0.72, 1.6);
  createSuspensionWishbones(0.35, 1.5, 0.72, 1.6);
  // Rear suspension
  createSuspensionWishbones(-0.35, -1.3, -0.76, -1.5);
  createSuspensionWishbones(0.35, -1.3, 0.76, -1.5);

  fl.tireMesh.userData = {
    partName: 'Neumáticos Slicks Pirelli P-Zero',
    specs: 'Compuesto C3/C4 de Alta Adherencia (18 Pulgadas)',
    description: 'Neumático liso sin dibujo diseñado para maximizar el contacto con el asfalto. Opera óptimamente entre 95°C y 110°C.',
  };
  inspectableParts.push(fl.tireMesh);

  // ==========================================
  // 7. CAMERA ANCHORS
  // ==========================================
  // Cockpit camera: elevated at true driver eye line above steering wheel with clear forward vision
  const cockpitCameraAnchor = new THREE.Object3D();
  cockpitCameraAnchor.position.set(0, 1.06, 0.40);
  carGroup.add(cockpitCameraAnchor);

  // Chase camera: behind and slightly above the car
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 2.3, -5.6);
  carGroup.add(chaseCameraAnchor);

  // Contact shadow fake plane right under the car
  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = 128;
  contactCanvas.height = 256;
  const ctx = contactCanvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 128, 20, 64, 128, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.4)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  const shadowTex = new THREE.CanvasTexture(contactCanvas);
  const shadowGeom = new THREE.PlaneGeometry(2.4, 5.0);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02; // grounded flush
  carGroup.add(shadowMesh);

  // References to rigged GLTF wheels for in-place steering & rolling
  const gltfWheels: {
    flSteer?: THREE.Group;
    flRoll?: THREE.Group;
    frSteer?: THREE.Group;
    frRoll?: THREE.Group;
    rearRoll?: THREE.Group;
    rlRoll?: THREE.Group;
    rrRoll?: THREE.Group;
  } = {};

  // Resolve target GLB url: support both F1 2022 generic and 2004 Ferrari F2004
  let targetGlbUrl = specs.customModelUrl || specs.glbFile;
  if (!targetGlbUrl) {
    targetGlbUrl = specs.id === 'ferrari_2004' ? '/assets/2004_ferrari_f2004.glb' : '/assets/f1_2022_generic.glb';
  } else if (!targetGlbUrl.startsWith('/') && !targetGlbUrl.startsWith('http')) {
    targetGlbUrl = `/assets/${targetGlbUrl}`;
  }

  loadCustomGLTFModel(targetGlbUrl).then((customModel) => {
    if (customModel) {
      // Hide all placeholder procedural meshes completely so only the authentic 3D model shows
      for (const child of carGroup.children) {
        if (child !== shadowMesh && child !== cockpitCameraAnchor && child !== chaseCameraAnchor) {
          child.visible = false;
        }
      }

      const isFerrari2004 = specs.id === 'ferrari_2004' || targetGlbUrl.includes('ferrari') || targetGlbUrl.includes('2004');
      const wrapper = new THREE.Group();
      wrapper.name = isFerrari2004 ? 'Ferrari_F2004_GLTF' : 'F1_2022_GLTF';

      if (isFerrari2004) {
        // Ferrari F2004: Raw length is 22.45m along Z, center is at (0.02, 2.63, 7.75)
        customModel.position.set(-0.02, 0, -7.75);
        wrapper.add(customModel);

        // Scale down to authentic ~4.60m F1 dimensions
        const scaleFactor = 4.60 / 22.45; // ~0.2049
        wrapper.scale.setScalar(scaleFactor);
        wrapper.position.set(0, 0, 0);

        // Find individual wheel nodes and rig each in-place around its exact hub center
        customModel.traverse((node) => {
          if (node.name === 'f2004_wheel_fl_1') {
            const rig = rigWheelNodeInPlace(node);
            gltfWheels.flSteer = rig.steerGroup;
            gltfWheels.flRoll = rig.rollGroup;
          } else if (node.name === 'f2004_wheel_fr_2') {
            const rig = rigWheelNodeInPlace(node);
            gltfWheels.frSteer = rig.steerGroup;
            gltfWheels.frRoll = rig.rollGroup;
          } else if (node.name === 'f2004_wheel_rl_3') {
            const rig = rigWheelNodeInPlace(node);
            gltfWheels.rlRoll = rig.rollGroup;
          } else if (node.name === 'f2004_wheel_rr_4') {
            const rig = rigWheelNodeInPlace(node);
            gltfWheels.rrRoll = rig.rollGroup;
          }
        });
      } else {
        // F1 2022 Generic: Raw length is 7.46m, center is at (0, 0.76, 0)
        customModel.position.set(0, -0.05, 0);
        wrapper.add(customModel);

        // Scale down to ~5.25m F1 length
        const scaleFactor = 5.25 / 7.46; // ~0.7037
        wrapper.scale.setScalar(scaleFactor);
        wrapper.position.set(0, 0, 0);

        let obj18: THREE.Mesh | null = null;
        let obj19: THREE.Mesh | null = null;
        let obj21: THREE.Mesh | null = null;
        let obj22: THREE.Mesh | null = null;

        customModel.traverse((node) => {
          if (node.name === 'Object_18' && (node as THREE.Mesh).isMesh) obj18 = node as THREE.Mesh;
          if (node.name === 'Object_19' && (node as THREE.Mesh).isMesh) obj19 = node as THREE.Mesh;
          if (node.name === 'Object_21' && (node as THREE.Mesh).isMesh) obj21 = node as THREE.Mesh;
          if (node.name === 'Object_22' && (node as THREE.Mesh).isMesh) obj22 = node as THREE.Mesh;
        });

        if (obj18 && obj21 && obj22) {
          const { left: leftTire, right: rightTire } = splitIndexedMeshByX(obj18);
          const parent = obj18.parent!;
          obj18.visible = false;

          // Front Left Wheel (Hub at X = -0.926, Y = 0.475, Z = 1.917)
          const flCenter = new THREE.Vector3(-0.926, 0.475, 1.917);
          const flSteer = new THREE.Group();
          flSteer.name = 'F2022_FL_Steer';
          flSteer.position.copy(flCenter);
          const flRoll = new THREE.Group();
          flRoll.name = 'F2022_FL_Roll';
          flSteer.add(flRoll);
          parent.add(flSteer);

          leftTire.position.sub(flCenter);
          flRoll.add(leftTire);
          obj22.position.sub(flCenter);
          flRoll.add(obj22);

          gltfWheels.flSteer = flSteer;
          gltfWheels.flRoll = flRoll;

          // Front Right Wheel (Hub at X = 0.926, Y = 0.475, Z = 1.917)
          const frCenter = new THREE.Vector3(0.926, 0.475, 1.917);
          const frSteer = new THREE.Group();
          frSteer.name = 'F2022_FR_Steer';
          frSteer.position.copy(frCenter);
          const frRoll = new THREE.Group();
          frRoll.name = 'F2022_FR_Roll';
          frSteer.add(frRoll);
          parent.add(frSteer);

          rightTire.position.sub(frCenter);
          frRoll.add(rightTire);
          obj21.position.sub(frCenter);
          frRoll.add(obj21);

          gltfWheels.frSteer = frSteer;
          gltfWheels.frRoll = frRoll;

          // Rear Wheels (Rear axle at Z = -2.720, Y = 0.476)
          if (obj19) {
            const rearCenter = new THREE.Vector3(0, 0.476, -2.720);
            const rearRoll = new THREE.Group();
            rearRoll.name = 'F2022_Rear_Roll';
            rearRoll.position.copy(rearCenter);
            parent.add(rearRoll);

            obj19.position.sub(rearCenter);
            rearRoll.add(obj19);

            gltfWheels.rearRoll = rearRoll;
          }
        }

        // Team livery tinting for AI rivals
        if (specs.id.startsWith('rival_')) {
          const teamColor = new THREE.Color(specs.primaryColor);
          customModel.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && child.name === 'Object_6') {
              const mesh = child as THREE.Mesh;
              if (mesh.material) {
                mesh.material = (mesh.material as THREE.Material).clone();
                (mesh.material as THREE.MeshStandardMaterial).color = teamColor;
              }
            }
          });
        }
      }

      carGroup.add(wrapper);
    }
  });

  // Toggle helmet in cockpit view so driver's own helmet never blocks sight
  const setCockpitView = (isCockpit: boolean) => {
    helmetGroup.visible = !isCockpit;
  };

  // Animation Update function
  let wheelRotationAngle = 0;
  let rainLightTimer = 0;

  const update = (steerAngle: number, speedKmh: number, delta: number, isBraking: boolean, drsActive: boolean) => {
    // 1. Front wheels steering: wheels accompany vehicle turn
    const maxSteerRad = 0.44; // ~25 degrees of steering lock
    // Target steer: negative angle turns the wheel to the right (positive X)
    const targetSteer = -steerAngle * maxSteerRad;

    if (gltfWheels.flSteer && gltfWheels.frSteer) {
      gltfWheels.flSteer.rotation.y = THREE.MathUtils.damp(gltfWheels.flSteer.rotation.y, targetSteer, 18, delta);
      gltfWheels.frSteer.rotation.y = THREE.MathUtils.damp(gltfWheels.frSteer.rotation.y, targetSteer, 18, delta);
    }

    // Procedural fallback steering
    frontLeftWheel.rotation.y = THREE.MathUtils.damp(frontLeftWheel.rotation.y, targetSteer, 16, delta);
    frontRightWheel.rotation.y = THREE.MathUtils.damp(frontRightWheel.rotation.y, targetSteer, 16, delta);

    // 2. Wheel rolling forward proportional to speed
    const speedMps = (speedKmh * 1000) / 3600;
    const wheelRollDelta = (speedMps / 0.33) * delta;
    wheelRotationAngle += wheelRollDelta;

    if (gltfWheels.flRoll) gltfWheels.flRoll.rotation.x += wheelRollDelta;
    if (gltfWheels.frRoll) gltfWheels.frRoll.rotation.x += wheelRollDelta;
    if (gltfWheels.rearRoll) gltfWheels.rearRoll.rotation.x += wheelRollDelta;
    if (gltfWheels.rlRoll) gltfWheels.rlRoll.rotation.x += wheelRollDelta;
    if (gltfWheels.rrRoll) gltfWheels.rrRoll.rotation.x += wheelRollDelta;

    fl.wheelGroup.rotation.x = wheelRotationAngle;
    fr.wheelGroup.rotation.x = wheelRotationAngle;
    rl.wheelGroup.rotation.x = wheelRotationAngle;
    rr.wheelGroup.rotation.x = wheelRotationAngle;

    // Cockpit steering wheel rotation
    steeringWheelMesh.rotation.z = THREE.MathUtils.damp(steeringWheelMesh.rotation.z, -steerAngle * 1.5, 16, delta);

    // DRS flap animation
    const targetDrsRot = drsActive ? 0.35 : -0.2;
    drsFlap.rotation.x = THREE.MathUtils.damp(drsFlap.rotation.x, targetDrsRot, 12, delta);

    // Rear rain/safety light blinking when braking or high speed
    rainLightTimer += delta;
    if (isBraking) {
      const isLit = Math.sin(rainLightTimer * 20) > 0;
      (rearRainLight.material as THREE.MeshBasicMaterial).color.setHex(isLit ? 0xff0022 : 0x440000);
    } else {
      (rearRainLight.material as THREE.MeshBasicMaterial).color.setHex(0x330000);
    }
  };

  const dispose = () => {
    carbonTex.dispose();
    tireTex.dispose();
    shadowTex.dispose();
  };

  return {
    carGroup,
    steeringWheelMesh,
    cockpitCameraAnchor,
    chaseCameraAnchor,
    frontLeftWheel,
    frontRightWheel,
    rearLeftWheel,
    rearRightWheel,
    rearRainLight,
    drsFlap,
    inspectableParts,
    setCockpitView,
    update,
    dispose,
  };
}
