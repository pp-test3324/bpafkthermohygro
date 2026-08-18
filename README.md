# 🌡️ Web Dashboard Monitoring Suhu dan Kelembapan (Thermohygrometer IoT)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MQTT](https://img.shields.io/badge/MQTT-EMQX%20Broker-0052cc.svg)](https://www.emqx.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)

Dashboard visualisasi dan monitoring data suhu dan kelembapan real-time berbasis Web yang terintegrasi secara asinkron dengan perangkat keras **ESP32 Thermohygrometer** melalui protokol komunikasi **MQTT (Message Queuing Telemetry Transport)**.

Repositori ini merupakan bagian dari proyek:
> **"Pengembangan Dashboard Monitoring Suhu dan Kelembapan Berbasis Web dengan Integrasi Data MQTT pada Sistem Thermohygrometer"**

---

## 📌 Fitur Utama

- **Real-Time Data Streaming**: Menerima dan memperbarui data suhu (°C) dan kelembapan (%RH) secara langsung via MQTT/WebSocket tanpa perlu reload halaman.
- **Interactive Gauge & Visual Indicator**: Tampilan speedometer/gauge modern yang intuitif dengan indikator batas aman/kritis suhu dan kelembapan.
- **Historical Chart / Tren Data**: Grafik dinamis time-series untuk melacak fluktuasi kondisi lingkungan kerja/laboratorium.
- **Device Status & Health Indicator**: Indikator visual status konektivitas perangkat IoT (*Online / Offline*).
- **Responsive UI/UX**: Desain antarmuka modern yang kompatibel untuk browser desktop maupun perangkat mobile.

---

## 🏗️ Arsitektur Sistem

```text
+-----------------------+         MQTTS (TLS)         +-------------------------+
|   ESP32 Edge Device   |  ------------------------>  |       MQTT Broker       |
| (Dual-Core FreeRTOS)  |   Topic: lab/thermohygro    |     (e.g., EMQX Cloud)  |
+-----------------------+                             +-------------------------+
                                                                   |
                                                            WebSocket (WSS)
                                                                   |
                                                                   v
                                                      +-------------------------+
                                                      |   Web Client / Browser  |
                                                      |   (Dashboard Frontend)  |
                                                      +-------------------------+
