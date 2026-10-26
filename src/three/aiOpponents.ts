import * as THREE from 'three';
import { CarSpecs, RaceParticipant } from '../types/game';
import { buildF1Car, F1CarController } from './carModel';
import { triggerHaptic } from '../audio/engineSound';

export interface AIOpponent {
  id: string;
  name: string;
  team: string;
  color: string;
  controller: F1CarController;
  progress: number; // 0.0 to 1.0
  lap: number;      // 1, 2, 3...
  speedKmh: number;
  lateralOffset: number;       // Current meters from track center (-4 to +4)
  targetLateralOffset: number; // Desired racing line
  personality: {
    aggression: number;       // 0.8 - 1.2
    cornerSpeedFactor: number; // Speed in turns
    lineShiftTimer: number;   // Time until next racing line switch
    desiredOffsetRange: number;
  };
  position: THREE.Vector3;
  heading: number;
  isBraking: boolean;
  totalDistance: number;
  gridSlot: number; // 1 to 5
}

export class AIOpponentManager {
  private opponents: AIOpponent[] = [];
  private scene: THREE.Scene;
  private trackSpline: THREE.CatmullRomCurve3;
  private trackLength: number;
  private totalLaps: number;

  constructor(scene: THREE.Scene, trackSpline: THREE.CatmullRomCurve3, trackLength: number, totalLaps: number = 3) {
    this.scene = scene;
    this.trackSpline = trackSpline;
    this.trackLength = trackLength;
    this.totalLaps = totalLaps;
    this.initOpponents();
  }

  private initOpponents(): void {
    const aiConfigs: Array<{
      id: string;
      name: string;
      team: string;
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      gridSlot: number;
      aggression: number;
      cornerFactor: number;
    }> = [
      {
        id: 'ai_redbull',
        name: 'M. Verstappen',
        team: 'Red Bull Racing',
        primaryColor: '#0B162C',
        secondaryColor: '#EA0029',
        accentColor: '#FFD700',
        gridSlot: 1, // P1 (Pole position)
        aggression: 1.15,
        cornerFactor: 1.04,
      },
      {
        id: 'ai_mercedes',
        name: 'L. Hamilton',
        team: 'Mercedes-AMG',
        primaryColor: '#C8CCCE',
        secondaryColor: '#00A19B',
        accentColor: '#111111',
        gridSlot: 2, // P2
        aggression: 1.08,
        cornerFactor: 1.02,
      },
      {
        id: 'ai_mclaren',
        name: 'L. Norris',
        team: 'McLaren F1',
        primaryColor: '#FF8000',
        secondaryColor: '#1A1A1A',
        accentColor: '#47C7FC',
        gridSlot: 4, // P4 (Player starts in P3)
        aggression: 1.02,
        cornerFactor: 0.98,
      },
      {
        id: 'ai_aston',
        name: 'F. Alonso',
        team: 'Aston Martin',
        primaryColor: '#00594F',
        secondaryColor: '#CEDC00',
        accentColor: '#002B24',
        gridSlot: 5, // P5
        aggression: 1.12,
        cornerFactor: 1.01,
      },
    ];

    this.opponents = aiConfigs.map((cfg) => {
      const specs: CarSpecs = {
        id: 'f1_2022',
        name: cfg.name,
        driver: cfg.name,
        team: cfg.team,
        era: 'F1 2024',
        primaryColor: cfg.primaryColor,
        secondaryColor: cfg.secondaryColor,
        accentColor: cfg.accentColor,
        topSpeed: 345 + (cfg.aggression - 1.0) * 15,
        acceleration: 2.3 - (cfg.aggression - 1.0) * 0.2,
        handling: 9.4,
        powerUnit: '1.6L V6 Turbo Híbrido',
        description: cfg.team,
        glbFile: '',
      };

      const controller = buildF1Car(specs);
      this.scene.add(controller.carGroup);

      // Grid position: staggered F1 starting grid slots
      // Slot 1: -4m, -2.5m lateral
      // Slot 2: -12m, +2.5m lateral
      // Slot 3: -20m, -2.5m (Player)
      // Slot 4: -28m, +2.5m lateral
      // Slot 5: -36m, -2.5m lateral
      const gridDistMeters = -4 - (cfg.gridSlot - 1) * 8;
      const initialProgress = (this.trackLength + gridDistMeters) / this.trackLength;
      const initialLateral = cfg.gridSlot % 2 === 1 ? -2.4 : 2.4;

      return {
        id: cfg.id,
        name: cfg.name,
        team: cfg.team,
        color: cfg.primaryColor,
        controller,
        progress: initialProgress % 1.0,
        lap: 1,
        speedKmh: 0,
        lateralOffset: initialLateral,
        targetLateralOffset: initialLateral,
        personality: {
          aggression: cfg.aggression,
          cornerSpeedFactor: cfg.cornerFactor,
          lineShiftTimer: Math.random() * 3 + 2,
          desiredOffsetRange: (Math.random() - 0.5) * 4.0,
        },
        position: new THREE.Vector3(),
        heading: 0,
        isBraking: false,
        totalDistance: 0,
        gridSlot: cfg.gridSlot,
      };
    });

    // Place initial AI positions on grid
    this.updateAIPositionsOnGrid();
  }

  public updateAIPositionsOnGrid(): void {
    const up = new THREE.Vector3(0, 1, 0);
    this.opponents.forEach((ai) => {
      const pt = this.trackSpline.getPointAt(ai.progress);
      const tangent = this.trackSpline.getTangentAt(ai.progress).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      ai.position.copy(pt).addScaledVector(normal, ai.lateralOffset);
      ai.position.y = 0.05;
      ai.heading = Math.atan2(tangent.x, tangent.z);

      ai.controller.carGroup.position.copy(ai.position);
      ai.controller.carGroup.rotation.set(0, ai.heading, 0);
      ai.speedKmh = 0;
      ai.totalDistance = (ai.lap - 1) * this.trackLength + ai.progress * this.trackLength;
    });
  }

  public update(
    delta: number,
    isRaceStarted: boolean,
    playerPosition: THREE.Vector3,
    playerSpeedKmh: number,
    playerProgress: number,
    playerLap: number
  ): {
    playerPos: number; // 1 to 5
    leaderboard: RaceParticipant[];
    collisionOccurred: boolean;
    playerSpeedPenalty: number;
    playerPushVector: THREE.Vector3;
  } {
    const up = new THREE.Vector3(0, 1, 0);
    let collisionOccurred = false;
    let playerSpeedPenalty = 0;
    const playerPushVector = new THREE.Vector3(0, 0, 0);

    // 1. Update each AI car
    this.opponents.forEach((ai) => {
      if (!isRaceStarted) {
        // Idling on the grid during countdown
        ai.speedKmh = 0;
        ai.controller.update(0, 0, delta, false, false);
        return;
      }

      // Lookahead curvature analysis to brake into corners
      const lookaheadT = (ai.progress + 35 / this.trackLength) % 1.0;
      const curTangent = this.trackSpline.getTangentAt(ai.progress).normalize();
      const lookTangent = this.trackSpline.getTangentAt(lookaheadT).normalize();
      const dot = Math.max(-1, Math.min(1, curTangent.dot(lookTangent)));
      const angleChange = Math.acos(dot); // In radians

      // Determine max safe speed for curvature
      let targetSpeed = 330 * ai.personality.aggression;
      if (angleChange > 0.35) {
        // Sharp turn (Hairpin / chicane like La Source or Tamburello)
        targetSpeed = (85 + (1 - angleChange) * 45) * ai.personality.cornerSpeedFactor;
      } else if (angleChange > 0.15) {
        // Medium turn (Les Combes, Pouhon)
        targetSpeed = (150 + (1 - angleChange) * 80) * ai.personality.cornerSpeedFactor;
      } else {
        // Straights / Flat curves (Kemmel, Rettifilo, Blanchimont)
        targetSpeed = 335 + ai.personality.aggression * 15;
      }

      // Check proximity to car ahead (avoid rear-ending and find overtaking line)
      let carAheadDist = Infinity;
      let carAheadLateral = 0;

      // Check vs player
      const dPlayer = ai.position.distanceTo(playerPosition);
      if (dPlayer < 25 && playerProgress > ai.progress) {
        carAheadDist = dPlayer;
        carAheadLateral = 0; // Centerline
      }

      // Check vs other AI
      this.opponents.forEach((other) => {
        if (other.id !== ai.id) {
          const dOther = ai.position.distanceTo(other.position);
          if (dOther < carAheadDist && other.progress > ai.progress) {
            carAheadDist = dOther;
            carAheadLateral = other.lateralOffset;
          }
        }
      });

      // Overtake or speed match if car directly ahead
      if (carAheadDist < 16) {
        targetSpeed = Math.min(targetSpeed, 220);
        // Switch to opposite side of track to overtake
        ai.targetLateralOffset = carAheadLateral > 0 ? -3.2 : 3.2;
      } else {
        // Periodic racing line wander (varies inside vs outside line)
        ai.personality.lineShiftTimer -= delta;
        if (ai.personality.lineShiftTimer <= 0) {
          ai.personality.lineShiftTimer = Math.random() * 4 + 2;
          // Random line shift between -3.5m and +3.5m
          ai.targetLateralOffset = (Math.random() - 0.5) * 6.5;
        }
      }

      // Acceleration / Braking
      ai.isBraking = ai.speedKmh > targetSpeed + 15;
      if (ai.speedKmh < targetSpeed) {
        const accel = 65 * ai.personality.aggression;
        ai.speedKmh = Math.min(targetSpeed, ai.speedKmh + accel * delta);
      } else {
        const brake = 160;
        ai.speedKmh = Math.max(targetSpeed, ai.speedKmh - brake * delta);
      }

      // Move along track progress
      const speedMps = (ai.speedKmh * 1000) / 3600;
      const progressDelta = (speedMps * delta) / this.trackLength;
      const prevProgress = ai.progress;
      ai.progress = (ai.progress + progressDelta) % 1.0;

      // Lap completion detection
      if (prevProgress > 0.85 && ai.progress < 0.15) {
        ai.lap++;
      }

      // Smooth lateral offset transition
      ai.lateralOffset = THREE.MathUtils.damp(ai.lateralOffset, ai.targetLateralOffset, 3.5, delta);

      // Compute 3D position & heading
      const trackPt = this.trackSpline.getPointAt(ai.progress);
      const tangent = this.trackSpline.getTangentAt(ai.progress).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      ai.position.copy(trackPt).addScaledVector(normal, ai.lateralOffset);
      ai.position.y = 0.05;

      // Slight steering angle toward target lateral offset
      const lateralError = ai.targetLateralOffset - ai.lateralOffset;
      const steerVal = Math.max(-1, Math.min(1, lateralError * 0.4));
      ai.heading = Math.atan2(tangent.x, tangent.z) - steerVal * 0.06;

      ai.controller.carGroup.position.copy(ai.position);
      ai.controller.carGroup.rotation.set(0, ai.heading, 0);

      // Update AI car model wheels and rain light
      ai.controller.update(steerVal, ai.speedKmh, delta, ai.isBraking, false);

      ai.totalDistance = (ai.lap - 1) * this.trackLength + ai.progress * this.trackLength;
    });

    // 2. Real Car-to-Car Collision Detection & Physical Response
    const CAR_RADIUS = 1.9; // Collision distance threshold (meters)

    // Player vs AI Collisions
    this.opponents.forEach((ai) => {
      const dist = playerPosition.distanceTo(ai.position);
      if (dist < CAR_RADIUS * 2) {
        collisionOccurred = true;
        triggerHaptic([60, 40, 70]);

        // Direction from AI to player
        const impactDir = new THREE.Vector3().subVectors(playerPosition, ai.position);
        impactDir.y = 0;
        const impactDist = Math.max(0.1, impactDir.length());
        impactDir.normalize();

        // Push player away from AI
        const overlap = (CAR_RADIUS * 2 - impactDist) * 0.6;
        playerPushVector.addScaledVector(impactDir, overlap);

        // Push AI away from player
        ai.position.addScaledVector(impactDir, -overlap);
        ai.controller.carGroup.position.copy(ai.position);

        // Speed penalties on impact
        playerSpeedPenalty = Math.max(playerSpeedPenalty, 22);
        ai.speedKmh = Math.max(40, ai.speedKmh - 25);
        ai.lateralOffset += impactDir.x < 0 ? -1.5 : 1.5;
      }
    });

    // AI vs AI Collisions (prevent AI from overlapping each other)
    for (let i = 0; i < this.opponents.length; i++) {
      for (let j = i + 1; j < this.opponents.length; j++) {
        const a = this.opponents[i];
        const b = this.opponents[j];
        const d = a.position.distanceTo(b.position);
        if (d < CAR_RADIUS * 2) {
          const push = new THREE.Vector3().subVectors(a.position, b.position).normalize();
          const overlap = (CAR_RADIUS * 2 - d) * 0.5;
          a.position.addScaledVector(push, overlap);
          b.position.addScaledVector(push, -overlap);
          a.controller.carGroup.position.copy(a.position);
          b.controller.carGroup.position.copy(b.position);
          a.speedKmh = Math.max(40, a.speedKmh - 15);
          b.speedKmh = Math.max(40, b.speedKmh - 15);
        }
      }
    }

    // 3. Leaderboard & Position Calculation (P1 to P5)
    const playerTotalDistance = (playerLap - 1) * this.trackLength + playerProgress * this.trackLength;

    const participants: RaceParticipant[] = [
      {
        id: 'player',
        name: 'TÚ (Jugador)',
        team: 'Scuderia Ferrari / F1',
        color: '#FF1801',
        position: 1,
        currentLap: Math.min(this.totalLaps, playerLap),
        totalDistance: playerTotalDistance,
        isPlayer: true,
      },
      ...this.opponents.map((ai) => ({
        id: ai.id,
        name: ai.name,
        team: ai.team,
        color: ai.color,
        position: 1,
        currentLap: Math.min(this.totalLaps, ai.lap),
        totalDistance: ai.totalDistance,
        isPlayer: false,
      })),
    ];

    // Sort descending by total distance traveled
    participants.sort((a, b) => b.totalDistance - a.totalDistance);

    const leaderDist = participants[0].totalDistance;
    participants.forEach((p, idx) => {
      p.position = idx + 1;
      const gapMeters = leaderDist - p.totalDistance;
      p.gapToLeader = idx === 0 ? 'LÍDER' : `+${(gapMeters / 60).toFixed(1)}s`;
    });

    const playerPos = participants.findIndex((p) => p.isPlayer) + 1;

    return {
      playerPos,
      leaderboard: participants,
      collisionOccurred,
      playerSpeedPenalty,
      playerPushVector,
    };
  }

  public resetToGrid(playerLap: number = 1): void {
    this.opponents.forEach((ai) => {
      const gridDistMeters = -4 - (ai.gridSlot - 1) * 8;
      const initialProgress = (this.trackLength + gridDistMeters) / this.trackLength;
      ai.progress = initialProgress % 1.0;
      ai.lap = playerLap;
      ai.speedKmh = 0;
      ai.lateralOffset = ai.gridSlot % 2 === 1 ? -2.4 : 2.4;
      ai.targetLateralOffset = ai.lateralOffset;
    });
    this.updateAIPositionsOnGrid();
  }

  public dispose(): void {
    this.opponents.forEach((ai) => {
      ai.controller.dispose();
      this.scene.remove(ai.controller.carGroup);
    });
    this.opponents = [];
  }
}
