#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h> // Para descriptores de notificación

// HC-SR04 Sensor Pins
const int trigPin = 4;  // ESP32 pin D5 conectado a Trig pin of HC-SR04
const int echoPin = 5; // ESP32 pin D18 conectado a Echo pin of HC-SR04
const int ledPin = 6;  // LED para simular acercamiento

// Variables para el control del LED
unsigned long lastLedBlinkTime = 0;
int ledState = LOW;

// Bluetooth Service and Characteristic UUIDs (deben coincidir con la app web)
#define SERVICE_UUID           "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID_RX "0000ffe1-0000-1000-8000-00805f9b34fb" // ESP32 envía (TX), Web App recibe (RX)

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
unsigned long lastDistanceSendTime = 0;
const long distanceSendInterval = 200; // Enviar distancia cada 200ms
const unsigned long pulseTimeout = 25000; // Timeout para pulseIn en microsegundos (aprox. 4m de rango para HC-SR04)


// Callbacks del Servidor BLE
class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("Dispositivo Conectado");
    }

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("Dispositivo Desconectado");
        BLEDevice::startAdvertising(); // Reiniciar advertising al desconectar
        Serial.println("Reiniciando advertising...");
    }
};

float getDistanceCm() {
    long duration;
    float distanceCm;

    // Limpia el trigPin
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    // Establece el trigPin en estado ALTO por 10 microsegundos
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Lee el echoPin, retorna el tiempo de viaje de la onda de sonido en microsegundos
    duration = pulseIn(echoPin, HIGH, pulseTimeout); // Añadido timeout

    if (duration == 0) { // Timeout o fallo en la lectura
        Serial.println("Error en lectura de HC-SR04 o fuera de rango (timeout)");
        return 400.0; // Devuelve un valor alto para indicar error o distancia máxima
    }

    // Calcula la distancia
    distanceCm = duration * 0.034 / 2; // Velocidad de la onda de sonido dividida por 2 (ida y vuelta)

    // Filtro básico para valores fuera de rango
    if (distanceCm < 2) {
        return 2.0; // Distancia mínima
    }
    if (distanceCm > 400) {
        return 400.0; // Distancia máxima (o valor de error)
    }
    return distanceCm;
}

void updateLedEffect(float distance) {
    // Calcular el intervalo de parpadeo basado en la distancia
    long blinkInterval;
    
    if (distance <= 10) { // Muy cerca del "horizonte de eventos"
        blinkInterval = 50; // Parpadeo muy rápido
    } else if (distance <= 30) {
        blinkInterval = 100; // Parpadeo rápido
    } else if (distance <= 60) {
        blinkInterval = 300; // Parpadeo medio
    } else if (distance <= 100) {
        blinkInterval = 500; // Parpadeo lento
    } else {
        blinkInterval = 1000; // Parpadeo muy lento cuando está lejos
    }

    // Actualizar el estado del LED basado en el intervalo
    if (millis() - lastLedBlinkTime > blinkInterval) {
        ledState = (ledState == LOW) ? HIGH : LOW;
        digitalWrite(ledPin, ledState);
        lastLedBlinkTime = millis();
    }
}

void setup() {
    Serial.begin(115200);
    Serial.println("Iniciando ESP32 Simulador de Agujero Negro...");

    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
    pinMode(ledPin, OUTPUT);
    pinMode(ledPin, OUTPUT); // Inicializar pin del LED

    // Crear el Dispositivo BLE
    BLEDevice::init("ESP32_AgujeroNegro"); // Nombre del dispositivo Bluetooth

    // Crear el Servidor BLE
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    // Crear el Servicio BLE
    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Crear una Característica BLE
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID_RX,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );

    // Añadir un descriptor para notificaciones (necesario para que las notificaciones funcionen)
    pCharacteristic->addDescriptor(new BLE2902());

    // Iniciar el servicio
    pService->start();

    // Iniciar advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true); 
    // Opciones para ayudar con problemas de conexión en iPhone/iOS
    // pAdvertising->setMinPreferred(0x06); // Esto es obsoleto o incorrecto para esta API
    // pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("Esperando conexión de un cliente...");
}

void loop() {
    if (deviceConnected) {
        if (millis() - lastDistanceSendTime > distanceSendInterval) {
            float distance = getDistanceCm();
            Serial.print("Distancia: ");
            Serial.print(distance);
            Serial.println(" cm");

            // Convertir float a string y añadir nueva línea
            char distanceValStr[10]; // Buffer para el valor numérico (ej: "123.45")
            dtostrf(distance, 1, 2, distanceValStr); // (valor, ancho_min, precision_decimales, buffer)
                                                    // Usar ancho_min=1 para no tener padding de espacios.

            char messageToSend[20]; // Buffer para el valor + \n + \0
            snprintf(messageToSend, sizeof(messageToSend), "%s\n", distanceValStr);

            // Enviar el valor al cliente conectado
            pCharacteristic->setValue((uint8_t*)messageToSend, strlen(messageToSend));
            pCharacteristic->notify();

            // Actualizar el efecto del LED basado en la distancia
            updateLedEffect(distance);

            lastDistanceSendTime = millis();
        }
    }
    // Si no está conectado, el advertising es manejado por los callbacks o se reinicia allí.
    delay(10); // Pequeño delay para evitar busy-looping y permitir otras tareas del ESP32.
}
