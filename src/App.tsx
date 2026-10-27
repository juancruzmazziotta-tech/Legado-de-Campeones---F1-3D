import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CARS_DATA, CIRCUITS_DATA } from './data/f1Data';
import {
  CarSpecs,
  CircuitId,
  ControlMode,
  CameraMode,
  DrivingMode,
  GameTelemetry,
  OrientationData,
  AudioMetrics,
} from './types/game';
import { F1SceneManager } from './three/sceneManager';
import { audioManager } from './audio/engineSound';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SelectionScreen } from './components/SelectionScreen';
import { RacingHUD } from './components/RacingHUD';
import { QRModal } from './components/QRModal';
import { LapSummaryModal } from './components/LapSummaryModal';
import { InspectPartModal } from './components/InspectPartModal';
import { LapHistoryModal } from './components/LapHistoryModal';
import { RacePodiumModal } from './components/RacePodiumModal';

type AppScreen = 'welcome' | 'selection' | 'racing';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [selectedCar, setSelectedCar] = useState<CarSpecs>(CARS_DATA[0]);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>('imola');
  const [controlMode, setControlMode] = useState<ControlMode>('touch');
  const [cameraMode, setCameraMode] = useState<CameraMode>('cockpit');
  const [drivingMode, setDrivingMode] = useState<DrivingMode>('practice');
  const [customCircuitUrl, setCustomCircuitUrl] = useState<string | undefined>(undefined);

  // Modals
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [lapSummaryOpen, setLapSummaryOpen] = useState<boolean>(false);
  const [lapHistoryOpen, setLapHistoryOpen] = useState<boolean>(false);
  const [racePodiumOpen, setRacePodiumOpen] = useState<boolean>(false);
  const [lastLapTime, setLastLapTime] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [inspectedPart, setInspectedPart] = useState<{ name: string; specs: string; description: string } | null>(null);

  // Sensor & Audio State
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isCameraBgActive, setIsCameraBgActive] = useState<boolean>(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics>({ volume: 0, bassLevel: 0 });

  // Live Telemetry
  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 0,
    rpm: 1000,
    gear: 1,
    throttle: 0,
    brake: 0,
    steerAngle: 0,
    lapTime: 0,
    bestLapTime: null,
    sector: 1,
    lapCount: 0,
    isOffTrack: false,
    drsAvailable: false,
    drsActive: false,
    racePosition: 4,
    totalRaceCars: 5,
    raceCurrentLap: 1,
    raceLapsTotal: 3,
    countdownSeconds: null,
    isRaceFinished: false,
    raceStandings: [],
    lapHistory: [],
  });

  // 3D Scene Reference
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<F1SceneManager | null>(null);

  // Device Orientation Handler (Gyroscope)
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      const alpha = event.alpha || 0;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;
      if (sceneManagerRef.current) {
        sceneManagerRef.current.updateOrientation({ alpha, beta, gamma });
      }
    };

    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, []);

  // Audio Analyser Polling Interval (when Mic is active)
  useEffect(() => {
    if (!isMicActive) return;
    const interval = setInterval(() => {
      const metrics = audioManager.getAudioMetrics();
      setAudioMetrics(metrics);
    }, 100);
    return () => clearInterval(interval);
  }, [isMicActive]);

  // Teardown / Cleanup scene when switching screens or unmounting
  const cleanupScene = useCallback(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.dispose();
      sceneManagerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupScene();
    };
  }, [cleanupScene]);

  // Initialize Three.js scene when entering 'racing' screen
  useEffect(() => {
    if (screen !== 'racing') {
      cleanupScene();
      return;
    }

    if (!canvasMountRef.current) return;

    // Create scene manager instance
    const scene = new F1SceneManager(
      canvasMountRef.current,
      selectedCar,
      selectedCircuit,
      cameraMode,
      controlMode,
      drivingMode,
      {
        onTelemetryUpdate: (newTelemetry) => {
          setTelemetry(newTelemetry);
          if (drivingMode === 'race' && newTelemetry.isRaceFinished) {
            setRacePodiumOpen(true);
          }
        },
        onLapCompleted: (time, isBest) => {
          setLastLapTime(time);
          setIsNewRecord(isBest);
          // Only interrupt with LapSummaryModal in Time Attack; Free Practice and Race laps stay continuous
          if (drivingMode === 'time_attack') {
            setLapSummaryOpen(true);
          }
        },
        onInspectPart: (part) => {
          setInspectedPart(part);
        },
      },
      customCircuitUrl
    );

    sceneManagerRef.current = scene;

    return () => {
      cleanupScene();
    };
  }, [screen, selectedCar, selectedCircuit, customCircuitUrl, cleanupScene]);

  // Handle Starting from Selection
  const handleConfirmSelection = (config: {
    car: CarSpecs;
    circuit: CircuitId;
    control: ControlMode;
    camera: CameraMode;
    drivingMode: DrivingMode;
    customCircuitUrl?: string;
  }) => {
    setSelectedCar(config.car);
    setSelectedCircuit(config.circuit);
    setControlMode(config.control);
    setCameraMode(config.camera);
    setDrivingMode(config.drivingMode);
    setCustomCircuitUrl(config.customCircuitUrl);
    setScreen('racing');
  };

  // Recover car to track centerline
  const handleRecoverToTrack = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.recoverToTrack();
    }
  };

  // Camera change in HUD
  const handleSetCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setCameraMode(mode);
    }
  };

  // DRS Toggle in HUD
  const handleToggleDRS = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.toggleDRS();
    }
  };

  // Lap Restart in HUD
  const handleRestartLap = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.resetCarToStart();
    }
    setLapSummaryOpen(false);
    setRacePodiumOpen(false);
    setLapHistoryOpen(false);
  };

  // Exit Racing to Menu
  const handleExitRacing = () => {
    cleanupScene();
    setLapSummaryOpen(false);
    setRacePodiumOpen(false);
    setLapHistoryOpen(false);
    setScreen('selection');
  };

  // Toggle Control Mode (Gyro / Touch)
  const handleToggleControlMode = () => {
    const next: ControlMode = controlMode === 'gyro' ? 'touch' : 'gyro';
    setControlMode(next);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setControlMode(next);
    }
  };

  // Toggle Mic
  const handleToggleMic = async () => {
    if (isMicActive) {
      setIsMicActive(false);
    } else {
      const success = await audioManager.enableMicrophone();
      setIsMicActive(success);
    }
  };

  // Toggle Camera Background
  const handleToggleCameraBg = async () => {
    if (!sceneManagerRef.current) return;
    if (isCameraBgActive) {
      sceneManagerRef.current.disableCameraBackground();
      setIsCameraBgActive(false);
    } else {
      const ok = await sceneManagerRef.current.enableCameraBackground();
      setIsCameraBgActive(ok);
    }
  };

  // Tactile Inputs Handlers
  const handleSteerChange = (val: number) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setSteerInput(val);
    }
  };

  const handleThrottleChange = (val: number) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setThrottleInput(val);
    }
  };

  const handleBrakeChange = (val: number) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setBrakeInput(val);
    }
  };

  const currentCircuitInfo = CIRCUITS_DATA.find((c) => c.id === selectedCircuit) || CIRCUITS_DATA[0];

  return (
    <div className={`w-full bg-[#121212] font-body ${screen === 'racing' ? 'fixed inset-0 h-full overflow-hidden select-none' : 'relative min-h-screen'}`}>
      {/* 3D WebGL Canvas Container (Pinned full viewport) */}
      <div
        ref={canvasMountRef}
        className={`fixed inset-0 w-full h-full ${screen === 'racing' ? 'block' : 'hidden'}`}
      />

      {/* Screen 1: Welcome & Landing */}
      {screen === 'welcome' && (
        <WelcomeScreen
          onStart={() => setScreen('selection')}
          onOpenQR={() => setQrModalOpen(true)}
        />
      )}

      {/* Screen 2: Car, Circuit & Controls Selection */}
      {screen === 'selection' && (
        <SelectionScreen
          onConfirm={handleConfirmSelection}
          onBack={() => setScreen('welcome')}
        />
      )}

      {/* Screen 3: Racing In-Game Overlay HUD */}
      {screen === 'racing' && (
        <RacingHUD
          car={selectedCar}
          circuit={currentCircuitInfo}
          telemetry={telemetry}
          cameraMode={cameraMode}
          controlMode={controlMode}
          drivingMode={drivingMode}
          audioMetrics={audioMetrics}
          isMicActive={isMicActive}
          isCameraBgActive={isCameraBgActive}
          onSetCameraMode={handleSetCameraMode}
          onToggleControlMode={handleToggleControlMode}
          onToggleDRS={handleToggleDRS}
          onRestartLap={handleRestartLap}
          onRecoverToTrack={handleRecoverToTrack}
          onExit={handleExitRacing}
          onOpenQR={() => setQrModalOpen(true)}
          onToggleMic={handleToggleMic}
          onToggleCameraBg={handleToggleCameraBg}
          onSteerChange={handleSteerChange}
          onThrottleChange={handleThrottleChange}
          onBrakeChange={handleBrakeChange}
          onOpenLapHistory={() => setLapHistoryOpen(true)}
        />
      )}

      {/* Modal 1: QR Code & Mobile Access Mockup */}
      <QRModal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} />

      {/* Modal 2: Lap Summary (Time Attack Mode) */}
      <LapSummaryModal
        isOpen={lapSummaryOpen}
        lapTime={lastLapTime}
        bestLapTime={telemetry.bestLapTime}
        isNewRecord={isNewRecord}
        topSpeed={telemetry.speedKmh}
        carName={selectedCar.name}
        circuitName={currentCircuitInfo.name}
        onRetry={handleRestartLap}
        onBackToMenu={handleExitRacing}
      />

      {/* Modal 3: Free Practice Lap History */}
      <LapHistoryModal
        isOpen={lapHistoryOpen}
        onClose={() => setLapHistoryOpen(false)}
        circuitName={currentCircuitInfo.name}
        lapHistory={telemetry.lapHistory || []}
        bestLapTime={telemetry.bestLapTime}
      />

      {/* Modal 4: Grand Prix Race Podium & Standings (at end of 3 laps) */}
      <RacePodiumModal
        isOpen={racePodiumOpen}
        standings={telemetry.raceStandings || []}
        playerFinalPosition={telemetry.racePosition || 1}
        circuitName={currentCircuitInfo.name}
        onRestart={handleRestartLap}
        onExit={handleExitRacing}
      />

      {/* Modal 5: 3D Raycaster Inspect Part Modal */}
      <InspectPartModal
        partInfo={inspectedPart}
        onClose={() => setInspectedPart(null)}
      />
    </div>
  );
}
