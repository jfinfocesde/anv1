
export const MIN_SENSOR_DISTANCE_CM = 2;          // Typical min for HC-SR04, for clamping raw data.
export const SENSOR_HORIZON_DISTANCE_CM = 5;      // Sensor distance in CM at which the event horizon/max dilation is reached.
export const MAX_SENSOR_REAL_DISTANCE_CM = 400;   // Actual typical max for HC-SR04, for clamping raw data if needed
export const TARGET_SENSOR_MAX_DISTANCE_CM = 100; // The sensor distance (100cm) that maps to MIN_SIMULATED_DILATION (BASE_TIME_FLOW_RATE). This defines the 1-meter range.

export const MIN_SIMULATED_DISTANCE_KM = 10;      // Closest simulated distance to black hole (e.g., event horizon proximity)
export const MAX_SIMULATED_DISTANCE_KM = 50000;   // Farthest simulated distance from black hole

export const BASE_TIME_FLOW_RATE = 1;             // Normal time flow without gravitational effects

// Constants for sensor-driven time dilation curve
export const SENSOR_DRIVEN_DILATION_CAP = 5000;   // Max dilation factor achievable directly via sensor input. Increased for more dramatic effect.

// Bluetooth Service and Characteristic UUIDs (Ensure these match your ESP32 Sketch)
export const ESP32_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
export const ESP32_CHARACTERISTIC_UUID_RX = '0000ffe1-0000-1000-8000-00805f9b34fb';