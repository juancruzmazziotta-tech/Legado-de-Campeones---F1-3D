import * as THREE from 'three';
import circuitData from './circuitCoordinates.json';

export const IMOLA_CONTROL_POINTS: THREE.Vector3[] = circuitData.imola.map(
  (p) => new THREE.Vector3(p.x, 0, p.z)
);

export const SPA_CONTROL_POINTS: THREE.Vector3[] = circuitData.spa.map(
  (p) => new THREE.Vector3(p.x, 0, p.z)
);
