import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BlackHoleCanvas } from './components/BlackHoleCanvas';
import { ControlPanel } from './components/ControlPanel';
import { connectToESP32, disconnectESP32, subscribeToDistanceUpdates, ESP32ConnectionCallbacks } from './services/esp32BluetoothService';
import { SimulationState } from './types';
import { 
  MAX_SIMULATED_DISTANCE_KM, 
  MIN_SIMULATED_DISTANCE_KM,
  SENSOR_HORIZON_DISTANCE_CM, 
  TARGET_SENSOR_MAX_DISTANCE_CM, 
  BASE_TIME_FLOW_RATE,
  SENSOR_DRIVEN_DILATION_CAP
} from './constants';

// Sound effect functions (unchanged)
const playSound = (soundId: string, volume?: number) => {
  const sound = document.getElementById(soundId) as HTMLAudioElement;
  if (sound) {
    console.log(`Intentando reproducir sonido: ${soundId}, Volumen: ${volume !== undefined ? volume : sound.volume}, Estado Actual: ${sound.paused ? "Pausado" : "Reproduciendo"}, ReadyState: ${sound.readyState}`);
    if (volume !== undefined) sound.volume = Math.max(0, Math.min(1, volume));
    if (sound.paused || sound.currentTime > 0 && sound.duration > 0 && sound.currentTime === sound.duration) { 
        sound.currentTime = 0; 
        sound.play().catch(e => console.warn(`Fallo al reproducir sonido ${soundId}:`, e));
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
            sound.volume = Math.max(0, Math.min(1, volume));
        }
      }
    } else {
      if (!sound.paused) {
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
      const rawClampedSensorVal = Math.max(SENSOR_HORIZON_DISTANCE_CM, Math.min(TARGET_SENSOR_MAX_DISTANCE_CM, sensorDistance));
      
      const activeSensorMinForSim = SENSOR_HORIZON_DISTANCE_CM; 
      const activeSensorMaxForSim = TARGET_SENSOR_MAX_DISTANCE_CM; 
      const sensorRangeForSim = Math.max(1, activeSensorMaxForSim - activeSensorMinForSim); 
      
      const normalizedSensorProximity = 
        Math.max(0, Math.min(1, 
          (activeSensorMaxForSim - rawClampedSensorVal) / sensorRangeForSim
        ));

      displayDistanceKm = MAX_SIMULATED_DISTANCE_KM - normalizedSensorProximity * (MAX_SIMULATED_DISTANCE_KM - MIN_SIMULATED_DISTANCE_KM);
      
      if (normalizedSensorProximity >= 1.0) { 
          newTimeDilationFactor = SENSOR_DRIVEN_DILATION_CAP;
          horizonReachedThisUpdate = true; 
          displayDistanceKm = MIN_SIMULATED_DISTANCE_KM; 
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

    } else { 
      newTimeDilationFactor = BASE_TIME_FLOW_RATE;
      displayDistanceKm = MAX_SIMULATED_DISTANCE_KM;
      horizonReachedThisUpdate = false;
    }

    setHorizonReachedMessageVisible(horizonReachedThisUpdate);

    if (horizonReachedThisUpdate && !horizonAlreadyFlashedRef.current && esp32Device) { 
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
          setSensorDistance(null); 
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
      } catch (err: any) {
        setError(`Error de desconexión: ${err.message}`);
        setBluetoothStatus('Error General');
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
    <div className="flex flex-row h-screen bg-black text-cyan-300 font-orbitron overflow-hidden">
      {/* Left Panel Container */}
      <div className="w-2/5 h-screen overflow-y-auto bg-gray-900 bg-opacity-95 border-r-2 border-cyan-600 border-glow p-3 md:p-4">
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
      </div>

      {/* Right Canvas and Title Container */}
      <div className="w-3/5 h-screen relative">
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
      </div>
      
       {/* Audio elements remain for global access - Styling unchanged */}
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
       <audio id="singularityRumbleSound" src="/sounds/singularity_approach_rumble.mp3" loop></audio>       <div style={{
        position: 'fixed',
        bottom: '15px',
        right: '15px',
        color: '#00ffff',
        fontFamily: '"Orbitron", Arial, sans-serif',
        fontSize: '14px',
        opacity: 0.85,
        textAlign: 'right',
        pointerEvents: 'none',
        zIndex: 1000,
        textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
        letterSpacing: '1px',
        padding: '8px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '4px',
        border: '1px solid rgba(0, 255, 255, 0.2)',
      }}>
        Proyecto Feria de la Ciencia 2025<br />
        <span style={{ fontSize: '12px', opacity: 0.9 }}>Por Alejandro Valencia Moreno</span>
      </div>
    </div>
  );
};

export default App;
