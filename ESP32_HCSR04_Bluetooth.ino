// HC-SR04 Sensor Pins
const int trigPin = 4;  // ESP32 pin D5 conectado a Trig pin of HC-SR04
const int echoPin = 5; // ESP32 pin D18 conectado a Echo pin of HC-SR04

unsigned long lastDistanceSendTime = 0;
const long distanceSendInterval = 200; // Mostrar distancia cada 200ms
const unsigned long pulseTimeout = 25000; // Timeout para pulseIn en microsegundos (aprox. 4m de rango)

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

void setup() {
    Serial.begin(115200);
    Serial.println("Iniciando ESP32 con sensor HC-SR04...");

    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
}

void loop() {
    if (millis() - lastDistanceSendTime > distanceSendInterval) {
        float distance = getDistanceCm();
        Serial.print("Distancia: ");
        Serial.print(distance);
        Serial.println(" cm");

        lastDistanceSendTime = millis();
    }
    delay(10); // Pequeño delay para evitar busy-looping
}