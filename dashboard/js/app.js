/**
 * ThermoHygro IoT Dashboard - Main Application Logic
 * Integrates MQTT.js (EMQX Cloud WSS), Chart.js, Real-time KPI, Alerts & Data Export.
 */

// Global State
const appState = {
  mqttClient: null,
  isDemoMode: false,
  demoInterval: null,
  unit: 'C', // 'C' or 'F'
  readings: [], // Historical data [{ id, timestamp, timeStr, dateStr, tempC, tempF, hum, heatIndexC, dewPointC, status }]
  stats: {
    tempMin: null,
    tempMax: null,
    tempSum: 0,
    humMin: null,
    humMax: null,
    humSum: 0,
    count: 0
  },
  thresholds: {
    maxTemp: 30.0,
    minHum: 30.0,
    maxHum: 70.0,
    soundAlert: true
  },
  mqttConfig: {
    host: 'w7dceb27.ala.asia-southeast1.emqxsl.com',
    port: 8084,
    path: '/mqtt',
    topic: 'esp32/thermohygro/data',
    username: 'bpafk',
    password: 'bpafksurakarta',
    useSSL: true
  }
};

// DOM Elements & Managers
let chartManager = null;
let audioContext = null;

// Initialize App on DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  loadSavedSettings();
  initChart();
  loadSavedHistory();
  initEventListeners();
  connectMQTT();
});

// Load Settings from LocalStorage
function loadSavedSettings() {
  const savedConfig = localStorage.getItem('thermohygro_mqtt_config');
  if (savedConfig) {
    try {
      appState.mqttConfig = { ...appState.mqttConfig, ...JSON.parse(savedConfig) };
    } catch (e) {
      console.error('Error loading saved config', e);
    }
  }

  const savedThresholds = localStorage.getItem('thermohygro_thresholds');
  if (savedThresholds) {
    try {
      appState.thresholds = { ...appState.thresholds, ...JSON.parse(savedThresholds) };
      const elemMaxT = document.getElementById('maxTempThreshold');
      const elemMinH = document.getElementById('minHumThreshold');
      const elemMaxH = document.getElementById('maxHumThreshold');
      const elemSound = document.getElementById('toggleSoundAlert');

      if (elemMaxT) elemMaxT.value = appState.thresholds.maxTemp;
      if (elemMinH) elemMinH.value = appState.thresholds.minHum;
      if (elemMaxH) elemMaxH.value = appState.thresholds.maxHum;
      if (elemSound) elemSound.checked = appState.thresholds.soundAlert;
    } catch (e) {
      console.error('Error loading saved thresholds', e);
    }
  }

  // Fill Config Modal Fields
  const cfgHost = document.getElementById('cfgHost');
  const cfgPort = document.getElementById('cfgPort');
  const cfgPath = document.getElementById('cfgPath');
  const cfgTopic = document.getElementById('cfgTopic');
  const cfgUser = document.getElementById('cfgUsername');
  const cfgPass = document.getElementById('cfgPassword');
  const cfgSSL = document.getElementById('cfgUseSSL');

  if (cfgHost) cfgHost.value = appState.mqttConfig.host;
  if (cfgPort) cfgPort.value = appState.mqttConfig.port;
  if (cfgPath) cfgPath.value = appState.mqttConfig.path;
  if (cfgTopic) cfgTopic.value = appState.mqttConfig.topic;
  if (cfgUser) cfgUser.value = appState.mqttConfig.username;
  if (cfgPass) cfgPass.value = appState.mqttConfig.password;
  if (cfgSSL) cfgSSL.checked = appState.mqttConfig.useSSL;
}

// Load Telemetry History from LocalStorage on Page Reload
function loadSavedHistory() {
  const savedReadings = localStorage.getItem('thermohygro_history_readings');
  const savedStats = localStorage.getItem('thermohygro_history_stats');

  if (savedReadings && savedStats) {
    try {
      appState.readings = JSON.parse(savedReadings);
      appState.stats = JSON.parse(savedStats);

      if (appState.readings.length > 0) {
        console.log(`Restoring ${appState.readings.length} historical readings from LocalStorage...`);

        appState.readings.forEach(r => {
          chartManager.addDataPoint({
            timestamp: r.timestamp,
            timeStr: r.timeStr,
            temperature: r.tempC,
            humidity: r.hum
          });
          appendRowToTable(r);
        });

        updateKPIUI();
        document.getElementById('totalDataCount').textContent = appState.stats.count;
      }
    } catch (e) {
      console.error('Error loading telemetry history from LocalStorage:', e);
    }
  }
}

// Save Telemetry History to LocalStorage
function saveHistoryToStorage() {
  try {
    // Save up to 500 recent readings to ensure optimal LocalStorage performance
    const readingsToSave = appState.readings.slice(-500);
    localStorage.setItem('thermohygro_history_readings', JSON.stringify(readingsToSave));
    localStorage.setItem('thermohygro_history_stats', JSON.stringify(appState.stats));
  } catch (e) {
    console.error('Error saving telemetry history to LocalStorage:', e);
  }
}

// Save Settings to LocalStorage
function saveSettings() {
  localStorage.setItem('thermohygro_mqtt_config', JSON.stringify(appState.mqttConfig));
  localStorage.setItem('thermohygro_thresholds', JSON.stringify(appState.thresholds));
}

// Initialize Charts
function initChart() {
  chartManager = new TelemetryChartManager('tempChart', 'humChart');
}

// Setup Event Listeners
function initEventListeners() {
  // Unit Toggle Button
  const btnUnit = document.getElementById('unitToggleBtn');
  if (btnUnit) {
    btnUnit.addEventListener('click', () => {
      appState.unit = appState.unit === 'C' ? 'F' : 'C';
      btnUnit.textContent = `°${appState.unit}`;
      const elemTempUnit = document.getElementById('tempUnit');
      if (elemTempUnit) elemTempUnit.textContent = `°${appState.unit}`;
      updateKPIUI();
    });
  }

  // Demo Mode Button
  const btnDemo = document.getElementById('btnDemoMode');
  if (btnDemo) {
    btnDemo.addEventListener('click', toggleDemoMode);
  }

  // Modal Open / Close
  const btnOpenCfg = document.getElementById('btnOpenConfig');
  if (btnOpenCfg) {
    btnOpenCfg.addEventListener('click', () => {
      document.getElementById('configModal').classList.add('active');
    });
  }

  const btnCloseCfg = document.getElementById('btnCloseConfigModal');
  if (btnCloseCfg) {
    btnCloseCfg.addEventListener('click', () => {
      document.getElementById('configModal').classList.remove('active');
    });
  }

  const cfgForm = document.getElementById('mqttConfigForm');
  if (cfgForm) {
    cfgForm.addEventListener('submit', (e) => {
      e.preventDefault();
      appState.mqttConfig.host = document.getElementById('cfgHost').value.trim();
      appState.mqttConfig.port = parseInt(document.getElementById('cfgPort').value.trim(), 10);
      appState.mqttConfig.path = document.getElementById('cfgPath').value.trim();
      appState.mqttConfig.topic = document.getElementById('cfgTopic').value.trim();
      appState.mqttConfig.username = document.getElementById('cfgUsername').value.trim();
      appState.mqttConfig.password = document.getElementById('cfgPassword').value.trim();
      appState.mqttConfig.useSSL = document.getElementById('cfgUseSSL').checked;

      saveSettings();
      document.getElementById('configModal').classList.remove('active');

      if (appState.isDemoMode) {
        toggleDemoMode(); // Turn off demo mode first
      }
      connectMQTT();
    });
  }

  const btnResetCfg = document.getElementById('btnResetConfig');
  if (btnResetCfg) {
    btnResetCfg.addEventListener('click', () => {
      document.getElementById('cfgHost').value = 'w7dceb27.ala.asia-southeast1.emqxsl.com';
      document.getElementById('cfgPort').value = 8084;
      document.getElementById('cfgPath').value = '/mqtt';
      document.getElementById('cfgTopic').value = 'esp32/thermohygro/data';
      document.getElementById('cfgUsername').value = 'bpafk';
      document.getElementById('cfgPassword').value = 'bpafksurakarta';
      document.getElementById('cfgUseSSL').checked = true;
    });
  }

  // Threshold Form Save (if exists)
  const btnSaveThresh = document.getElementById('btnSaveThresholds');
  if (btnSaveThresh) {
    btnSaveThresh.addEventListener('click', () => {
      appState.thresholds.maxTemp = parseFloat(document.getElementById('maxTempThreshold').value) || 30.0;
      appState.thresholds.minHum = parseFloat(document.getElementById('minHumThreshold').value) || 30.0;
      appState.thresholds.maxHum = parseFloat(document.getElementById('maxHumThreshold').value) || 70.0;
      appState.thresholds.soundAlert = document.getElementById('toggleSoundAlert').checked;

      saveSettings();
      showNotification('Ambang batas berhasil diperbarui!', 'success');
    });
  }

  // Chart Range Filters
  const btnR15m = document.getElementById('btnRange15m');
  if (btnR15m) {
    btnR15m.addEventListener('click', (e) => {
      setActiveChartFilterBtn(e.target);
      chartManager.setFilter('15m');
    });
  }

  const btnR1h = document.getElementById('btnRange1h');
  if (btnR1h) {
    btnR1h.addEventListener('click', (e) => {
      setActiveChartFilterBtn(e.target);
      chartManager.setFilter('1h');
    });
  }

  const btnRAll = document.getElementById('btnRangeAll');
  if (btnRAll) {
    btnRAll.addEventListener('click', (e) => {
      setActiveChartFilterBtn(e.target);
      chartManager.setFilter('all');
    });
  }

  // Connection Status Pill Click -> Reconnect
  const statusPill = document.getElementById('connectionStatusPill');
  if (statusPill) {
    statusPill.style.cursor = 'pointer';
    statusPill.title = 'Klik untuk menghubungkan ulang ke EMQX MQTT';
    statusPill.addEventListener('click', () => {
      showNotification('Mencoba menghubungkan ulang ke EMQX Broker...', 'info');
      connectMQTT();
    });
  }

  // Export, Import & Delete Buttons
  const btnCSV = document.getElementById('btnExportCSV');
  if (btnCSV) btnCSV.addEventListener('click', exportToCSV);

  const btnJSON = document.getElementById('btnExportJSON');
  if (btnJSON) btnJSON.addEventListener('click', exportToJSON);

  const btnImport = document.getElementById('btnImportJSON');
  const inputJSONFile = document.getElementById('jsonFileInput');
  if (btnImport && inputJSONFile) {
    btnImport.addEventListener('click', () => inputJSONFile.click());
    inputJSONFile.addEventListener('change', importFromJSON);
  }

  const btnClear = document.getElementById('btnClearLogs');
  if (btnClear) btnClear.addEventListener('click', clearLogs);

  // Table Search Filter
  const inputSearch = document.getElementById('tableSearchInput');
  if (inputSearch) {
    inputSearch.addEventListener('input', (e) => {
      filterLogsTable(e.target.value);
    });
  }

  // Test Publish Button
  const btnTestPublish = document.getElementById('btnTestPublish');
  if (btnTestPublish) {
    btnTestPublish.addEventListener('click', sendTestMQTTMessage);
  }
}

function setActiveChartFilterBtn(targetBtn) {
  document.querySelectorAll('.btn-group-item').forEach(b => b.classList.remove('active'));
  targetBtn.classList.add('active');
}

// Flexible Temperature Extractor
function extractTemperature(data, rawText) {
  if (data && typeof data === 'object') {
    const keys = ['temperature', 'temp', 'tempC', 't', 'suhu', 'Temp', 'Temperature', 'Suhu'];
    for (let k of keys) {
      if (data[k] !== undefined && data[k] !== null) {
        const val = parseFloat(data[k]);
        if (!isNaN(val)) return val;
      }
    }
  }

  // Fallback Regex for plain text or unstructured JSON
  const matches = rawText.match(/(?:temp|suhu|temperature|t)[^\d.-]*([-+]?\d*\.?\d+)/i);
  if (matches && matches[1]) {
    const val = parseFloat(matches[1]);
    if (!isNaN(val)) return val;
  }

  return null;
}

// Flexible Humidity Extractor
function extractHumidity(data, rawText) {
  if (data && typeof data === 'object') {
    const keys = ['humidity', 'hum', 'rh', 'h', 'kelembapan', 'Hum', 'Humidity', 'RH', 'Kelembapan'];
    for (let k of keys) {
      if (data[k] !== undefined && data[k] !== null) {
        const val = parseFloat(data[k]);
        if (!isNaN(val)) return val;
      }
    }
  }

  // Fallback Regex for plain text
  const matches = rawText.match(/(?:hum|kelembapan|humidity|h|rh)[^\d.-]*([-+]?\d*\.?\d+)/i);
  if (matches && matches[1]) {
    const val = parseFloat(matches[1]);
    if (!isNaN(val)) return val;
  }

  return null;
}

// Send Test MQTT Message for verification
function sendTestMQTTMessage() {
  if (!appState.mqttClient || !appState.mqttClient.connected) {
    showNotification('MQTT belum terhubung ke EMQX!', 'warning');
    return;
  }

  const testTemp = parseFloat((25 + Math.random() * 6).toFixed(1));
  const testHum = parseFloat((55 + Math.random() * 15).toFixed(1));
  const payloadStr = JSON.stringify({ temperature: testTemp, humidity: testHum });

  appState.mqttClient.publish(appState.mqttConfig.topic, payloadStr, (err) => {
    if (err) {
      showNotification('Gagal mengirim test message: ' + err.message, 'warning');
    } else {
      showNotification(`Test message berhasil dikirim ke ${appState.mqttConfig.topic}!`, 'success');
    }
  });
}

// MQTT Connection via MQTT.js WSS
function connectMQTT() {
  if (appState.mqttClient) {
    try {
      appState.mqttClient.end(true);
    } catch (e) {
      console.warn('Error ending previous MQTT client', e);
    }
  }

  updateConnectionStatus('connecting', 'Menghubungkan...');

  const activeSubTopic = document.getElementById('activeSubTopic');
  if (activeSubTopic) {
    activeSubTopic.textContent = appState.mqttConfig.topic;
  }

  let mqttLib = window.mqtt || window.MQTT;
  if (mqttLib && mqttLib.default) {
    mqttLib = mqttLib.default;
  }

  if (!mqttLib || typeof mqttLib.connect !== 'function') {
    console.error('MQTT.js library not available on window object!');
    updateConnectionStatus('disconnected', 'Library Error');
    return;
  }

  const protocol = appState.mqttConfig.useSSL ? 'wss' : 'ws';
  const url = `${protocol}://${appState.mqttConfig.host}:${appState.mqttConfig.port}${appState.mqttConfig.path}`;
  const clientId = 'web_dashboard_' + Math.random().toString(16).substr(2, 8);

  const options = {
    clientId: clientId,
    username: appState.mqttConfig.username,
    password: appState.mqttConfig.password,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000
  };

  console.log(`Connecting to MQTT broker at ${url} with clientId ${clientId}...`);

  try {
    appState.mqttClient = mqttLib.connect(url, options);

    appState.mqttClient.on('connect', () => {
      console.log('MQTT Connected successfully to EMQX!');
      updateConnectionStatus('connected', 'Terhubung (EMQX)');
      appState.mqttClient.subscribe(appState.mqttConfig.topic, (err) => {
        if (err) {
          console.error('Subscription error:', err);
          showNotification(`Gagal subscribe topic ${appState.mqttConfig.topic}`, 'warning');
        } else {
          console.log(`Subscribed to topic: ${appState.mqttConfig.topic}`);
          showNotification(`Terhubung ke topic: ${appState.mqttConfig.topic}`, 'success');
        }
      });
    });

    appState.mqttClient.on('message', (topic, message) => {
      const payloadStr = message.toString();
      console.log(`Received message on ${topic}: ${payloadStr}`);

      // Update Inspector UI if present
      const inspectorText = document.getElementById('rawPacketText');
      if (inspectorText) {
        inspectorText.textContent = `[${new Date().toLocaleTimeString('id-ID')}] ${topic} -> ${payloadStr}`;
      }

      let data = null;
      try {
        data = JSON.parse(payloadStr);
      } catch (e) {
        console.log('Payload is not strict JSON, fallback parsing...', payloadStr);
      }

      let tempC = extractTemperature(data, payloadStr);
      let humidity = extractHumidity(data, payloadStr);

      // Fallback: If both extraction attempts failed, check for any 2 numbers in raw text
      if (tempC === null || humidity === null) {
        const numbers = payloadStr.match(/[-+]?\d*\.?\d+/g);
        if (numbers && numbers.length >= 2) {
          tempC = parseFloat(numbers[0]);
          humidity = parseFloat(numbers[1]);
        }
      }

      if (tempC !== null && humidity !== null) {
        processSensorReading(tempC, humidity, 'EMQX MQTT');
      } else {
        console.warn('Could not extract temperature & humidity from payload:', payloadStr);
      }
    });

    appState.mqttClient.on('error', (err) => {
      console.error('MQTT Error:', err);
      updateConnectionStatus('disconnected', 'Gagal Terhubung');
    });

    appState.mqttClient.on('offline', () => {
      updateConnectionStatus('disconnected', 'Terputus');
    });

    appState.mqttClient.on('reconnect', () => {
      updateConnectionStatus('connecting', 'Mencoba lagi...');
    });

  } catch (err) {
    console.error('MQTT Setup Exception:', err);
    updateConnectionStatus('disconnected', 'Error SSL/Host');
  }
}

// Connection Status UI Helper
function updateConnectionStatus(type, labelText) {
  const pill = document.getElementById('connectionStatusPill');
  const text = document.getElementById('connectionStatusText');

  pill.className = 'status-pill';

  if (type === 'connected') {
    pill.classList.add('status-connected');
  } else if (type === 'connecting') {
    pill.classList.add('status-connecting');
  } else if (type === 'demo') {
    pill.classList.add('status-demo');
  } else {
    pill.classList.add('status-disconnected');
  }

  text.textContent = labelText;
}

// Toggle Demo Mode (Simulation Data)
function toggleDemoMode() {
  const btn = document.getElementById('btnDemoMode');

  if (!appState.isDemoMode) {
    appState.isDemoMode = true;
    btn.classList.add('active');
    btn.innerHTML = '<i class="fa-solid fa-flask"></i> Stop Demo';
    updateConnectionStatus('demo', 'Demo Mode (Simulasi)');

    if (appState.mqttClient) {
      appState.mqttClient.end();
    }

    // Generate initial reading immediately
    generateSimulatedData();

    // Start interval every 3 seconds
    appState.demoInterval = setInterval(generateSimulatedData, 3000);
    showNotification('Mode simulasi data diaktifkan!', 'warning');

  } else {
    appState.isDemoMode = false;
    btn.classList.remove('active');
    btn.innerHTML = '<i class="fa-solid fa-flask"></i> <span class="btn-text">Demo Mode</span>';

    if (appState.demoInterval) {
      clearInterval(appState.demoInterval);
      appState.demoInterval = null;
    }

    showNotification('Mode simulasi dimatikan, menghubungkan ulang ke EMQX...', 'info');
    connectMQTT();
  }
}

function generateSimulatedData() {
  const lastReading = appState.readings.length > 0 ? appState.readings[appState.readings.length - 1] : null;

  let baseTemp = lastReading ? lastReading.tempC : 27.5;
  let baseHum = lastReading ? lastReading.hum : 64.0;

  // Random walk simulation
  let tempDelta = (Math.random() - 0.48) * 0.8;
  let humDelta = (Math.random() - 0.48) * 1.5;

  let newTemp = Math.min(Math.max(baseTemp + tempDelta, 22.0), 36.0);
  let newHum = Math.min(Math.max(baseHum + humDelta, 35.0), 85.0);

  processSensorReading(parseFloat(newTemp.toFixed(1)), parseFloat(newHum.toFixed(1)), 'Simulasi');
}

// Indonesian Date Time Formatter (e.g. "16 Agu 2026, 08.14.32")
function formatIndonesianDateTime(dateObj) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}.${minutes}.${seconds}`;
}

// Process Incoming Reading
function processSensorReading(tempC, humidity, source = 'Sensor') {
  const now = new Date();
  const fullDateTimeStr = formatIndonesianDateTime(now);
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Calculations
  const tempF = (tempC * 9 / 5) + 32;

  // Calculate 1-Hour Rolling Average (Last 12 readings per 5-minute interval = 1 hour)
  const recent11 = appState.readings.slice(-11);
  let sumT = tempC;
  let sumH = humidity;
  recent11.forEach(r => {
    sumT += r.tempC;
    sumH += r.hum;
  });
  const hourlyCount = recent11.length + 1;
  const hourlyTempAvgC = parseFloat((sumT / hourlyCount).toFixed(2));
  const hourlyHumAvg = parseFloat((sumH / hourlyCount).toFixed(2));

  // Check Thresholds & Alerts
  let alertTriggered = false;
  let alertMessages = [];

  if (tempC > appState.thresholds.maxTemp) {
    alertTriggered = true;
    alertMessages.push(`Suhu Tinggi (${tempC}°C > Maks ${appState.thresholds.maxTemp}°C)`);
  }
  if (humidity < appState.thresholds.minHum) {
    alertTriggered = true;
    alertMessages.push(`Kelembapan Rendah (${humidity}% < Min ${appState.thresholds.minHum}%)`);
  } else if (humidity > appState.thresholds.maxHum) {
    alertTriggered = true;
    alertMessages.push(`Kelembapan Tinggi (${humidity}% > Maks ${appState.thresholds.maxHum}%)`);
  }

  if (alertTriggered) {
    triggerAlarmAlert(alertMessages.join(' | '));
  }

  // Update Stats
  appState.stats.count++;
  appState.stats.tempSum += tempC;
  appState.stats.humSum += humidity;

  if (appState.stats.tempMin === null || tempC < appState.stats.tempMin) appState.stats.tempMin = tempC;
  if (appState.stats.tempMax === null || tempC > appState.stats.tempMax) appState.stats.tempMax = tempC;
  if (appState.stats.humMin === null || humidity < appState.stats.humMin) appState.stats.humMin = humidity;
  if (appState.stats.humMax === null || humidity > appState.stats.humMax) appState.stats.humMax = humidity;

  const reading = {
    id: appState.readings.length + 1,
    timestamp: now.getTime(),
    fullDateTimeStr: fullDateTimeStr,
    timeStr: timeStr,
    tempC: tempC,
    tempF: parseFloat(tempF.toFixed(2)),
    hum: humidity,
    hourlyTempAvgC: hourlyTempAvgC,
    hourlyHumAvg: hourlyHumAvg,
    hourlyCount: hourlyCount,
    source: source,
    hasAlert: alertTriggered
  };

  appState.readings.push(reading);

  // Add to Chart
  chartManager.addDataPoint({
    timestamp: reading.timestamp,
    timeStr: timeStr,
    temperature: tempC,
    humidity: humidity
  });

  // Update UI Elements
  updateKPIUI();
  appendRowToTable(reading);
  document.getElementById('totalDataCount').textContent = appState.stats.count;
  saveHistoryToStorage();
}

// Update Metric KPI Cards UI (Displays Overall Average on Big Cards)
function updateKPIUI() {
  if (appState.readings.length === 0) return;

  const last = appState.readings[appState.readings.length - 1];
  const isC = appState.unit === 'C';

  // Overall Average Temperature (Formatted with 2 decimals)
  const avgTempC = appState.stats.tempSum / appState.stats.count;
  const avgTempDisplay = isC ? avgTempC : (avgTempC * 9 / 5 + 32);
  document.getElementById('tempValue').textContent = avgTempDisplay.toFixed(2).replace('.', ',');

  // Temperature Stats (Min, Latest Terkini, Max)
  const minTemp = isC ? appState.stats.tempMin : (appState.stats.tempMin * 9/5 + 32);
  const maxTemp = isC ? appState.stats.tempMax : (appState.stats.tempMax * 9/5 + 32);
  const latestTemp = isC ? last.tempC : last.tempF;

  document.getElementById('tempMin').textContent = `${minTemp.toFixed(1).replace('.', ',')} °${appState.unit}`;
  const elemTempLatest = document.getElementById('tempLatest');
  if (elemTempLatest) elemTempLatest.textContent = `${latestTemp.toFixed(1).replace('.', ',')} °${appState.unit}`;
  document.getElementById('tempMax').textContent = `${maxTemp.toFixed(1).replace('.', ',')} °${appState.unit}`;

  // Overall Average Humidity (Formatted with 2 decimals)
  const avgHumDisplay = appState.stats.humSum / appState.stats.count;
  document.getElementById('humValue').textContent = avgHumDisplay.toFixed(2).replace('.', ',');

  // Humidity Stats (Min, Latest Terkini, Max)
  document.getElementById('humMin').textContent = `${appState.stats.humMin.toFixed(1).replace('.', ',')} %`;
  const elemHumLatest = document.getElementById('humLatest');
  if (elemHumLatest) elemHumLatest.textContent = `${last.hum.toFixed(1).replace('.', ',')} %`;
  document.getElementById('humMax').textContent = `${appState.stats.humMax.toFixed(1).replace('.', ',')} %`;
}

// Table Append Logic (Matches Reference Image: No. | Waktu | Suhu | Kelembapan)
function appendRowToTable(reading) {
  const tbody = document.getElementById('logsTableBody');

  // Clear empty row on first item
  const emptyRow = tbody.querySelector('.empty-row');
  if (emptyRow) {
    tbody.innerHTML = '';
  }

  const tr = document.createElement('tr');
  if (reading.hasAlert) {
    tr.style.backgroundColor = 'rgba(244, 63, 94, 0.08)';
  }

  const formattedTemp = reading.tempC.toFixed(1).replace('.', ',');
  const formattedHum = reading.hum.toFixed(1).replace('.', ',');

  tr.innerHTML = `
    <td><strong>${reading.id}.</strong></td>
    <td>${reading.fullDateTimeStr}</td>
    <td><span style="color:var(--temp-primary); font-weight:600;">${formattedTemp}</span></td>
    <td><span style="color:var(--hum-primary); font-weight:600;">${formattedHum}</span></td>
  `;

  tbody.insertBefore(tr, tbody.firstChild);

  // Keep table size manageable (limit DOM rows to 100)
  if (tbody.children.length > 100) {
    tbody.removeChild(tbody.lastChild);
  }
}

function filterLogsTable(keyword) {
  const term = keyword.toLowerCase();
  const rows = document.querySelectorAll('#logsTableBody tr');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(term) ? '' : 'none';
  });
}

// Export Functions
function exportToCSV() {
  if (appState.readings.length === 0) {
    showNotification('Tidak ada data untuk diekspor!', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID,Waktu,Suhu (C),Suhu (F),Kelembapan (%),Sumber,Alert\n";

  appState.readings.forEach(r => {
    const row = [
      r.id,
      `"${r.fullDateTimeStr}"`,
      r.tempC,
      r.tempF,
      r.hum,
      `"${r.source}"`,
      r.hasAlert ? "Ya" : "Tidak"
    ].join(",");
    csvContent += row + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `thermohygro_logs_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification('File CSV berhasil diunduh!', 'success');
}

function exportToJSON() {
  if (appState.readings.length === 0) {
    showNotification('Tidak ada data untuk diekspor!', 'warning');
    return;
  }

  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState.readings, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", jsonStr);
  link.setAttribute("download", `thermohygro_logs_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showNotification('File JSON berhasil diunduh!', 'success');
}

function importFromJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData) && importedData.length > 0) {
        // Reset current state memory
        appState.readings = [];
        appState.stats = {
          tempMin: null, tempMax: null, tempSum: 0,
          humMin: null, humMax: null, humSum: 0, count: 0
        };

        chartManager.clearData();
        const tbody = document.getElementById('logsTableBody');
        if (tbody) tbody.innerHTML = '';

        importedData.forEach(r => {
          let tempC = r.tempC !== undefined ? r.tempC : extractTemperature(r, '');
          let hum = r.hum !== undefined ? r.hum : extractHumidity(r, '');

          if (tempC !== null && hum !== null) {
            tempC = parseFloat(tempC);
            hum = parseFloat(hum);

            // Re-calculate statistics
            appState.stats.count++;
            appState.stats.tempSum += tempC;
            appState.stats.humSum += hum;

            if (appState.stats.tempMin === null || tempC < appState.stats.tempMin) appState.stats.tempMin = tempC;
            if (appState.stats.tempMax === null || tempC > appState.stats.tempMax) appState.stats.tempMax = tempC;
            if (appState.stats.humMin === null || hum < appState.stats.humMin) appState.stats.humMin = hum;
            if (appState.stats.humMax === null || hum > appState.stats.humMax) appState.stats.humMax = hum;

            const reading = {
              id: appState.readings.length + 1,
              timestamp: r.timestamp || Date.now(),
              fullDateTimeStr: r.fullDateTimeStr || r.timeStr || new Date().toLocaleString('id-ID'),
              timeStr: r.timeStr || new Date().toLocaleTimeString('id-ID'),
              tempC: tempC,
              tempF: parseFloat((tempC * 9/5 + 32).toFixed(2)),
              hum: hum,
              source: r.source || 'Impor JSON',
              hasAlert: !!r.hasAlert
            };

            appState.readings.push(reading);

            chartManager.addDataPoint({
              timestamp: reading.timestamp,
              timeStr: reading.timeStr,
              temperature: tempC,
              humidity: hum
            });

            appendRowToTable(reading);
          }
        });

        updateKPIUI();
        document.getElementById('totalDataCount').textContent = appState.stats.count;
        saveHistoryToStorage();

        showNotification(`Berhasil mengimpor ${appState.readings.length} data riwayat!`, 'success');
      } else {
        showNotification('Format file JSON tidak valid atau kosong.', 'warning');
      }
    } catch (err) {
      console.error('Error importing JSON:', err);
      showNotification('Gagal mengimpor file JSON: ' + err.message, 'warning');
    }
  };

  reader.readAsText(file);
  event.target.value = ''; // Reset input so same file can be selected again
}

function clearLogs() {
  if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat telemetri?')) {
    appState.readings = [];
    appState.stats = {
      tempMin: null, tempMax: null, tempSum: 0,
      humMin: null, humMax: null, humSum: 0, count: 0
    };

    localStorage.removeItem('thermohygro_history_readings');
    localStorage.removeItem('thermohygro_history_stats');

    chartManager.clearData();

    document.getElementById('logsTableBody').innerHTML = `
      <tr class="empty-row">
        <td colspan="4">
          <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p>Menunggu data telemetri masuk dari EMQX (Tiap 5 Menit)...</p>
          </div>
        </td>
      </tr>
    `;

    document.getElementById('totalDataCount').textContent = '0';
    document.getElementById('tempValue').textContent = '--,--';
    document.getElementById('humValue').textContent = '--,--';

    const elemTempMin = document.getElementById('tempMin');
    const elemTempLatest = document.getElementById('tempLatest');
    const elemTempMax = document.getElementById('tempMax');
    const elemHumMin = document.getElementById('humMin');
    const elemHumLatest = document.getElementById('humLatest');
    const elemHumMax = document.getElementById('humMax');

    if (elemTempMin) elemTempMin.textContent = '--,- °C';
    if (elemTempLatest) elemTempLatest.textContent = '--,- °C';
    if (elemTempMax) elemTempMax.textContent = '--,- °C';
    if (elemHumMin) elemHumMin.textContent = '--,- %';
    if (elemHumLatest) elemHumLatest.textContent = '--,- %';
    if (elemHumMax) elemHumMax.textContent = '--,- %';

    showNotification('Riwayat berhasil dibersihkan!', 'info');
  }
}

// Alarm Sound & Visual Alerting
function triggerAlarmAlert(message) {
  showNotification(`⚠️ ALARM PERINGATAN: ${message}`, 'warning');

  if (appState.thresholds.soundAlert) {
    playBeepSound();
  }
}

function playBeepSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error('Audio playback error', e);
  }
}

// Toast Notifications Helper
function showNotification(msg, type = 'info') {
  const container = document.getElementById('alertBannerContainer');
  const alertDiv = document.createElement('div');

  alertDiv.className = `alert-banner ${type === 'warning' ? 'alert-warning' : ''}`;
  alertDiv.innerHTML = `
    <div><i class="fa-solid ${type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i> ${msg}</div>
    <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:inherit; cursor:pointer;">&times;</button>
  `;

  container.appendChild(alertDiv);

  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 6000);
}
