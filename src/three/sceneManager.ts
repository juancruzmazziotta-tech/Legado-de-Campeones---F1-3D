import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CarSpecs, CircuitId, CameraMode, ControlMode, DrivingMode, GameTelemetry, OrientationData } from '../types/game';
import { buildF1Car, F1CarController } from './carModel';
import { buildCircuitTrack, CircuitTrack } from './trackGenerator';
import { audioManager, triggerHaptic } from '../audio/engineSound';

export interface SceneCallbacks {
  onTelemetryUpdate: (telemetry: GameTelemetry) => void;
  onLapCompleted: (lapTime: number, isBest: boolean, lapNumber: number) => void;
  onInspectPart: (partInfo: { name: string; specs: string; description: string }) => void;
  onStartingLightsUpdate?: (lightsCount: number, green: boolean) => void;
}

export class F1SceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private animationFrameId: number = 0;
  private isDisposed: boolean = false;

  // Game entities
  private carController: F1CarController | null = null;
  private track: CircuitTrack | null = null;
  private carSpecs: CarSpecs;
  private circuitId: CircuitId;
  private cameraMode: CameraMode = 'cockpit';
  private controlMode: ControlMode = 'touch';
  private drivingMode: DrivingMode = 'practice';
  private callbacks: SceneCallbacks;

  // Physics & Vehicle State
  private carPosition: THREE.Vector3 = new THREE.Vector3();
  private carVelocity: THREE.Vector3 = new THREE.Vector3();
  private carHeading: number = 0; // Yaw angle in radians
  private carPitch: number = 0;
  private carRoll: number = 0;
  private currentSpeedKmh: number = 0;
  private currentRpm: number = 1000;
  private currentGear: number = 1;
  private steerInput: number = 0; // -1 to 1
  private throttleInput: number = 0; // 0 to 1
  private brakeInput: number = 0; // 0 to 1
  private drsActive: boolean = false;
  private drsAvailable: boolean = false;

  // Lap Timing State
  private lapStartTime: number = 0;
  private currentLapTime: number = 0;
  private bestLapTime: number | null = null;
  private lapCount: number = 0;
  private lastTrackProgress: number = 0;
  private hasCrossedStart: boolean = false;
  private currentSector: 1 | 2 | 3 = 1;

  // Starting Lights sequence for Time Attack
  private countdownState: 'idle' | 'counting' | 'green' = 'idle';
  private countdownTimer: number = 0;
  private countdownRedCount: number = 0;

  // Gyroscope smoothed inputs
  private rawOrientation: OrientationData = { alpha: 0, beta: 0, gamma: 0 };
  private smoothedGamma: number = 0;
  private smoothedBeta: number = 0;

  // Particle speed lines
  private speedParticles: THREE.Points | null = null;

  // Video background plane (WebRTC camera feed)
  private videoBackgroundMesh: THREE.Mesh | null = null;
  private videoTexture: THREE.VideoTexture | null = null;

  // Raycaster for part inspection
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVector: THREE.Vector2 = new THREE.Vector2();

  // Reusable vectors for zero GC in render loop
  private _camTarget: THREE.Vector3 = new THREE.Vector3();
  private _lookAtTarget: THREE.Vector3 = new THREE.Vector3();
  private _upVector: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  // Persistent Keyboard State (Works with multiple simultaneous keys!)
  private activeKeys: Set<string> = new Set<string>();
  private smoothedKeyboardSteer: number = 0;
  private isReversing: boolean = false;
  private customCircuitUrl?: string;

  constructor(
    container: HTMLElement,
    carSpecs: CarSpecs,
    circuitId: CircuitId,
    initialCamera: CameraMode,
    initialControl: ControlMode,
    initialDrivingMode: DrivingMode,
    callbacks: SceneCallbacks,
    customCircuitUrl?: string
  ) {
    this.container = container;
    this.carSpecs = carSpecs;
    this.circuitId = circuitId;
    this.cameraMode = initialCamera;
    this.controlMode = initialControl;
    this.drivingMode = initialDrivingMode;
    this.callbacks = callbacks;
    this.customCircuitUrl = customCircuitUrl;

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.container.appendChild(this.renderer.domElement);

    // 3. Initialize Scene & Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // F1 Sunny Sky Blue
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0018);

    // Studio Environment Reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Initialize Camera
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);

    // 5. Lighting Rig
    this.setupLighting();

    // 6. Build Circuit & Car
    this.setupCircuitAndCar();

    // 7. Speed Particle System
    this.setupSpeedParticles();

    // 8. Event Listeners
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.container.addEventListener('pointerdown', this.onPointerDown);

    // 9. Start Game Loop
    this.lastTime = performance.now();
    this.startCountdownIfTimeAttack();
    this.animate();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.activeKeys.add(e.code);
    if (e.code === 'KeyC') {
      const nextCam: CameraMode = this.cameraMode === 'cockpit' ? 'chase' : this.cameraMode === 'chase' ? 'cinematic' : 'cockpit';
      this.setCameraMode(nextCam);
    }
    if (e.code === 'KeyR') {
      this.recoverToTrack();
    }
    if (e.code === 'Space') {
      this.toggleDRS();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.activeKeys.delete(e.code);
  };

  private setupLighting(): void {
    // Hemisphere light: Warm sunlight + cool sky
    const hemiLight = new THREE.HemisphereLight(0xfff8ee, 0x446655, 0.75);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Key Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(60, 90, 40);
    sunLight.castShadow = !this.isSoftwareGl;
    if (sunLight.shadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 300;
      const d = 40;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x7aa5d2, 0.45);
    fillLight.position.set(-60, 40, -40);
    this.scene.add(fillLight);
  }

  private setupCircuitAndCar(): void {
    // Build Track
    this.track = buildCircuitTrack(this.circuitId, this.customCircuitUrl);
    this.scene.add(this.track.group);

    // Position Car on starting grid
    this.carPosition.copy(this.track.startPosition);
    this.carHeading = Math.atan2(this.track.startTangent.x, this.track.startTangent.z);

    // Build F1 Car
    this.carController = buildF1Car(this.carSpecs);
    this.carController.carGroup.position.copy(this.carPosition);
    this.carController.carGroup.rotation.y = this.carHeading;
    this.scene.add(this.carController.carGroup);

    this.lapStartTime = performance.now();
  }

  private setupSpeedParticles(): void {
    const count = 400;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = Math.random() * 4 + 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.35,
    });

    this.speedParticles = new THREE.Points(geom, mat);
    this.scene.add(this.speedParticles);
  }

  /**
   * Optional AR / Camera video plane background
   */
  public async enableCameraBackground(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      this.videoTexture = new THREE.VideoTexture(video);
      this.videoTexture.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = this.videoTexture;
      return true;
    } catch (err) {
      console.warn('Camera background access rejected:', err);
      return false;
    }
  }

  public disableCameraBackground(): void {
    if (this.videoTexture) {
      const vid = this.videoTexture.image as HTMLVideoElement;
      if (vid && vid.srcObject) {
        (vid.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      this.videoTexture.dispose();
      this.videoTexture = null;
    }
    this.scene.background = new THREE.Color(0x87ceeb);
  }

  private startCountdownIfTimeAttack(): void {
    if (this.drivingMode === 'time_attack') {
      this.countdownState = 'counting';
      this.countdownTimer = 0;
      this.countdownRedCount = 0;
    } else {
      this.countdownState = 'green';
    }
  }

  // Input Setters from UI / Sensors
  public setSteerInput(val: number): void {
    this.steerInput = Math.max(-1, Math.min(1, val));
  }

  public setThrottleInput(val: number): void {
    this.throttleInput = Math.max(0, Math.min(1, val));
  }

  public setBrakeInput(val: number): void {
    this.brakeInput = Math.max(0, Math.min(1, val));
  }

  public toggleDRS(): boolean {
    if (this.drsAvailable) {
      this.drsActive = !this.drsActive;
      triggerHaptic(20);
      return this.drsActive;
    }
    return false;
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    triggerHaptic(15);
  }

  public setControlMode(mode: ControlMode): void {
    this.controlMode = mode;
  }

  public updateOrientation(data: OrientationData): void {
    this.rawOrientation = data;
  }

  private lastTime: number = 0;

  private animate = () => {
    if (this.isDisposed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (delta > 0.1) delta = 0.1; // clamp lag spike

    this.updatePhysics(delta);
    this.updateCamera(delta);
    this.updateParticles();
    this.updateTelemetryAndAudio(now);

    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Physics, acceleration, steering kinematics, gears and DRS
   */
  private updatePhysics(delta: number): void {
    if (!this.track || !this.carController) return;

    // Starting Countdown logic for Time Attack
    if (this.countdownState === 'counting') {
      this.countdownTimer += delta;
      const step = Math.floor(this.countdownTimer / 0.8);
      if (step !== this.countdownRedCount && step <= 5) {
        this.countdownRedCount = step;
        audioManager.playBeep(440, 0.12);
        this.track.updateStartingLights(this.countdownRedCount, false);
      }
      if (this.countdownTimer >= 4.5) {
        this.countdownState = 'green';
        audioManager.playBeep(880, 0.35);
        this.track.updateStartingLights(5, true);
        this.lapStartTime = performance.now();
        triggerHaptic([50, 40, 80]);
      }
      // Hold car stationary during start lights countdown
      this.throttleInput = 0;
      this.currentSpeedKmh = 0;
      return;
    }

    // 1. Process Steering & Acceleration from Keyboard, Touch, and Gyroscope
    const keyForward = this.activeKeys.has('KeyW') || this.activeKeys.has('ArrowUp');
    const keyBackward = this.activeKeys.has('KeyS') || this.activeKeys.has('ArrowDown');
    const keyLeft = this.activeKeys.has('KeyA') || this.activeKeys.has('ArrowLeft');
    const keyRight = this.activeKeys.has('KeyD') || this.activeKeys.has('ArrowRight');

    let rawKeyboardSteer = 0;
    if (keyLeft && !keyRight) rawKeyboardSteer = -1.0;
    else if (keyRight && !keyLeft) rawKeyboardSteer = 1.0;

    // Progressive steering ramp-up so buttons aren't too sensitive / twitchy!
    this.smoothedKeyboardSteer = THREE.MathUtils.damp(this.smoothedKeyboardSteer, rawKeyboardSteer, 6, delta);

    const keyboardThrottle = keyForward ? 1.0 : 0.0;
    const keyboardBrake = keyBackward ? 1.0 : 0.0;

    // Both throttle and steering work simultaneously!
    const effectiveThrottle = Math.max(this.throttleInput, keyboardThrottle);
    const effectiveBrake = Math.max(this.brakeInput, keyboardBrake);

    let effectiveSteer = this.steerInput !== 0 ? this.steerInput : this.smoothedKeyboardSteer;

    if (this.controlMode === 'gyro') {
      const isLandscape = window.innerWidth > window.innerHeight;
      const targetTilt = isLandscape ? this.rawOrientation.beta : this.rawOrientation.gamma;
      const clamped = Math.max(-35, Math.min(35, targetTilt));
      this.smoothedGamma = THREE.MathUtils.damp(this.smoothedGamma, clamped / 28, 10, delta);
      if (Math.abs(this.smoothedGamma) > 0.03) {
        effectiveSteer = this.smoothedGamma;
      }
    }

    // 2. Track Query & Off-track penalty
    const trackInfo = this.track.getNearestPointAndProgress(this.carPosition);
    const isOffTrack = trackInfo.isOffTrack;

    // Check DRS availability in zones
    let insideDrsZone = false;
    for (const zone of this.track.drsZones) {
      if (zone.start < zone.end) {
        if (trackInfo.progress >= zone.start && trackInfo.progress <= zone.end) insideDrsZone = true;
      } else {
        // Wraps over start/finish
        if (trackInfo.progress >= zone.start || trackInfo.progress <= zone.end) insideDrsZone = true;
      }
    }
    this.drsAvailable = insideDrsZone;
    if (!this.drsAvailable) this.drsActive = false;

    // Max speed based on car specs & DRS
    let maxSpeed = this.carSpecs.topSpeed;
    if (this.drsActive) maxSpeed += 18;

    // Grass / off-track handling:
    // When off-track, speed is capped to 95 km/h, but the car NEVER gets stuck at 0!
    if (isOffTrack) {
      maxSpeed = 95;
      if (this.currentSpeedKmh > 95) {
        this.currentSpeedKmh = THREE.MathUtils.damp(this.currentSpeedKmh, 95, 2.5, delta);
      }
      triggerHaptic(15);
    }

    // Reverse Gear Detection: If stationary (speed < 3 km/h) and user holds Brake/Down/S
    if (Math.abs(this.currentSpeedKmh) <= 3 && effectiveBrake > 0.1 && effectiveThrottle === 0) {
      this.isReversing = true;
    } else if (effectiveThrottle > 0) {
      this.isReversing = false;
    }

    // Acceleration & Braking with Reverse support
    const accelRate = (100 / this.carSpecs.acceleration) * (isOffTrack ? 0.85 : 1.0);
    const brakeRate = 180; // Carbon brakes
    const rollingResistance = isOffTrack ? 8 : 12;

    if (this.isReversing) {
      // Backing up up to -35 km/h
      if (effectiveBrake > 0) {
        this.currentSpeedKmh = Math.max(-35, this.currentSpeedKmh - effectiveBrake * 50 * delta);
      } else {
        // Coast backwards to stop
        this.currentSpeedKmh = Math.min(0, this.currentSpeedKmh + 30 * delta);
        if (Math.abs(this.currentSpeedKmh) < 0.5) {
          this.currentSpeedKmh = 0;
          this.isReversing = false;
        }
      }
    } else {
      if (effectiveThrottle > 0) {
        // Strong power curve ensures car easily accelerates out of grass
        const powerCurve = Math.max(0.4, 1.0 - (this.currentSpeedKmh / maxSpeed) * 0.6);
        this.currentSpeedKmh += effectiveThrottle * accelRate * powerCurve * delta;
      } else {
        // Natural coasting drag
        this.currentSpeedKmh -= rollingResistance * delta;
      }

      if (effectiveBrake > 0) {
        this.currentSpeedKmh -= effectiveBrake * brakeRate * delta;
      }

      this.currentSpeedKmh = Math.max(0, Math.min(maxSpeed, this.currentSpeedKmh));
    }

    // Calculate RPM and Gear Shifting
    this.calculateGearAndRpm();

    // Responsive vehicle steering: turns smoothly and accurately (Left = Left, Right = Right)
    const absSpeed = Math.abs(this.currentSpeedKmh);
    const lowSpeedAuthority = Math.max(0.7, Math.min(1.0, absSpeed / 12));
    const highSpeedStability = 1.0 - Math.min(0.35, (absSpeed / 360) * 0.35);
    const baseTurnSpeed = 1.65 * (this.carSpecs.handling / 10);
    const steerDirection = this.isReversing ? -1 : 1;
    this.carHeading -= effectiveSteer * baseTurnSpeed * lowSpeedAuthority * highSpeedStability * steerDirection * delta;

    // Update car position along heading
    const speedMps = (this.currentSpeedKmh * 1000) / 3600;
    const forwardX = Math.sin(this.carHeading);
    const forwardZ = Math.cos(this.carHeading);

    this.carPosition.x += forwardX * speedMps * delta;
    this.carPosition.z += forwardZ * speedMps * delta;
    this.carPosition.y = trackInfo.nearestPoint.y; // Match track elevation

    // Track slope pitch (elevation climb at Eau Rouge / Piratella)
    const slopePitch = Math.atan2(
      trackInfo.tangent.y,
      Math.sqrt(trackInfo.tangent.x * trackInfo.tangent.x + trackInfo.tangent.z * trackInfo.tangent.z)
    );

    // Subtle chassis roll into corners
    const targetRoll = -effectiveSteer * 0.08 * (absSpeed / 200);
    this.carRoll = THREE.MathUtils.damp(this.carRoll, targetRoll, 10, delta);

    // Subtle chassis pitch during acceleration / braking + hill slope
    const targetPitch = slopePitch + (effectiveBrake * 0.04) - (effectiveThrottle * 0.02);
    this.carPitch = THREE.MathUtils.damp(this.carPitch, targetPitch, 8, delta);

    // Apply to car 3D group
    this.carController.carGroup.position.copy(this.carPosition);
    this.carController.carGroup.rotation.y = this.carHeading;
    this.carController.carGroup.rotation.z = this.carRoll;
    this.carController.carGroup.rotation.x = this.carPitch;

    // Update wheels and DRS flap
    this.carController.update(effectiveSteer, this.currentSpeedKmh, delta, effectiveBrake > 0.4, this.drsActive);

    // 3. Lap Timing & Sector Detection
    this.updateLapTiming(trackInfo.progress);
  }

  private calculateGearAndRpm(): void {
    if (this.isReversing) {
      this.currentGear = 0; // 0 represents 'R' (Reverse)
      this.currentRpm = 2000 + (Math.abs(this.currentSpeedKmh) / 35) * 4500;
      return;
    }

    // 8-speed F1 gearbox
    const gearRatios = [0, 85, 130, 175, 220, 265, 305, 340, 365];
    let gear = 1;
    for (let g = 1; g <= 8; g++) {
      if (this.currentSpeedKmh >= gearRatios[g - 1] && this.currentSpeedKmh <= gearRatios[g]) {
        gear = g;
        break;
      }
      if (this.currentSpeedKmh > gearRatios[8]) {
        gear = 8;
      }
    }

    if (gear !== this.currentGear) {
      if (gear > this.currentGear) {
        audioManager.triggerBackfirePop();
        triggerHaptic(30);
      }
      this.currentGear = gear;
    }

    const minGearSpeed = gearRatios[gear - 1];
    const maxGearSpeed = gearRatios[gear];
    const speedRatioInGear = (this.currentSpeedKmh - minGearSpeed) / Math.max(1, maxGearSpeed - minGearSpeed);

    if (this.currentSpeedKmh < 5) {
      this.currentRpm = 1000 + (this.throttleInput || (this.activeKeys.has('KeyW') || this.activeKeys.has('ArrowUp') ? 1 : 0)) * 4000;
    } else {
      this.currentRpm = 8500 + speedRatioInGear * 6000;
    }
  }

  private updateLapTiming(progress: number): void {
    // Sector detection
    if (progress < 0.33) {
      this.currentSector = 1;
    } else if (progress < 0.66) {
      this.currentSector = 2;
    } else {
      this.currentSector = 3;
    }

    // Detect crossing start/finish line (progress wrapping from ~0.95 to ~0.05)
    if (this.lastTrackProgress > 0.85 && progress < 0.15) {
      if (this.hasCrossedStart) {
        const completedLapTime = (performance.now() - this.lapStartTime) / 1000;
        this.lapCount++;
        const isBest = this.bestLapTime === null || completedLapTime < this.bestLapTime;
        if (isBest) {
          this.bestLapTime = completedLapTime;
        }

        // Trigger lap completed event
        this.callbacks.onLapCompleted(completedLapTime, isBest, this.lapCount);
        this.lapStartTime = performance.now();
        triggerHaptic([60, 50, 100]);
      } else {
        this.hasCrossedStart = true;
        this.lapStartTime = performance.now();
      }
    }

    this.lastTrackProgress = progress;
  }

  /**
   * Camera Positioning (Cockpit / Chase / Cinematic)
   */
  private updateCamera(delta: number): void {
    if (!this.carController) return;

    if (this.cameraMode === 'cockpit') {
      // Hide driver helmet in cockpit view so it never blocks or inverts sight!
      this.carController.setCockpitView(true);

      // Mount camera directly at driver eye level
      this.carController.cockpitCameraAnchor.getWorldPosition(this._camTarget);
      this.camera.position.copy(this._camTarget);

      // Look straight forward down the track along the car's heading
      const forwardX = Math.sin(this.carHeading);
      const forwardZ = Math.cos(this.carHeading);
      const lookDist = 40;

      this._lookAtTarget.set(
        this._camTarget.x + forwardX * lookDist,
        this._camTarget.y + 0.18, // Frame track ahead clearly
        this._camTarget.z + forwardZ * lookDist
      );

      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this._lookAtTarget);

      // FOV dynamically expands with speed for extreme sense of velocity!
      const targetFov = 66 + (this.currentSpeedKmh / 350) * 12;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, delta);
      this.camera.updateProjectionMatrix();

    } else {
      this.carController.setCockpitView(false);
      this.camera.up.set(0, 1, 0);

      if (this.cameraMode === 'chase') {
        // Third person chase camera behind car
        this.carController.chaseCameraAnchor.getWorldPosition(this._camTarget);
        this.camera.position.lerp(this._camTarget, 1 - Math.exp(-14 * delta));

        const forwardX = Math.sin(this.carHeading);
        const forwardZ = Math.cos(this.carHeading);

        this._lookAtTarget.set(
          this.carPosition.x + forwardX * 12,
          this.carPosition.y + 1.1,
          this.carPosition.z + forwardZ * 12
        );
        this.camera.lookAt(this._lookAtTarget);

        const targetFov = 60 + (this.currentSpeedKmh / 350) * 14;
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, delta);
        this.camera.updateProjectionMatrix();

      } else {
        // Cinematic TV trackside camera
        const tvDist = 18;
        this._camTarget.set(
          this.carPosition.x + Math.sin(this.carHeading + 1.4) * tvDist,
          this.carPosition.y + 4.5,
          this.carPosition.z + Math.cos(this.carHeading + 1.4) * tvDist
        );
        this.camera.position.lerp(this._camTarget, 1 - Math.exp(-6 * delta));
        this.camera.lookAt(this.carPosition.x, this.carPosition.y + 0.6, this.carPosition.z);
      }
    }
  }

  private updateParticles(): void {
    if (!this.speedParticles) return;

    // Anchor speed particle cage around car position
    this.speedParticles.position.copy(this.carPosition);

    // Particle opacity grows with high speed
    const mat = this.speedParticles.material as THREE.PointsMaterial;
    const speedRatio = Math.max(0, (this.currentSpeedKmh - 160) / 180);
    mat.opacity = speedRatio * 0.45;
  }

  private updateTelemetryAndAudio(now: number): void {
    this.currentLapTime = this.hasCrossedStart ? (now - this.lapStartTime) / 1000 : 0;

    // Lateral G estimation
    const lateralG = (this.steerInput * (this.currentSpeedKmh / 160)) * 2.8;

    // Send audio updates to Web Audio API engine
    audioManager.updateTelemetry(this.currentRpm, this.throttleInput, this.brakeInput, lateralG);

    // Notify React HUD
    const trackInfo = this.track ? this.track.getNearestPointAndProgress(this.carPosition) : null;
    this.callbacks.onTelemetryUpdate({
      speedKmh: Math.round(this.currentSpeedKmh),
      rpm: Math.round(this.currentRpm),
      gear: this.currentGear,
      throttle: this.throttleInput,
      brake: this.brakeInput,
      steerAngle: this.steerInput,
      lapTime: this.currentLapTime,
      bestLapTime: this.bestLapTime,
      sector: this.currentSector,
      lapCount: this.lapCount,
      isOffTrack: trackInfo ? trackInfo.isOffTrack : false,
      drsAvailable: this.drsAvailable,
      drsActive: this.drsActive,
    });
  }

  /**
   * Raycaster for 3D inspection on click/touch
   */
  private onPointerDown = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouseVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVector, this.camera);
    if (!this.carController) return;

    const intersects = this.raycaster.intersectObjects(this.carController.inspectableParts, true);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.partName) {
        triggerHaptic([30, 20]);
        this.callbacks.onInspectPart({
          name: hit.userData.partName,
          specs: hit.userData.specs || '',
          description: hit.userData.description || '',
        });
      }
    }
  };

  private onWindowResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  public recoverToTrack(): void {
    if (!this.track || !this.carController) return;
    const info = this.track.getNearestPointAndProgress(this.carPosition);
    this.carPosition.copy(info.nearestPoint);
    this.carPosition.y = info.nearestPoint.y + 0.1;
    this.carHeading = Math.atan2(info.tangent.x, info.tangent.z);
    this.isReversing = false;
    this.currentSpeedKmh = Math.max(60, this.currentSpeedKmh);
    this.carRoll = 0;
    this.carPitch = 0;
    this.carController.carGroup.position.copy(this.carPosition);
    this.carController.carGroup.rotation.set(0, this.carHeading, 0);
    triggerHaptic([40, 30, 60]);
  }

  public resetCarToStart(): void {
    if (!this.track || !this.carController) return;
    this.carPosition.copy(this.track.startPosition);
    this.carHeading = Math.atan2(this.track.startTangent.x, this.track.startTangent.z);
    this.currentSpeedKmh = 0;
    this.currentGear = 1;
    this.throttleInput = 0;
    this.brakeInput = 0;
    this.carController.carGroup.position.copy(this.carPosition);
    this.carController.carGroup.rotation.set(0, this.carHeading, 0);
    this.startCountdownIfTimeAttack();
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.container.removeEventListener('pointerdown', this.onPointerDown);

    if (this.carController) this.carController.dispose();
    if (this.track) this.track.dispose();
    this.disableCameraBackground();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
