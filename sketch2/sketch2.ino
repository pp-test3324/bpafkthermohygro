#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <time.h>

// Panggil file konfigurasi lokal Anda
#include "config.h" 

WiFiClientSecure espClient;
PubSubClient client(espClient);

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastMsg = 0;
const long interval = 300000;
float t = 0.0;
float h = 0.0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Terhubung!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

void sync_time() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Menyelaraskan waktu via NTP");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println("\nWaktu tersinkronisasi!");

  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  Serial.print("Waktu UTC saat ini: ");
  Serial.println(asctime(&timeinfo));
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Menghubungkan ke EMQX Cloud via TLS...");
    
    String clientId = "ESP32_" + String((uint32_t)ESP.getEfuseMac(), HEX);

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      Serial.println(" BERHASIL TERHUBUNG!");
    } else {
      Serial.print(" Gagal, rc=");
      Serial.println(client.state());
      Serial.println("Mencoba lagi dalam 5 detik...");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  dht.begin();
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Gagal inisialisasi OLED!"));
    for(;;);
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 25);
  display.println(F("Connecting WiFi..."));
  display.display();

  setup_wifi();
  sync_time();

  // Konfigurasi TLS pada ESP32 Core 3.x
  espClient.setCACert(ca_cert);

  client.setServer(mqtt_server, mqtt_port);
  client.setBufferSize(512);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > interval) {
    lastMsg = now;

    float newH = dht.readHumidity();
    float newT = dht.readTemperature();

    if (!isnan(newH) && !isnan(newT)) {
      h = newH;
      t = newT;

      String payload = "{\"temperature\": " + String(t, 1) + ", \"humidity\": " + String(h, 1) + "}";
      
      Serial.print("Publish: ");
      Serial.println(payload);

      client.publish(mqtt_topic, payload.c_str());
    } else {
      Serial.println(F("Gagal membaca sensor DHT22!"));
    }
  }

  updateDisplay(t, h);
}

void updateDisplay(float temp, float hum) {
  display.clearDisplay();

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(16, 0);
  display.print(F("EMQX THERMOHYGRO"));
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  display.setCursor(0, 18);
  display.print(F("Temp:"));
  display.setTextSize(2);
  display.setCursor(35, 15);
  display.print(temp, 1);
  display.setTextSize(1);
  display.print(F(" "));
  display.cp437(true);
  display.write(167);
  display.print(F("C"));

  display.setCursor(0, 45);
  display.print(F("Hum :"));
  display.setTextSize(2);
  display.setCursor(35, 42);
  display.print(hum, 1);
  display.setTextSize(1);
  display.print(F(" %"));

  display.display();
}
