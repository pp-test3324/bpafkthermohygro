#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

// Definisikan ukuran OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// Deklarasi objek OLED
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Konfigurasi DHT22
#define DHTPIN 4       // Pastikan sama dengan yang dicoba di DHTtester (GPIO 4)
#define DHTTYPE DHT22  
DHT dht(DHTPIN, DHTTYPE);

// Variabel waktu untuk jeda non-blocking
unsigned long previousMillis = 0;
const long interval = 2500; // Beri jeda 2.5 detik agar DHT22 stabil

float t = 0.0;
float h = 0.0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Inisialisasi sensor DHT
  dht.begin();

  // Inisialisasi layar OLED (Alamat I2C 0x3C)
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Alokasi SSD1306 gagal. Periksa kabel I2C!"));
    for(;;);
  }

  // Tampilkan splash screen awal
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(15, 25);
  display.println(F("Thermohygro ESP32"));
  display.display();
  delay(2000);
}

void loop() {
  unsigned long currentMillis = millis();

  // Ambil data dari DHT22 berdasarkan interval waktu
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Membaca kelembapan
    float newH = dht.readHumidity();
    // Membaca suhu dalam Celsius (default)
    float newT = dht.readTemperature();

    // Validasi apakah pembacaan berhasil (tidak NaN)
    if (isnan(newH) || isnan(newT)) {
      Serial.println(F("Gagal membaca dari sensor DHT!"));
    } else {
      h = newH;
      t = newT;
      
      // Cetak ke Serial Monitor untuk debugging
      Serial.print(F("Kelembapan: "));
      Serial.print(h);
      Serial.print(F("%  Suhu: "));
      Serial.print(t);
      Serial.println(F("°C"));
    }
  }

  // Perbarui tampilan di OLED setiap siklus loop
  updateDisplay(t, h);
}

void updateDisplay(float temp, float hum) {
  display.clearDisplay();

  // 1. Header Judul
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(18, 0);
  display.print(F("ROOM MONITOR"));
  
  // Garis pembatas bawah judul
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  // 2. Tampilkan Suhu (Temperature)
  display.setCursor(0, 18);
  display.print(F("Temp:"));
  display.setTextSize(2);
  display.setCursor(35, 15);
  display.print(temp, 1);
  display.setTextSize(1);
  display.print(F(" "));
  display.cp437(true);
  display.write(167); // Simbol derajat (°)
  display.print(F("C"));

  // 3. Tampilkan Kelembapan (Humidity)
  display.setTextSize(1);
  display.setCursor(0, 45);
  display.print(F("Hum :"));
  display.setTextSize(2);
  display.setCursor(35, 42);
  display.print(hum, 1);
  display.setTextSize(1);
  display.print(F(" %"));

  // Render ke layar OLED
  display.display();
}
