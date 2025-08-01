import React from 'react';
import { SimulationState } from '../types';
import { MAX_SIMULATED_DISTANCE_KM, MIN_SIMULATED_DISTANCE_KM } from '../constants';

interface ControlPanelProps {
  simulationState: SimulationState;
  onConnect: () => void;
  isConnected: boolean;
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
  <div className={`mb-1 p-1 rounded-md bg-gray-800 bg-opacity-70 border border-cyan-700 ${customClass || 'border-glow'}`}>
    <span className="block text-[0.65rem] text-cyan-500 uppercase tracking-wider">{label}</span>
    <span className={`block text-xl font-bold ${valueClass || 'text-glow'}`}>
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
  onConnect,
  isConnected,
  horizonReachedMessageVisible,
}) => {
  const { distanceToBlackHole, timeDilationFactor, missionTimeSeconds, shipTimeSeconds } = simulationState;

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
    <div className="h-full flex flex-col w-full gap-2 p-2">      {/* Sistema Section */}
      <div className="w-full"> 
        <h2 className="text-base text-cyan-400 mb-1 uppercase tracking-wider">SISTEMA</h2>
        {!isConnected && (
          <div className="flex gap-2">
            <button
              onClick={onConnect}
              className="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-md transition-colors"
            >
              Conectar Dispositivo
            </button>
          </div>
        )}
      </div>

      {/* Navegación Section */}
      <div className="w-full"> 
        <h2 className="text-base text-cyan-400 mb-1 uppercase tracking-wider">NAVEGACIÓN</h2>
        <DataField 
          label="Distancia al Event Horizon" 
          value={distanceToBlackHole} 
          unit="km" 
          customClass={`${isCriticalDistance || horizonReachedMessageVisible ? 'border-red-500' : 'border-glow'} w-full`}
          valueClass={isCriticalDistance || horizonReachedMessageVisible ? 'text-red-400 text-glow-red' : 'text-glow'}
        />
        <div className="mt-2 p-2 rounded-md bg-gray-800 bg-opacity-70 border border-cyan-700 border-glow w-full">
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
        
      {/* Cronómetros Section */}
      <div className="w-full"> 
        <h2 className="text-base text-cyan-400 mb-1 uppercase tracking-wider">CRONÓMETROS</h2>
        <DataField
          label="Tiempo de Misión (Observador)"
          value={formatChronometerTime(missionTimeSeconds)}
          valueClass="text-2xl text-glow"
          customClass="w-full"
        />
        <DataField
          label="Tiempo de Nave (Local)"
          value={formatChronometerTime(shipTimeSeconds)}
          customClass={`${timeDilationStyles.dataFieldClass} w-full`}
          valueClass={`text-2xl ${timeDilationStyles.valueClass}`}
        />
      </div>

      {/* Relatividad Section */}
      <div className="w-full"> 
        <h2 className="text-base text-cyan-400 mb-1 uppercase tracking-wider">RELATIVIDAD</h2>
        <DataField 
          label="Factor Dilatación Temporal" 
          value={formatTimeDilationFactor(timeDilationFactor)} 
          customClass={`${timeDilationStyles.dataFieldClass} w-full`}
          valueClass={timeDilationStyles.valueClass} 
        />
        {timeDilationClarificationText && (
          <p className={`mt-0.5 text-[0.65rem] ${timeDilationStyles.textColorClass}`}>{timeDilationClarificationText}</p>
        )}
        <p className={`mt-1 text-[0.65rem] ${timeDilationStyles.textColorClass}`}>
          {horizonReachedMessageVisible ? "HORIZONTE DE SUCESOS ATRAVESADO. NO HAY RETORNO." :
           timeDilationFactor > 1000 ? "Distorsión temporal crítica. Consulte protocolos de singularidad." :
           timeDilationFactor > 100 ? "Distorsión temporal severa. Flujo de tiempo local alterado significativamente." :
           timeDilationFactor > 10 ? "Distorsión temporal moderada detectada." :
           timeDilationFactor > 1.1 ? "Ligera distorsión temporal detectada." :
           "Continuo espacio-tiempo nominal."}
        </p>
      </div>
      
      {/* Mensajes de alerta */}
      <div className="w-full">
        {horizonReachedMessageVisible ? (
           <div className="w-full p-2 bg-purple-900 bg-opacity-80 rounded-md border-2 border-purple-500 text-center animate-pulse" role="alert">
            <h3 className="text-xl text-purple-200 font-bold text-glow-purple uppercase">!!! HORIZONTE DE SUCESOS ALCANZADO !!!</h3>
            <p className="text-purple-100 text-sm mt-1">Punto de no retorno. El tiempo se ha detenido efectivamente para un observador externo.</p>
          </div>
        ) : isCriticalDistance && (
          <div className="w-full p-2 bg-red-900 bg-opacity-80 rounded-md border-2 border-red-500 text-center" role="alert">
            <h3 className="text-lg text-red-300 font-bold text-glow-red animate-pulse">!!! ADVERTENCIA CRÍTICA !!!</h3>
            <p className="text-red-200 text-xs mt-1">Niveles de proximidad peligrosos. Flujo de tiempo severamente distorsionado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
