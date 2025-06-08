
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BlackHoleCanvas } from './components/BlackHoleCanvas';
import { ControlPanel } from './components/ControlPanel';
import { connectToESP32, disconnectESP32, subscribeToDistanceUpdates, ESP32ConnectionCallbacks } from './services/esp32BluetoothService';
import { SimulationState } from './types';
import { 
  MAX_SIMULATED_DISTANCE_KM, 
  MIN_SIMULATED_DISTANCE_KM,
  // MIN_SENSOR_DISTANCE_CM, // Physical sensor min, SENSOR_HORIZON_DISTANCE_CM is main sim min for logic below
  SENSOR_HORIZON_DISTANCE_CM, // This is 5cm from constants.ts. This is the point for max dilation.
  TARGET_SENSOR_MAX_DISTANCE_CM, // This will be 100cm from constants.ts
  BASE_TIME_FLOW_RATE,
  SENSOR_DRIVEN_DILATION_CAP
} from './constants';

// Sound effect functions
const playSound = (soundId: string, volume?: number) => {
  const sound = document.getElementById(soundId) as HTMLAudioElement;
  if (sound) {
    console.log(`Intentando reproducir sonido: ${soundId}, Volumen: ${volume !== undefined ? volume : sound.volume}, Estado Actual: ${sound.paused ? "Pausado" : "Reproduciendo"}, ReadyState: ${sound.readyState}`);
    if (volume !== undefined) sound.volume = Math.max(0, Math.min(1, volume));
    if (sound.paused || sound.currentTime > 0 && sound.duration > 0 && sound.currentTime === sound.duration) { 
        sound.currentTime = 0; 
        sound.play().catch(e => console.warn(`Fallo al reproducir sonido ${soundId}:`, e));
    } else {
      // console.log(`Sonido ${soundId} ya se está reproduciendo o no está listo para reiniciar.`);
    }
  } else {
    console.warn(`Elemento de audio NO ENCONTRADO: ${soundId}. Asegúrate de que el ID es correcto y el elemento <audio> existe en el HTML. También verifica que el archivo de sonido existe en 'public/sounds/'.`);
  }
};

const manageLoopingSound = (soundId: string, condition: boolean, volume?: number) => {
  const sound = document.getElementById(soundId) as HTMLAudioElement;
  if (sound) {
    if (condition) {
      if (sound.paused) {
        console.log(`Iniciando sonido en bucle: ${soundId}, Volumen: ${volume !== undefined ? volume : sound.volume}, ReadyState: ${sound.readyState}`);
        if (volume !== undefined) sound.volume = Math.max(0, Math.min(1, volume));
        sound.play().catch(e => console.warn(`Fallo al reproducir sonido en bucle ${soundId}:`, e));
      } else { 
        if (volume !== undefined && sound.volume !== Math.max(0, Math.min(1, volume))) {
            // console.log(`Ajustando volumen de sonido en bucle ${soundId} a ${volume}`);
            sound.volume = Math.max(0, Math.min(1, volume));
        }
      }
    } else {
      if (!sound.paused) {
        // console.log(`Pausando sonido en bucle: ${soundId}`);
        sound.pause();
      }
    }
  } else {
    console.warn(`Elemento de audio en bucle NO ENCONTRADO: ${soundId}. Asegúrate de que el ID es correcto y el elemento <audio> existe en el HTML. También verifica que el archivo de sonido existe en 'public/sounds/'.`);
  }
};


const playStandardWarningSound = () => playSound('standardWarningSound');
const playAmbientSound = () => {
    const sound = document.getElementById('ambientDroneSound') as HTMLAudioElement;
    if (sound && sound.paused) {
        console.log("Intentando reproducir sonido ambiente inicial.");
        sound.volume = 0.3; 
        sound.play().catch(e => console.warn(`Fallo al reproducir sonido ambiente:`, e));
    } else if (sound && !sound.paused) {
        // console.log("Sonido ambiente ya se está reproduciendo.");
    } else {
        // console.warn("Elemento de audio para sonido ambiente no encontrado al inicio."); // Covered by diagnostic
    }
};
const playProximityAlertSound = (intensity: number) => {
  const volume = 0.2 + (intensity - 1) * (0.8 / 4); 
  playSound('proximityPulseSound', Math.min(1, Math.max(0.1, volume)));
};


const App: React.FC = () => {
  const [simulationState, setSimulationState] = useState<SimulationState>({
    distanceToBlackHole: MAX_SIMULATED_DISTANCE_KM,
    timeDilationFactor: BASE_TIME_FLOW_RATE,
    spaceshipSpeed: 0,
    isApproaching: false,
    missionTimeSeconds: 0,
    shipTimeSeconds: 0,
  });
  const [bluetoothStatus, setBluetoothStatus] = useState<string>('Desconectado');
  const [esp32Device, setEsp32Device] = useState<BluetoothDevice | null>(null);
  const [sensorDistance, setSensorDistance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [horizonReachedMessageVisible, setHorizonReachedMessageVisible] = useState<boolean>(false);
  const [showHorizonFlash, setShowHorizonFlash] = useState<boolean>(false); 

  const lastWarningDistanceRef = useRef<number>(MAX_SIMULATED_DISTANCE_KM);
  const ambientSoundPlayedRef = useRef(false);
  const horizonAlreadyFlashedRef = useRef(false); 

  const missionTimeRef = useRef<number>(0);
  const shipTimeRef = useRef<number>(0);
  const appAnimationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimestampRef = useRef<number | null>(null);
  const prevDistanceToBlackHoleRef = useRef<number>(MAX_SIMULATED_DISTANCE_KM);
  
  // Sound diagnostics useEffect
  useEffect(() => {
    console.log("--- Diagnóstico de Audio ---");
    const audioIds = [
      'standardWarningSound', 
      'ambientDroneSound', 
      'proximityPulseSound', 
      'timeDilationSound', 
      'singularityRumbleSound'
    ];
    audioIds.forEach(id => {
      const soundElement = document.getElementById(id) as HTMLAudioElement;
      if (soundElement) {
        console.log(`Audio ID: ${id} | Encontrado: Sí | SRC: ${soundElement.src} | ReadyState: ${soundElement.readyState} | NetworkState: ${soundElement.networkState} | Paused: ${soundElement.paused} | Volume: ${soundElement.volume}`);
        if (soundElement.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          console.error(`ERROR Sonido: ${id} - No se encontró la fuente (archivo). Revisa la ruta en 'public/sounds/' y el nombre del archivo.`);
        } else if (soundElement.error) {
          console.error(`ERROR Sonido: ${id} - Error de media:`, soundElement.error);
        }
      } else {
        console.warn(`Audio ID: ${id} | Encontrado: No. Revisa el ID en la etiqueta <audio> en App.tsx.`);
      }
    });
    console.log("--- Fin Diagnóstico de Audio ---");
  }, []);

  useEffect(() => {
    if (!ambientSoundPlayedRef.current) {
        playAmbientSound(); 
        ambientSoundPlayedRef.current = true;
    }
  }, []);

  useEffect(() => {
    const updateTimes = (timestamp: number) => {
      if (lastFrameTimestampRef.current === null) {
        lastFrameTimestampRef.current = timestamp;
        appAnimationFrameIdRef.current = requestAnimationFrame(updateTimes);
        return;
      }

      const deltaTime = (timestamp - lastFrameTimestampRef.current) / 1000;
      lastFrameTimestampRef.current = timestamp;

      missionTimeRef.current += deltaTime;
      const currentDilationFactor = simulationState.timeDilationFactor;
      shipTimeRef.current += deltaTime / Math.max(BASE_TIME_FLOW_RATE, currentDilationFactor);


      setSimulationState(prev => ({
        ...prev,
        missionTimeSeconds: missionTimeRef.current,
        shipTimeSeconds: shipTimeRef.current,
      }));

      appAnimationFrameIdRef.current = requestAnimationFrame(updateTimes);
    };

    appAnimationFrameIdRef.current = requestAnimationFrame(updateTimes);

    return () => {
      if (appAnimationFrameIdRef.current) {
        cancelAnimationFrame(appAnimationFrameIdRef.current);
      }
      lastFrameTimestampRef.current = null;
    };
  }, [simulationState.timeDilationFactor]); 


  useEffect(() => {
    let newTimeDilationFactor: number;
    let displayDistanceKm: number;
    let currentSpeed = 0;
    let approaching = false;
    let horizonReachedThisUpdate = false;

    if (esp32Device && sensorDistance !== null) {
      // Clamp sensorDistance to the effective range for simulation control
      // e.g., if sensor reads 2cm, it's treated as SENSOR_HORIZON_DISTANCE_CM (5cm) for proximity calc.
      // If sensor reads 150cm, it's treated as TARGET_SENSOR_MAX_DISTANCE_CM (100cm) for proximity calc.
      const rawClampedSensorVal = Math.max(SENSOR_HORIZON_DISTANCE_CM, Math.min(TARGET_SENSOR_MAX_DISTANCE_CM, sensorDistance));
      
      const activeSensorMinForSim = SENSOR_HORIZON_DISTANCE_CM; // e.g., 5cm
      const activeSensorMaxForSim = TARGET_SENSOR_MAX_DISTANCE_CM; // e.g., 100cm (now from constants)
      const sensorRangeForSim = Math.max(1, activeSensorMaxForSim - activeSensorMinForSim); // e.g., 95cm
      
      // normalizedSensorProximity: 0 when sensor is at 100cm, 1 when sensor is at 5cm (or less)
      // Uses rawClampedSensorVal which is already within [5cm, 100cm]
      const normalizedSensorProximity = 
        Math.max(0, Math.min(1, 
          (activeSensorMaxForSim - rawClampedSensorVal) / sensorRangeForSim
        ));

      // Visual distance calculation (linear with proximity)
      displayDistanceKm = MAX_SIMULATED_DISTANCE_KM - normalizedSensorProximity * (MAX_SIMULATED_DISTANCE_KM - MIN_SIMULATED_DISTANCE_KM);
      
      // New time dilation factor calculation
      if (normalizedSensorProximity >= 1.0) { // At or beyond horizon point (e.g., 5cm or less)
          newTimeDilationFactor = SENSOR_DRIVEN_DILATION_CAP;
          horizonReachedThisUpdate = true; 
          displayDistanceKm = MIN_SIMULATED_DISTANCE_KM; // Ensure visual distance is at min for horizon
      } else {
          let calculatedFactor = BASE_TIME_FLOW_RATE / (1 - normalizedSensorProximity);
          newTimeDilationFactor = Math.min(SENSOR_DRIVEN_DILATION_CAP, Math.max(BASE_TIME_FLOW_RATE, calculatedFactor));
          horizonReachedThisUpdate = false;
      }
      
      newTimeDilationFactor = Math.min(SENSOR_DRIVEN_DILATION_CAP, Math.max(BASE_TIME_FLOW_RATE, newTimeDilationFactor));
      displayDistanceKm = Math.max(MIN_SIMULATED_DISTANCE_KM, Math.min(MAX_SIMULATED_DISTANCE_KM, displayDistanceKm));

      if (isNaN(newTimeDilationFactor) || !isFinite(newTimeDilationFactor)) {
        newTimeDilationFactor = horizonReachedThisUpdate ? SENSOR_DRIVEN_DILATION_CAP : BASE_TIME_FLOW_RATE;
      }
      if (isNaN(displayDistanceKm) || !isFinite(displayDistanceKm)) {
        displayDistanceKm = horizonReachedThisUpdate ? MIN_SIMULATED_DISTANCE_KM : MAX_SIMULATED_DISTANCE_KM;
      }

    } else { // No ESP32 or sensor data
      newTimeDilationFactor = BASE_TIME_FLOW_RATE;
      displayDistanceKm = MAX_SIMULATED_DISTANCE_KM;
      horizonReachedThisUpdate = false;
    }

    setHorizonReachedMessageVisible(horizonReachedThisUpdate);

    // Flash effect logic
    if (horizonReachedThisUpdate && !horizonAlreadyFlashedRef.current && esp32Device) { // Only flash if sensor is active
        setShowHorizonFlash(true);
        horizonAlreadyFlashedRef.current = true;
    } else if (!horizonReachedThisUpdate) {
        horizonAlreadyFlashedRef.current = false; 
    }


    currentSpeed = Math.abs(prevDistanceToBlackHoleRef.current - displayDistanceKm);
    approaching = displayDistanceKm < prevDistanceToBlackHoleRef.current;
    prevDistanceToBlackHoleRef.current = displayDistanceKm;


    setSimulationState(prev => ({
      ...prev,
      distanceToBlackHole: displayDistanceKm,
      timeDilationFactor: newTimeDilationFactor,
      spaceshipSpeed: currentSpeed,
      isApproaching: approaching,
    }));

    // Sound Triggers
    const criticalDangerThresholdKm = MIN_SIMULATED_DISTANCE_KM * 10; 
    const warningThresholdKm = MIN_SIMULATED_DISTANCE_KM * 50;     

    if (approaching) {
      if (displayDistanceKm < warningThresholdKm && displayDistanceKm < lastWarningDistanceRef.current * 0.95) { 
        playStandardWarningSound();
        lastWarningDistanceRef.current = displayDistanceKm;
      }
      if (displayDistanceKm < criticalDangerThresholdKm) {
        const rangeInCritical = criticalDangerThresholdKm - MIN_SIMULATED_DISTANCE_KM;
        const progressInCritical = (displayDistanceKm - MIN_SIMULATED_DISTANCE_KM) / Math.max(1, rangeInCritical); 
        const intensity = 1 + 4 * (1 - Math.max(0, Math.min(1, progressInCritical))); 
        playProximityAlertSound(Math.max(1, Math.min(5, Math.floor(intensity))));
      }
    } else {
      if (displayDistanceKm > warningThresholdKm * 1.2) { 
          lastWarningDistanceRef.current = MAX_SIMULATED_DISTANCE_KM;
      }
    }
    
    const timeDistortionActive = newTimeDilationFactor > 30 && newTimeDilationFactor < (SENSOR_DRIVEN_DILATION_CAP * 0.8);
    manageLoopingSound('timeDilationSound', timeDistortionActive, 0.5);

    const singularityProximityActive = horizonReachedThisUpdate || newTimeDilationFactor >= (SENSOR_DRIVEN_DILATION_CAP * 0.8) || displayDistanceKm <= MIN_SIMULATED_DISTANCE_KM * 1.05;
    manageLoopingSound('singularityRumbleSound', singularityProximityActive, 0.7);

  }, [sensorDistance, esp32Device]);

  useEffect(() => {
    if (showHorizonFlash) {
      const timer = setTimeout(() => {
        setShowHorizonFlash(false);
      }, 750); 
      return () => clearTimeout(timer);
    }
  }, [showHorizonFlash]);


  const handleConnect = useCallback(async () => {
    setError(null);
    setBluetoothStatus('Conectando...');
    console.log("Iniciando conexión Bluetooth...");
    try {
      const callbacks: ESP32ConnectionCallbacks = {
        onConnected: (device) => {
          setEsp32Device(device);
          setBluetoothStatus(`Conectado a ${device.name || 'ESP32_AgujeroNegro'}`);
          prevDistanceToBlackHoleRef.current = MAX_SIMULATED_DISTANCE_KM; 
          horizonAlreadyFlashedRef.current = false; 
          setSensorDistance(null); // Reset sensor distance until first reading
          subscribeToDistanceUpdates((distanceCm) => {
            setSensorDistance(distanceCm);
          }, (e) => {
            setError(`Error al recibir datos: ${e.message}`);
            setBluetoothStatus('Error en Dispositivo');
          });
          playAmbientSound(); 
        },
        onDisconnected: () => {
          setEsp32Device(null);
          setBluetoothStatus('Desconectado');
          setSensorDistance(null); 
          setHorizonReachedMessageVisible(false);
          setShowHorizonFlash(false);
          horizonAlreadyFlashedRef.current = false;
          missionTimeRef.current = 0;
          shipTimeRef.current = 0;
          prevDistanceToBlackHoleRef.current = MAX_SIMULATED_DISTANCE_KM;
          setSimulationState(prev => ({ 
            ...prev, 
            distanceToBlackHole: MAX_SIMULATED_DISTANCE_KM, 
            timeDilationFactor: BASE_TIME_FLOW_RATE, 
            spaceshipSpeed: 0, 
            isApproaching: false,
            missionTimeSeconds: 0,
            shipTimeSeconds: 0,
          }));
          lastWarningDistanceRef.current = MAX_SIMULATED_DISTANCE_KM;
          manageLoopingSound('timeDilationSound', false); 
          manageLoopingSound('singularityRumbleSound', false);
        },
        onError: (err) => {
          setError(`Conexión fallida: ${err.message}`);
          setBluetoothStatus('Conexión Fallida');
        }
      };
      await connectToESP32(callbacks);
    } catch (err: any) {
      setError(`Error de conexión: ${err.message}`);
      setBluetoothStatus('Error General');
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (esp32Device) {
      console.log("Iniciando desconexión Bluetooth...");
      try {
        await disconnectESP32();
        // The onDisconnected callback from connectToESP32 should handle state cleanup.
      } catch (err: any) {
        setError(`Error de desconexión: ${err.message}`);
        setBluetoothStatus('Error General');
         // Fallback cleanup if gatt.disconnect doesn't trigger callback immediately or reliably
         setEsp32Device(null);
         setBluetoothStatus('Desconectado');
         setSensorDistance(null); 
         setHorizonReachedMessageVisible(false);
         setShowHorizonFlash(false);
         horizonAlreadyFlashedRef.current = false;
         missionTimeRef.current = 0;
         shipTimeRef.current = 0;
         prevDistanceToBlackHoleRef.current = MAX_SIMULATED_DISTANCE_KM;
         setSimulationState(prev => ({ 
            ...prev, 
            distanceToBlackHole: MAX_SIMULATED_DISTANCE_KM, 
            timeDilationFactor: BASE_TIME_FLOW_RATE, 
            spaceshipSpeed: 0, 
            isApproaching: false,
            missionTimeSeconds: 0,
            shipTimeSeconds: 0,
          }));
         lastWarningDistanceRef.current = MAX_SIMULATED_DISTANCE_KM;
         manageLoopingSound('timeDilationSound', false);
         manageLoopingSound('singularityRumbleSound', false);
      }
    }
  }, [esp32Device]);

  return (
    <div className="flex flex-col h-screen bg-black text-cyan-300 font-orbitron relative overflow-hidden">
      <BlackHoleCanvas
        distanceToBlackHole={simulationState.distanceToBlackHole}
        timeDilationFactor={simulationState.timeDilationFactor}
        maxSimulatedDistanceKm={MAX_SIMULATED_DISTANCE_KM}
        minSimulatedDistanceKm={MIN_SIMULATED_DISTANCE_KM}
        spaceshipSpeed={simulationState.spaceshipSpeed}
        isApproaching={simulationState.isApproaching}
        showHorizonFlash={showHorizonFlash} 
      />
      <div className="absolute top-0 left-0 right-0 p-4 bg-black bg-opacity-50 z-10">
        <h1 className="text-3xl md:text-4xl text-center text-glow uppercase tracking-widest">Simulador de Proximidad a Agujero Negro</h1>
      </div>
      <ControlPanel
        simulationState={simulationState}
        bluetoothStatus={bluetoothStatus}
        sensorDistance={sensorDistance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        isConnected={!!esp32Device}
        error={error}
        horizonReachedMessageVisible={horizonReachedMessageVisible}
      />
       {/* 
        ==================================================================================================================================
        ||                                                                                                                              ||
        ||  ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!! ¡¡¡ ATENCIÓN !!!       ||
        ||                                                                                                                              ||
        ||                                        LOS ARCHIVOS DE SONIDO SON TU RESPONSABILIDAD                                           ||
        ||                                                                                                                              ||
        ==================================================================================================================================
        ||                                                                                                                              ||
        || Esta aplicación NO GENERA archivos de sonido. DEBES PROVEERLOS TÚ MISMO.                                                      ||
        || Para que los efectos de sonido funcionen, DEBES seguir estos pasos EXACTAMENTE:                                                ||
        ||                                                                                                                              ||
        || 1. En la RAÍZ de tu proyecto (al mismo nivel que la carpeta 'src'), CREA una carpeta llamada 'public'.                         ||
        || 2. Dentro de la carpeta 'public', CREA OTRA carpeta llamada 'sounds'.                                                          ||
        ||    (La estructura de carpetas DEBE SER: tu-proyecto-raiz/public/sounds/)                                                      ||
        || 3. CONSIGUE o CREA los siguientes archivos de audio (se recomienda formato .mp3) y COLÓCALOS DENTRO de 'public/sounds/':       ||
        ||                                                                                                                              ||
        ||      - deep_space_drone.mp3           (para el ambiente, idealmente un bucle largo y sutil)                                  ||
        ||      - proximity_ominous_pulse.mp3    (para la alerta de proximidad incremental)                                             ||
        ||      - standard_warning_klaxon.mp3    (para la advertencia general de peligro)                                                 ||
        ||      - time_distortion_field.mp3      (para el efecto de distorsión temporal, debe ser un bucle)                               ||
        ||      - singularity_approach_rumble.mp3 (para la cercanía extrema a la singularidad, debe ser un bucle)                         ||
        ||                                                                                                                              ||
        || SI ESTOS ARCHIVOS (CON ESTOS NOMBRES EXACTOS) NO ESTÁN EN 'public/sounds/', LOS SONIDOS NO FUNCIONARÁN.                        ||
        || REVISA LA CONSOLA DE TU NAVEGADOR (usualmente F12) PARA VER MENSAJES DE ERROR O ADVERTENCIAS RELACIONADOS CON LOS SONIDOS.    ||
        || Los diagnósticos de audio añadidos en App.tsx también te darán pistas en la consola.                                         ||
        ||                                                                                                                              ||
        ==================================================================================================================================
       */}
       <audio id="standardWarningSound" src="/sounds/standard_warning_klaxon.mp3"></audio>
       <audio id="ambientDroneSound" src="/sounds/deep_space_drone.mp3" loop></audio>
       <audio id="proximityPulseSound" src="/sounds/proximity_ominous_pulse.mp3"></audio>
       <audio id="timeDilationSound" src="/sounds/time_distortion_field.mp3" loop></audio>
       <audio id="singularityRumbleSound" src="/sounds/singularity_approach_rumble.mp3" loop></audio>
    </div>
  );
};

export default App;