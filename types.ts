
export interface SimulationState {
  distanceToBlackHole: number; // Arbitrary units, e.g., 1 = very close, 100 = far
  timeDilationFactor: number;   // 1 = normal time, >1 means time flows slower for spaceship
  spaceshipSpeed: number;       // Arbitrary units per second
  isApproaching: boolean;       // True if current movement is towards the black hole
  missionTimeSeconds?: number;  // Optional: Current mission time in seconds
  shipTimeSeconds?: number;     // Optional: Current ship time in seconds (affected by dilation)
}

export interface SensorData {
  rawDistanceCm: number;
  // Potentially add more processed data later
}

// Add other shared types as needed