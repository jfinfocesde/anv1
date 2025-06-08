
// ESP32 Bluetooth Service
// Standard UART service UUIDs often used by ESP32 Bluetooth Serial
const UART_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb'; 
const UART_RX_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';


let esp32Device: BluetoothDevice | null = null;
let distanceCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let connectionCallbacks: ESP32ConnectionCallbacks | null = null;

export interface ESP32ConnectionCallbacks {
  onConnected: (device: BluetoothDevice) => void;
  onDisconnected: () => void;
  onError: (error: Error) => void;
}

export const connectToESP32 = async (callbacks: ESP32ConnectionCallbacks): Promise<void> => {
  connectionCallbacks = callbacks;
  if (!navigator.bluetooth) {
    callbacks.onError(new Error('La API Web Bluetooth no está disponible en este navegador.'));
    return;
  }

  try {
    console.log('Solicitando dispositivo Bluetooth...');
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'ESP32_AgujeroNegro' }, { services: [UART_SERVICE_UUID] }],
      optionalServices: [UART_SERVICE_UUID] 
    });
    
    if (!device) {
      callbacks.onError(new Error('No se seleccionó ningún dispositivo.'));
      return;
    }

    esp32Device = device;
    console.log('Conectando al servidor GATT...');
    if (!esp32Device.gatt) {
        callbacks.onError(new Error('Servidor GATT no disponible en este dispositivo.'));
        return;
    }
    
    esp32Device.addEventListener('gattserverdisconnected', onDisconnected);

    const server = await esp32Device.gatt.connect();
    console.log('Obteniendo Servicio...');
    const service = await server.getPrimaryService(UART_SERVICE_UUID);
    console.log('Obteniendo Característica...');
    distanceCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

    await distanceCharacteristic.startNotifications();
    distanceCharacteristic.addEventListener('characteristicvaluechanged', handleDistanceChanged);
    
    console.log('Conectado y notificaciones iniciadas.');
    callbacks.onConnected(esp32Device);

  } catch (error: any) {
    console.error('Error de conexión Bluetooth:', error);
    callbacks.onError(error);
    esp32Device = null;
    distanceCharacteristic = null;
  }
};

const onDisconnected = () => {
  console.log('Dispositivo desconectado.');
  if (distanceCharacteristic) {
    distanceCharacteristic.removeEventListener('characteristicvaluechanged', handleDistanceChanged);
    distanceCharacteristic = null;
  }
  esp32Device = null;
  if (connectionCallbacks) {
    connectionCallbacks.onDisconnected();
  }
};

export const disconnectESP32 = async (): Promise<void> => {
  if (esp32Device && esp32Device.gatt && esp32Device.gatt.connected) {
    console.log('Desconectando del dispositivo...');
    esp32Device.gatt.disconnect(); 
  } else {
    console.log('Ningún dispositivo conectado o ya desconectado.');
    if (connectionCallbacks) connectionCallbacks.onDisconnected();
  }
  distanceCharacteristic = null; 
};

let dataCallback: ((distance: number) => void) | null = null;
let errorCallback: ((error: Error) => void) | null = null;

const handleDistanceChanged = (event: Event) => {
  const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
  if (characteristic.value) {
    const value = characteristic.value;
    const decoder = new TextDecoder('utf-8');
    const distanceStr = decoder.decode(value).trim(); 
    
    const parts = distanceStr.split('\n').filter(part => part.length > 0);
    if (parts.length > 0) {
        const lastPart = parts[parts.length - 1]; 
        const distance = parseFloat(lastPart);
        if (!isNaN(distance) && dataCallback) {
            dataCallback(distance);
        } else if (isNaN(distance)) {
            if(errorCallback) errorCallback(new Error(`Dato no numérico recibido: ${lastPart}`));
        }
    }
  }
};

export const subscribeToDistanceUpdates = (
  onData: (distance: number) => void,
  onError: (error: Error) => void
): void => {
  dataCallback = onData;
  errorCallback = onError;
  if (distanceCharacteristic && distanceCharacteristic.startNotifications) {
     distanceCharacteristic.startNotifications()
        .then(() => {
            // console.log("Notifications re-confirmed for distance updates.");
        })
        .catch(err => {
            console.error("Error al reconfirmar notificaciones:", err);
            if (errorCallback) errorCallback(err);
        });
  } else if(!distanceCharacteristic) {
    // console.warn("Subscription attempt but no characteristic available.");
  }
};

window.addEventListener('beforeunload', () => {
  if (esp32Device && esp32Device.gatt && esp32Device.gatt.connected) {
    esp32Device.gatt.disconnect();
  }
});