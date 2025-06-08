
import React from 'react';
import { SimulationState } from '../types';
import { MAX_SIMULATED_DISTANCE_KM, MIN_SIMULATED_DISTANCE_KM } from '../constants';

interface ControlPanelProps {
  simulationState: SimulationState;
  bluetoothStatus: string;
  sensorDistance: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnected: boolean;
  error: string | null;
  horizonReachedMessageVisible: boolean;
}

const formatChronometerTime = (totalSeconds: number | undefined): string => {
  if (totalSeconds === undefined) return '00:00.000';
  const M = Math.floor(totalSeconds / 60);
  const S = Math.floor(totalSeconds) % 60;
  const mS = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${M.toString().padStart(2, '0')}:${S.toString().padStart(2, '0')}.${mS.toString().padStart(3, '0')}`;
};

const DataField: React.FC<{ label: string; value: string | number; unit?: string; customClass?: string; valueClass?: string }> = ({ label, value, unit, customClass, valueClass }) => (
  <div className={`mb-2 p-2 rounded-md bg-gray-800 bg-opacity-70 border border-cyan-700 ${customClass || 'border-glow'}`}>
    <span className="block text-xs text-cyan-500 uppercase tracking-wider">{label}</span>
    <span className={`block text-2xl font-bold ${valueClass || 'text-glow'}`}>
      {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(value > 1000 ? 0 : (value < 100 ? 2 : 1) ) : value} {unit}
    </span>
  </div>
);

const getTimeDilationStyles = (factor: number): { dataFieldClass: string; valueClass: string; textColorClass: string } => {
  if (factor >= 4900) return { dataFieldClass: 'border-purple-500', valueClass: 'text-purple-300 text-glow-purple animate-pulse', textColorClass: 'text-purple-300' };
  if (factor > 1000) return { dataFieldClass: 'border-red-600', valueClass: 'text-red-400 text-glow-red', textColorClass: 'text-red-400' };
  if (factor > 100) return { dataFieldClass: 'border-orange-500', valueClass: 'text-orange-400 text-glow-orange', textColorClass: 'text-orange-400' }; 
  if (factor > 10) return { dataFieldClass: 'border-yellow-500', valueClass: 'text-yellow-400 text-glow-yellow', textColorClass: 'text-yellow-400' };
  return { dataFieldClass: 'border-glow', valueClass: 'text-glow', textColorClass: 'text-cyan-300' }; 
};


export const ControlPanel: React.FC<ControlPanelProps> = ({
  simulationState,
  bluetoothStatus,
  sensorDistance,
  onConnect,
  onDisconnect,
  isConnected,
  error,
  horizonReachedMessageVisible,
}) => {
  const { distanceToBlackHole, timeDilationFactor, spaceshipSpeed, isApproaching, missionTimeSeconds, shipTimeSeconds } = simulationState;

  const formatTimeDilationFactor = (factor: number): string => {
    if (horizonReachedMessageVisible || factor >= 4999) return "HORIZONTE ALCANZADO";
    if (factor > 1000) return `>${(factor/1000).toFixed(0)}k x`; 
    if (factor > 10) return `${factor.toFixed(0)}x`;
    return `${factor.toFixed(3)}x`;
  };
  
  const proximityPercentage = ((MAX_SIMULATED_DISTANCE_KM - distanceToBlackHole) / Math.max(1, MAX_SIMULATED_DISTANCE_KM - MIN_SIMULATED_DISTANCE_KM)) * 100;
  const isCriticalDistance = distanceToBlackHole < MIN_SIMULATED_DISTANCE_KM * 5; 

  const timeDilationStyles = getTimeDilationStyles(timeDilationFactor);

  const getTimeDilationClarification = (factor: number): string | null => {
    if (horizonReachedMessageVisible) return `(Tiempo prácticamente detenido para observador externo)`;
    if (factor < 1.1) return null;
    let externalEquivalent: string;
    if (factor >= 10000) {
        externalEquivalent = `>${(factor / 1000).toFixed(0)} mil`;
    } else if (factor >= 1000) {
        externalEquivalent = `${(factor / 1000).toFixed(1)} mil`;
    } else if (factor >= 100) {
        externalEquivalent = `${factor.toFixed(0)}`;
    } else if (factor >= 2) {
        externalEquivalent = `${factor.toFixed(1)}`;
    } else {
        return `(Tiempo local ligeramente más lento que el de observador externo)`;
    }
    return `(1 seg. nave ≈ ${externalEquivalent} seg. exterior)`;
  };
  const timeDilationClarificationText = getTimeDilationClarification(timeDilationFactor);


  return (
    <div className="h-full flex flex-col"> {/* Removed absolute positioning and related styles. Padding/bg handled by parent in App.tsx */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start"> {/* Adjusted grid for sidebar layout */}
        
        <div> 
          <h2 className="text-lg text-cyan-400 mb-2 uppercase tracking-wider">SISTEMA</h2>
          <DataField 
            label="Bluetooth" 
            value={bluetoothStatus} 
            customClass={bluetoothStatus.toLowerCase().includes('error') || bluetoothStatus.toLowerCase().includes('fallo') || bluetoothStatus.toLowerCase().includes('fallida') ? 'border-red-500' : 'border-glow'}
            valueClass={bluetoothStatus.toLowerCase().includes('error') || bluetoothStatus.toLowerCase().includes('fallo') || bluetoothStatus.toLowerCase().includes('fallida') ? 'text-red-400' : 'text-glow'}
          />
          {isConnected && sensorDistance !== null && (
            <DataField label="Lectura HC-SR04" value={sensorDistance.toFixed(1)} unit="cm" />
          )}
          {error && <p className="text-xs text-red-400 mt-1">Error: {error}</p>}
          {!isConnected ? (
            <button
              onClick={onConnect}
              className="w-full mt-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-green-300 active:bg-green-600"
              aria-label="Conectar ESP32"
            >
              CONECTAR ESP32
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              className="w-full mt-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-black font-bold rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-300 active:bg-red-600"
              aria-label="Desconectar ESP32"
            >
              DESCONECTAR
            </button>
          )}
        </div>

        <div> 
          <h2 className="text-lg text-cyan-400 mb-2 uppercase tracking-wider">NAVEGACIÓN</h2>
          <DataField 
            label="Distancia al Event Horizon" 
            value={distanceToBlackHole} 
            unit="km (Sim.)" 
            customClass={isCriticalDistance || horizonReachedMessageVisible ? 'border-red-500' : 'border-glow'}
            valueClass={isCriticalDistance || horizonReachedMessageVisible ? 'text-red-400 text-glow-red' : 'text-glow'}
          />
          <DataField label="Velocidad Relativa" value={spaceshipSpeed.toFixed(0)} unit="km/tick (Sim.)" />
          <DataField 
            label="Vector" 
            value={isApproaching ? 'APROXIMANDO' : (spaceshipSpeed > MAX_SIMULATED_DISTANCE_KM * 0.0001 ? 'RETROCEDIENDO' : 'ESTACIONARIO')} 
            customClass={isApproaching && (isCriticalDistance || horizonReachedMessageVisible) ? 'border-red-500' : 'border-glow'}
            valueClass={isApproaching && (isCriticalDistance || horizonReachedMessageVisible) ? 'text-red-400 text-glow-red' : (isApproaching ? 'text-yellow-400 text-glow-yellow' : 'text-glow')}
          />
           <div className="mt-2 p-2 rounded-md bg-gray-800 bg-opacity-70 border border-cyan-700 border-glow">
            <span className="block text-xs text-cyan-500 uppercase tracking-wider">Alerta de Proximidad</span>
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
              <div 
                className={`h-2.5 rounded-full ${proximityPercentage >= 99 || horizonReachedMessageVisible ? 'bg-purple-600 animate-pulse' : proximityPercentage > 90 ? 'bg-red-600 animate-pulse' : proximityPercentage > 70 ? 'bg-orange-500' : proximityPercentage > 50 ? 'bg-yellow-400' : 'bg-green-500'}`}
                style={{ width: `${Math.max(0,Math.min(100,proximityPercentage))}%` }}
                aria-valuenow={proximityPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
                aria-label="Nivel de alerta de proximidad"
              ></div>
            </div>
          </div>
        </div>
        
        {/* On smaller views of the panel, Cronómetros and Relatividad will stack below Sistema and Navegación */}
        <div> 
            <h2 className="text-lg text-cyan-400 mb-2 uppercase tracking-wider">CRONÓMETROS</h2>
            <DataField
                label="Tiempo de Misión (Observador)"
                value={formatChronometerTime(missionTimeSeconds)}
                valueClass="text-4xl text-glow" 
            />
            <DataField
                label="Tiempo de Nave (Local)"
                value={formatChronometerTime(shipTimeSeconds)}
                customClass={timeDilationStyles.dataFieldClass}
                valueClass={`text-4xl ${timeDilationStyles.valueClass}`}
            />
        </div>

        <div> 
          <h2 className="text-lg text-cyan-400 mb-2 uppercase tracking-wider">RELATIVIDAD</h2>
          <DataField 
            label="Factor Dilatación Temporal" 
            value={formatTimeDilationFactor(timeDilationFactor)} 
            customClass={timeDilationStyles.dataFieldClass}
            valueClass={timeDilationStyles.valueClass} 
          />
           {timeDilationClarificationText && (
            <p className={`mt-1 text-xs ${timeDilationStyles.textColorClass}`}>{timeDilationClarificationText}</p>
          )}
          <p className={`mt-2 text-xs ${timeDilationStyles.textColorClass}`}>
            {horizonReachedMessageVisible ? "HORIZONTE DE SUCESOS ATRAVESADO. NO HAY RETORNO." :
             timeDilationFactor > 1000 ? "Distorsión temporal crítica. Consulte protocolos de singularidad." :
             timeDilationFactor > 100 ? "Distorsión temporal severa. Flujo de tiempo local alterado significativamente." :
             timeDilationFactor > 10 ? "Distorsión temporal moderada detectada." :
             timeDilationFactor > 1.1 ? "Ligera distorsión temporal detectada." :
             "Continuo espacio-tiempo nominal."}
          </p>
        </div>
      </div>
      
      <div className="mt-3 space-y-3">
        {horizonReachedMessageVisible ? (
           <div className="w-full p-3 bg-purple-900 bg-opacity-80 rounded-md border-2 border-purple-500 text-center animate-pulse" role="alert">
            <h3 className="text-2xl md:text-3xl text-purple-200 font-bold text-glow-purple uppercase">!!! HORIZONTE DE SUCESOS ALCANZADO !!!</h3>
            <p className="text-purple-100 text-md md:text-lg mt-1">Punto de no retorno. El tiempo se ha detenido efectivamente para un observador externo.</p>
          </div>
        ) : isCriticalDistance && (
          <div className="w-full p-3 bg-red-900 bg-opacity-80 rounded-md border-2 border-red-500 text-center" role="alert">
            <h3 className="text-xl md:text-2xl text-red-300 font-bold text-glow-red animate-pulse">!!! ADVERTENCIA CRÍTICA !!!</h3>
            <p className="text-red-200 text-sm md:text-base mt-1">Niveles de proximidad peligrosos. Flujo de tiempo severamente distorsionado.</p>
          </div>
        )}
      </div>

    </div>
  );
};
