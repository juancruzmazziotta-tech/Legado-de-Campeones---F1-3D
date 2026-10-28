import * as THREE from 'three';
import { CircuitId } from '../types/game';
import { loadCustomGLTFModel } from './carModel';
import { CIRCUITS_DATA } from '../data/f1Data';
import { IMOLA_CONTROL_POINTS, SPA_CONTROL_POINTS } from './circuitSplines';

export interface CircuitTrack {
  group: THREE.Group;
  spline: THREE.CatmullRomCurve3;
  trackWidth: number;
  totalLength: number;
  startPosition: THREE.Vector3;
  startTangent: THREE.Vector3;
  sectorSplits: [number, number, number]; // progress 0.0 to 1.0 for sector 1, 2, 3
  drsZones: Array<{ start: number; end: number }>;
  startGantry: THREE.Group;
  updateStartingLights: (redCount: number, green: boolean) => void;
  getNearestPointAndProgress: (pos: THREE.Vector3) => {
    nearestPoint: THREE.Vector3;
    tangent: THREE.Vector3;
    normal: THREE.Vector3;
    progress: number;
    distanceFromCenter: number;
    isOffTrack: boolean;
  };
  dispose: () => void;
}

/**
 * Procedural texture for circuit asphalt with subtle racing line rubber deposits
 */
function createAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base asphalt dark grey
  ctx.fillStyle = '#242426';
  ctx.fillRect(0, 0, 512, 512);

  // Noise grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 30;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + grain));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + grain));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Darker racing line rubber groove down center
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.02)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural texture for F1 Red and White alternating kerbs (pianos)
 */
function createKerbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#E10600';
  ctx.fillRect(0, 64, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 60);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Checkered start/finish line texture
 */
function createCheckeredTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#0a0a0a';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        ctx.fillRect(i * 32, j * 32, 32, 32);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCircuitTrack(circuitId: CircuitId, customCircuitUrl?: string): CircuitTrack {
  const group = new THREE.Group();
  group.name = `Circuit_${circuitId}`;

  // Check if custom circuit .glb is provided or in /models/circuits/
  const circuitMeta = CIRCUITS_DATA.find((c) => c.id === circuitId);
  const targetGlbUrl = customCircuitUrl || (circuitMeta && circuitMeta.glbFile ? `/models/circuits/${circuitMeta.glbFile}` : null);
  if (targetGlbUrl) {
    loadCustomGLTFModel(targetGlbUrl).then((customMesh) => {
      if (customMesh) {
        group.add(customMesh);
      }
    });
  }

  // Circuit Spline Control Points
  let controlPoints: THREE.Vector3[] = [];
  let drsZones: Array<{ start: number; end: number }> = [];

  if (circuitId === 'imola') {
    // Autodromo Enzo e Dino Ferrari (Ímola)
    // 4.909 km - Start on start/finish line facing Tamburello along +Z
    // Distinct chicanes: Variante Tamburello (L-R-L), Variante Villeneuve (L-R), Variante Alta (R-L over kerbs)
    controlPoints = IMOLA_CONTROL_POINTS;
    drsZones = [
      { start: 0.94, end: 0.08 }, // Pit straight / Rettifilo (DRS Zone 1)
      { start: 0.68, end: 0.77 }, // Straight from Variante Alta to Rivazza (DRS Zone 2)
    ];
  } else {
    // Circuit de Spa-Francorchamps
    // 7.004 km - Start on start/finish line facing La Source along +Z
    // Clockwise: Turn 1 La Source hairpin -> descent -> Eau Rouge & Raidillon -> Kemmel Straight -> Les Combes -> Bruxelles -> Pouhon -> Campus -> Stavelot -> Blanchimont -> Bus Stop Chicane
    controlPoints = SPA_CONTROL_POINTS;
    drsZones = [
      { start: 0.16, end: 0.28 }, // Kemmel Straight (DRS Zone 1)
      { start: 0.94, end: 0.04 }, // Pit Straight / Rettifilo (DRS Zone 2)
    ];
  }

  // Create smooth closed spline
  const spline = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
  const totalLength = spline.getLength();
  const trackWidth = 13.0; // 13 meters wide F1 track

  const asphaltTex = createAsphaltTexture();
  const kerbTex = createKerbTexture();
  const checkeredTex = createCheckeredTexture();

  // 1. Generate 3D Extruded Ribbon Road Geometry
  const segments = 1400;
  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Kerbs left & right geometry
  const kerbLeftPositions: number[] = [];
  const kerbRightPositions: number[] = [];
  const kerbUVs: number[] = [];
  const kerbIndices: number[] = [];

  const halfWidth = trackWidth / 2;
  const kerbWidth = 1.4;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = spline.getPointAt(t);
    const tangent = spline.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Road left & right vertices flush with terrain
    const pLeft = pt.clone().addScaledVector(normal, -halfWidth);
    const pRight = pt.clone().addScaledVector(normal, halfWidth);

    positions.push(pLeft.x, 0.03, pLeft.z);
    positions.push(pRight.x, 0.03, pRight.z);

    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * 40);
    uvs.push(1, t * 40);

    // Kerbs (raised slightly above asphalt)
    const kLeftOuter = pLeft.clone().addScaledVector(normal, -kerbWidth);
    kerbLeftPositions.push(kLeftOuter.x, 0.06, kLeftOuter.z);
    kerbLeftPositions.push(pLeft.x, 0.04, pLeft.z);

    const kRightOuter = pRight.clone().addScaledVector(normal, kerbWidth);
    kerbRightPositions.push(pRight.x, 0.04, pRight.z);
    kerbRightPositions.push(kRightOuter.x, 0.06, kRightOuter.z);

    kerbUVs.push(0, t * 60, 1, t * 60);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);

      kerbIndices.push(base, base + 1, base + 2);
      kerbIndices.push(base + 1, base + 3, base + 2);
    }
  }

  // Asphalt Mesh
  const roadGeom = new THREE.BufferGeometry();
  roadGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  roadGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeom.setIndex(indices);

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.85,
    metalness: 0.1,
  });
  const roadMesh = new THREE.Mesh(roadGeom, roadMaterial);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Kerb Mesh (Left + Right combined)
  const kerbGeomLeft = new THREE.BufferGeometry();
  kerbGeomLeft.setAttribute('position', new THREE.Float32BufferAttribute(kerbLeftPositions, 3));
  kerbGeomLeft.setAttribute('uv', new THREE.Float32BufferAttribute(kerbUVs, 2));
  kerbGeomLeft.setIndex(kerbIndices);
  kerbGeomLeft.computeVertexNormals();

  const kerbGeomRight = new THREE.BufferGeometry();
  kerbGeomRight.setAttribute('position', new THREE.Float32BufferAttribute(kerbRightPositions, 3));
  kerbGeomRight.setAttribute('uv', new THREE.Float32BufferAttribute(kerbUVs, 2));
  kerbGeomRight.setIndex(kerbIndices);
  kerbGeomRight.computeVertexNormals();

  const kerbMaterial = new THREE.MeshStandardMaterial({
    map: kerbTex,
    roughness: 0.6,
    metalness: 0.15,
  });
  group.add(new THREE.Mesh(kerbGeomLeft, kerbMaterial));
  group.add(new THREE.Mesh(kerbGeomRight, kerbMaterial));

  // 2. Surrounding Terrain Grass Mesh - COMPLETELY FLAT AT Y = 0 as requested by the user
  const terrainGeom = new THREE.PlaneGeometry(8000, 8000);
  terrainGeom.rotateX(-Math.PI / 2);

  const terrainMat = new THREE.MeshStandardMaterial({
    color: circuitId === 'spa' ? 0x1b3b18 : 0x22421f,
    roughness: 0.95,
    metalness: 0.05,
  });
  const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
  terrainMesh.position.y = 0.0;
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 3. Start / Finish Line Decal
  const startLinePt = spline.getPointAt(0);
  const startTangent = spline.getTangentAt(0).normalize();
  const startNormal = new THREE.Vector3().crossVectors(startTangent, new THREE.Vector3(0, 1, 0)).normalize();

  const finishLineGeom = new THREE.PlaneGeometry(trackWidth, 2.5);
  finishLineGeom.rotateX(-Math.PI / 2);
  const finishLineMat = new THREE.MeshStandardMaterial({
    map: checkeredTex,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const finishLineMesh = new THREE.Mesh(finishLineGeom, finishLineMat);
  finishLineMesh.position.copy(startLinePt).add(new THREE.Vector3(0, 0.07, 0));
  finishLineMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNormal);
  group.add(finishLineMesh);

  // 4. Start / Finish Gantry with 5 F1 Starting Lights (High overhead clearance, 12m ahead of line)
  const startGantry = new THREE.Group();
  startGantry.position.copy(startLinePt).add(startTangent.clone().multiplyScalar(12));
  startGantry.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNormal);

  // Overhead bridge beam
  const beamGeom = new THREE.BoxGeometry(trackWidth + 6, 1.2, 1.8);
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
  const beamMesh = new THREE.Mesh(beamGeom, beamMat);
  beamMesh.position.set(0, 7.0, 0);
  startGantry.add(beamMesh);

  // Pillars left & right - well clear outside track boundary
  const gantryPillarGeom = new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8);
  const pillarL = new THREE.Mesh(gantryPillarGeom, beamMat);
  pillarL.position.set(-(trackWidth / 2 + 3.0), 3.75, 0);
  startGantry.add(pillarL);

  const pillarR = new THREE.Mesh(gantryPillarGeom, beamMat);
  pillarR.position.set(trackWidth / 2 + 3.0, 3.75, 0);
  startGantry.add(pillarR);

  // 5 F1 Red starting lights
  const startLights: THREE.Mesh[] = [];
  const lightGeom = new THREE.SphereGeometry(0.25, 16, 16);
  const lightOffMat = new THREE.MeshBasicMaterial({ color: 0x220000 });
  for (let i = -2; i <= 2; i++) {
    const lightMesh = new THREE.Mesh(lightGeom, lightOffMat.clone());
    lightMesh.position.set(i * 1.0, 6.6, -0.8);
    startGantry.add(lightMesh);
    startLights.push(lightMesh);
  }

  const updateStartingLights = (redCount: number, green: boolean) => {
    startLights.forEach((light, idx) => {
      const mat = light.material as THREE.MeshBasicMaterial;
      if (green) {
        mat.color.setHex(0x00ff44); // Green lights OUT!
      } else if (idx < redCount) {
        mat.color.setHex(0xff0011); // Red light ON
      } else {
        mat.color.setHex(0x220000); // Off
      }
    });
  };

  group.add(startGantry);

  // 5. Pit Lane & Team Garages (Boxes)
  const pitBuilding = buildPitBuilding(spline, trackWidth);
  group.add(pitBuilding);

  // 6. Spectator Grandstands (Tribunas)
  const grandstands = buildGrandstands(spline, trackWidth, circuitId);
  group.add(grandstands);

  // 7. Safety Catch Fences & Armco Barriers
  const safetyFences = buildSafetyFences(spline, trackWidth);
  group.add(safetyFences);

  // 8. Dense Circuit Perimeter Trees (2,400 trees: Ardennes pines for Spa, Santerno park trees for Imola)
  const perimeterTrees = buildCircuitTrees(spline, trackWidth, circuitId);
  group.add(perimeterTrees);

  // Pre-sample spline points for fast closest-point query
  const sampleCount = 1200;
  const samplePoints: Array<{ t: number; point: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3 }> = [];
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const pt = spline.getPointAt(t);
    const tan = spline.getTangentAt(t).normalize();
    const nor = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    samplePoints.push({ t, point: pt, tangent: tan, normal: nor });
  }

  const getNearestPointAndProgress = (pos: THREE.Vector3) => {
    let closestDistSq = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < sampleCount; i++) {
      const dSq = pos.distanceToSquared(samplePoints[i].point);
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestIndex = i;
      }
    }

    const best = samplePoints[closestIndex];
    const distFromCenter = Math.sqrt(closestDistSq);
    const isOffTrack = distFromCenter > halfWidth + 0.5;

    return {
      nearestPoint: best.point,
      tangent: best.tangent,
      normal: best.normal,
      progress: best.t,
      distanceFromCenter: distFromCenter,
      isOffTrack,
    };
  };

  const dispose = () => {
    asphaltTex.dispose();
    kerbTex.dispose();
    checkeredTex.dispose();
    roadGeom.dispose();
    kerbGeomLeft.dispose();
    kerbGeomRight.dispose();
  };

  return {
    group,
    spline,
    trackWidth,
    totalLength,
    startPosition: startLinePt.clone().sub(startTangent.clone().multiplyScalar(2)),
    startTangent: startTangent.clone(),
    sectorSplits: circuitId === 'imola' ? [0.33, 0.66, 1.0] : [0.30, 0.72, 1.0],
    drsZones,
    startGantry,
    updateStartingLights,
    getNearestPointAndProgress,
    dispose,
  };
}

/**
 * Procedural Pit Lane Building (Boxes) parallel to the main straight
 * Placed strictly outside the track boundary at offset > halfWidth + 8m
 */
function buildPitBuilding(spline: THREE.CatmullRomCurve3, trackWidth: number): THREE.Group {
  const pitGroup = new THREE.Group();
  pitGroup.name = 'PitBuilding';

  // Placed cleanly along the flat main straightaway ahead of the start line
  const tMid = 0.035;
  const pt = spline.getPointAt(tMid);
  const tan = spline.getTangentAt(tMid).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const nor = new THREE.Vector3().crossVectors(tan, up).normalize();

  const halfWidth = trackWidth / 2;
  const pitLength = 120;
  const pitBuildingOffset = halfWidth + 16.0; // 16m to the right of centerline, completely outside asphalt & kerbs

  // 1. Pit Lane Tarmac strip
  const pitLaneWidth = 8.0;
  const pitLaneCenterOffset = halfWidth + 5.5; // between track and garages
  const pitLaneGeom = new THREE.PlaneGeometry(pitLaneWidth, pitLength);
  pitLaneGeom.rotateX(-Math.PI / 2);
  const pitLaneMat = new THREE.MeshStandardMaterial({
    color: 0x1f2022,
    roughness: 0.88,
    metalness: 0.1,
  });
  const pitLaneMesh = new THREE.Mesh(pitLaneGeom, pitLaneMat);
  const pitLanePos = pt.clone().addScaledVector(nor, pitLaneCenterOffset);
  pitLaneMesh.position.set(pitLanePos.x, 0.035, pitLanePos.z);
  pitLaneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  pitGroup.add(pitLaneMesh);

  // 2. Pit Wall (Muro de boxes con valla de seguridad y pantallas para ingenieros)
  const pitWallOffset = halfWidth + 1.4;
  const pitWallLength = 115;
  const pitWallGeom = new THREE.BoxGeometry(0.5, 1.1, pitWallLength);
  const pitWallMat = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.6,
    metalness: 0.2,
  });
  const pitWallMesh = new THREE.Mesh(pitWallGeom, pitWallMat);
  const pitWallPos = pt.clone().addScaledVector(nor, pitWallOffset);
  pitWallMesh.position.set(pitWallPos.x, 0.55, pitWallPos.z);
  pitWallMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  pitGroup.add(pitWallMesh);

  // Pit wall fence mesh (catch fence above pit wall)
  const pitFenceGeom = new THREE.BoxGeometry(0.1, 1.4, pitWallLength);
  const pitFenceMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.8,
    roughness: 0.4,
    wireframe: true,
  });
  const pitFenceMesh = new THREE.Mesh(pitFenceGeom, pitFenceMat);
  pitFenceMesh.position.set(pitWallPos.x, 1.8, pitWallPos.z);
  pitFenceMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  pitGroup.add(pitFenceMesh);

  // 3. Main Pit Building Structure (Garages on ground, VIP Paddock club on upper floor)
  const buildingHeight = 7.0;
  const buildingDepth = 12.0;
  const buildingGeom = new THREE.BoxGeometry(buildingDepth, buildingHeight, pitLength);
  const buildingMat = new THREE.MeshStandardMaterial({
    color: 0x24272c,
    roughness: 0.5,
    metalness: 0.3,
  });
  const buildingMesh = new THREE.Mesh(buildingGeom, buildingMat);
  const buildingPos = pt.clone().addScaledVector(nor, pitBuildingOffset + buildingDepth / 2);
  buildingMesh.position.set(buildingPos.x, buildingHeight / 2, buildingPos.z);
  buildingMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  pitGroup.add(buildingMesh);

  // 4. Team Garage Bays (10 colored garage doors with team banners)
  const teamColors = [
    0xd40000, // Ferrari
    0x00d2be, // Mercedes
    0x0600ef, // Red Bull
    0xff8700, // McLaren
    0x00594f, // Aston Martin
    0x0090ff, // Alpine
    0x52e252, // Kick Sauber
    0x900000, // Alfa/Haas
    0x6692ff, // Racing Bulls
    0x002f6c, // Williams
  ];

  const garageWidth = 8.5;
  const garageHeight = 3.6;
  const garageDoorGeom = new THREE.BoxGeometry(0.2, garageHeight, garageWidth);
  const garageDoorMat = new THREE.MeshStandardMaterial({
    color: 0x111113,
    metalness: 0.7,
    roughness: 0.3,
  });

  const bannerHeight = 0.9;
  const bannerGeom = new THREE.BoxGeometry(0.25, bannerHeight, garageWidth);

  for (let i = 0; i < 10; i++) {
    const zOffset = (i - 4.5) * 11.5;
    // Garage dark bay
    const doorMesh = new THREE.Mesh(garageDoorGeom, garageDoorMat);
    const doorPos = pt
      .clone()
      .addScaledVector(nor, pitBuildingOffset)
      .addScaledVector(tan, zOffset);
    doorMesh.position.set(doorPos.x, garageHeight / 2, doorPos.z);
    doorMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    pitGroup.add(doorMesh);

    // Colored Team Banner above door
    const bannerMat = new THREE.MeshStandardMaterial({
      color: teamColors[i % teamColors.length],
      metalness: 0.5,
      roughness: 0.4,
    });
    const bannerMesh = new THREE.Mesh(bannerGeom, bannerMat);
    bannerMesh.position.set(doorPos.x, garageHeight + bannerHeight / 2, doorPos.z);
    bannerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    pitGroup.add(bannerMesh);
  }

  // 5. VIP Roof Canopy Overhang
  const roofGeom = new THREE.BoxGeometry(buildingDepth + 4, 0.4, pitLength + 4);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c1e,
    metalness: 0.6,
    roughness: 0.3,
  });
  const roofMesh = new THREE.Mesh(roofGeom, roofMat);
  roofMesh.position.set(buildingPos.x - 2, buildingHeight + 0.2, buildingPos.z);
  roofMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
  pitGroup.add(roofMesh);

  return pitGroup;
}

/**
 * Procedural Grandstands (Tribunas con gradas, asientos de colores y techo voladizo)
 */
function buildGrandstands(
  spline: THREE.CatmullRomCurve3,
  trackWidth: number,
  circuitId: CircuitId
): THREE.Group {
  const standsGroup = new THREE.Group();
  standsGroup.name = 'Grandstands';

  const halfWidth = trackWidth / 2;

  // Helper to build a single grandstand unit
  const addGrandstandAt = (
    t: number,
    side: number, // +1 right, -1 left
    distanceFromTrack: number,
    length: number,
    tiers: number,
    roofColor: number
  ) => {
    const pt = spline.getPointAt(t);
    const tan = spline.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const nor = new THREE.Vector3().crossVectors(tan, up).normalize();

    const standGroup = new THREE.Group();
    const standCenter = pt.clone().addScaledVector(nor, side * (halfWidth + distanceFromTrack));
    standGroup.position.set(standCenter.x, 0, standCenter.z);

    // Orient grandstand facing the track (lowest tier & seats in front facing track, columns at back)
    const facingDir = nor.clone().multiplyScalar(-side);
    standGroup.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), facingDir);

    const tierDepth = 0.9;
    const tierHeight = 0.55;
    const totalDepth = tiers * tierDepth;
    const totalHeight = tiers * tierHeight;

    // Sloped concrete stepped base
    for (let r = 0; r < tiers; r++) {
      const stepGeom = new THREE.BoxGeometry(tierDepth, tierHeight * (r + 1), length);
      const stepMat = new THREE.MeshStandardMaterial({
        color: 0x828892,
        roughness: 0.9,
      });
      const stepMesh = new THREE.Mesh(stepGeom, stepMat);
      stepMesh.position.set(r * tierDepth + tierDepth / 2, (tierHeight * (r + 1)) / 2, 0);
      standGroup.add(stepMesh);

      // Red / White / Yellow seats on step
      const seatRowGeom = new THREE.BoxGeometry(tierDepth * 0.75, 0.15, length * 0.96);
      const seatColor = r % 3 === 0 ? 0xcc1111 : r % 3 === 1 ? 0xdddddd : 0xe5a50a;
      const seatMat = new THREE.MeshStandardMaterial({
        color: seatColor,
        roughness: 0.6,
      });
      const seatMesh = new THREE.Mesh(seatRowGeom, seatMat);
      seatMesh.position.set(r * tierDepth + tierDepth / 2, tierHeight * (r + 1) + 0.08, 0);
      standGroup.add(seatMesh);
    }

    // Sloped Roof Canopy
    const roofGeom = new THREE.BoxGeometry(totalDepth + 3, 0.35, length + 2);
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      metalness: 0.4,
      roughness: 0.4,
    });
    const roofMesh = new THREE.Mesh(roofGeom, roofMat);
    roofMesh.position.set(totalDepth / 2, totalHeight + 3.2, 0);
    roofMesh.rotation.z = -0.12;
    standGroup.add(roofMesh);

    // Rear vertical steel support columns
    const colGeom = new THREE.CylinderGeometry(0.2, 0.2, totalHeight + 3.2, 8);
    const colMat = new THREE.MeshStandardMaterial({ color: 0x333538, metalness: 0.8 });
    for (let c = -length / 2 + 5; c <= length / 2 - 5; c += 15) {
      const col = new THREE.Mesh(colGeom, colMat);
      col.position.set(totalDepth, (totalHeight + 3.2) / 2, c);
      standGroup.add(col);
    }

    standsGroup.add(standGroup);
  };

  // 1. Main Straight grandstand (opposite pit building on the main straight)
  addGrandstandAt(0.035, -1, 18.0, 95, 12, 0x1b2838);

  // 2. First Corner / Hairpin grandstand (Outside of Turn 1)
  addGrandstandAt(0.065, -1, 18.0, 70, 10, 0x991111);

  // 3. Mid-circuit grandstand
  addGrandstandAt(0.48, 1, 18.0, 60, 9, 0x223344);

  // 4. Stadium / Chicane entry grandstand
  addGrandstandAt(0.89, -1, 17.0, 75, 11, 0xcc2200);

  return standsGroup;
}

/**
 * Procedural Armco Guardrails and Catch Fences along outside of corners
 */
function buildSafetyFences(spline: THREE.CatmullRomCurve3, trackWidth: number): THREE.Group {
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'SafetyCatchFences';

  const halfWidth = trackWidth / 2;
  const barrierOffset = halfWidth + 4.2; // 4.2m outside tarmac

  const armcoMat = new THREE.MeshStandardMaterial({
    color: 0x8a9299,
    metalness: 0.85,
    roughness: 0.3,
  });

  const postMat = new THREE.MeshStandardMaterial({
    color: 0x3a3c40,
    metalness: 0.9,
    roughness: 0.3,
  });

  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    wireframe: true,
  });

  // Key corner ranges [startT, endT, side] (-1: left, 1: right)
  const cornerSectors = [
    { start: 0.04, end: 0.12, side: -1 }, // Turn 1 / Hairpin exit
    { start: 0.18, end: 0.26, side: 1 },  // Fast kink
    { start: 0.34, end: 0.43, side: -1 }, // Mid corner
    { start: 0.52, end: 0.60, side: 1 },  // Sweeper
    { start: 0.67, end: 0.76, side: -1 }, // Heavy braking zone
    { start: 0.84, end: 0.93, side: 1 },  // Final chicane
  ];

  cornerSectors.forEach((sec) => {
    const stepCount = 20;
    const postGeom = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 6);

    for (let i = 0; i < stepCount; i++) {
      const t1 = sec.start + (i / stepCount) * (sec.end - sec.start);
      const t2 = sec.start + ((i + 1) / stepCount) * (sec.end - sec.start);

      const p1 = spline.getPointAt(t1);
      const tan1 = spline.getTangentAt(t1).normalize();
      const nor1 = new THREE.Vector3().crossVectors(tan1, new THREE.Vector3(0, 1, 0)).normalize();
      const pos1 = p1.clone().addScaledVector(nor1, sec.side * barrierOffset);

      const p2 = spline.getPointAt(t2);
      const tan2 = spline.getTangentAt(t2).normalize();
      const nor2 = new THREE.Vector3().crossVectors(tan2, new THREE.Vector3(0, 1, 0)).normalize();
      const pos2 = p2.clone().addScaledVector(nor2, sec.side * barrierOffset);

      const segVec = new THREE.Vector3().subVectors(pos2, pos1);
      const segLen = segVec.length();
      const segMid = pos1.clone().addScaledVector(segVec, 0.5);

      const railGeom = new THREE.BoxGeometry(0.15, 0.65, segLen);
      const rail = new THREE.Mesh(railGeom, armcoMat);
      rail.position.set(segMid.x, 0.6, segMid.z);
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), segVec.normalize());
      fenceGroup.add(rail);

      const wireGeom = new THREE.PlaneGeometry(segLen, 1.8);
      const wire = new THREE.Mesh(wireGeom, wireMat);
      wire.position.set(segMid.x, 1.8, segMid.z);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), segVec.normalize());
      fenceGroup.add(wire);

      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(pos1.x, 1.5, pos1.z);
      fenceGroup.add(post);
    }
  });

  return fenceGroup;
}

/**
 * Procedural High-Density Perimeter Forest using InstancedMesh for 60+ FPS
 * (Dense Ardennes pine forest for Spa, Santerno parkland poplars & cypresses for Imola)
 */
function buildCircuitTrees(
  spline: THREE.CatmullRomCurve3,
  trackWidth: number,
  circuitId: CircuitId
): THREE.Group {
  const treeGroup = new THREE.Group();
  treeGroup.name = 'CircuitTrees';

  const isSpa = circuitId === 'spa';
  const totalTrees = 2400;

  // 1. Wood trunk geometry & material
  const trunkHeight = 6.0;
  const trunkGeom = new THREE.CylinderGeometry(0.35, 0.55, trunkHeight, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3d2714,
    roughness: 0.9,
    metalness: 0.05,
  });
  const trunkInstanced = new THREE.InstancedMesh(trunkGeom, trunkMat, totalTrees);

  // 2. Foliage geometry & material
  // Spa: Ardennes tall evergreen conifer cone (height 14m)
  // Imola: Italian cypress cone or lush poplar umbrella canopy
  const foliageGeom = isSpa
    ? new THREE.ConeGeometry(3.6, 14.0, 7)
    : new THREE.ConeGeometry(2.4, 15.0, 7);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: isSpa ? 0x14331a : 0x22421b,
    roughness: 0.85,
    metalness: 0.05,
  });
  const foliageInstanced = new THREE.InstancedMesh(foliageGeom, foliageMat, totalTrees);

  const dummy = new THREE.Object3D();
  const halfWidth = trackWidth / 2;

  let instanceIdx = 0;
  const steps = 400; // 400 slices around the spline

  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const pt = spline.getPointAt(t);
    const tan = spline.getTangentAt(t).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const nor = new THREE.Vector3().crossVectors(tan, up).normalize();

    // In each slice, place trees in depth bands safely outside track, kerbs, and barriers:
    // Band 1: Trackside tree line (18m - 28m outside asphalt)
    // Band 2: Mid-distance grove (32m - 54m)
    // Band 3: Background forest/hill (58m - 98m)
    const bands = [
      { baseDist: 18.0, spread: 10.0 },
      { baseDist: 32.0, spread: 22.0 },
      { baseDist: 58.0, spread: 40.0 },
    ];

    for (const side of [-1, 1]) {
      // Don't place trees in the pit lane / pit building area along the main straight
      if (side === 1 && (t < 0.08 || t > 0.98)) continue;

      for (let b = 0; b < bands.length; b++) {
        if (instanceIdx >= totalTrees) break;

        const band = bands[b];
        const seed = s * 7 + b * 13 + (side === 1 ? 5 : 2);
        const dist = halfWidth + band.baseDist + ((seed * 17) % 100) * 0.01 * band.spread;
        const jitterAlong = (((seed * 31) % 40) - 20) * 0.5;

        const treePos = pt
          .clone()
          .addScaledVector(nor, side * dist)
          .addScaledVector(tan, jitterAlong);

        const scale = 0.9 + ((seed * 11) % 10) * 0.08; // 0.9 to 1.7 scale
        const rotY = (seed * 1.618) % (Math.PI * 2);

        // Trunk matrix
        dummy.position.set(treePos.x, (trunkHeight * scale) / 2, treePos.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        trunkInstanced.setMatrixAt(instanceIdx, dummy.matrix);

        // Foliage matrix sitting atop trunk
        const foliageHeight = isSpa ? 14.0 : 15.0;
        const foliageY = trunkHeight * scale + (foliageHeight * scale) * 0.45;
        dummy.position.set(treePos.x, foliageY, treePos.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        foliageInstanced.setMatrixAt(instanceIdx, dummy.matrix);

        instanceIdx++;
      }
    }
  }

  trunkInstanced.instanceMatrix.needsUpdate = true;
  foliageInstanced.instanceMatrix.needsUpdate = true;
  trunkInstanced.computeBoundingSphere();
  foliageInstanced.computeBoundingSphere();

  treeGroup.add(trunkInstanced);
  treeGroup.add(foliageInstanced);

  return treeGroup;
}
