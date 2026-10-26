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
