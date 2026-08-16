/**
 * ThermoHygro IoT - Chart.js Configuration & Management
 * Separate Dedicated Charts:
 *  1) Temperature Chart (°C) - Blue Theme
 *  2) Humidity Chart (%) - Orange Theme
 */

class TelemetryChartManager {
  constructor(tempCanvasId, humCanvasId) {
    this.tempCanvas = document.getElementById(tempCanvasId);
    this.humCanvas = document.getElementById(humCanvasId);

    this.tempCtx = this.tempCanvas.getContext('2d');
    this.humCtx = this.humCanvas.getContext('2d');

    this.tempChart = null;
    this.humChart = null;

    this.activeFilter = '15m'; // '15m', '1h', 'all'
    this.allDataPoints = []; // [{ timestamp, timeStr, temperature, humidity }]

    this.initCharts();
  }

  createGradient(ctx, colorStart, colorEnd) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  }

  initCharts() {
    const tempGradient = this.createGradient(this.tempCtx, 'rgba(59, 130, 246, 0.3)', 'rgba(59, 130, 246, 0.0)');
    const humGradient = this.createGradient(this.humCtx, 'rgba(249, 115, 22, 0.3)', 'rgba(249, 115, 22, 0.0)');

    // Common Tooltip Config
    const tooltipOptions = {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 10,
      boxPadding: 4,
      usePointStyle: true
    };

    // Common Scale Config
    const xAxisConfig = {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
        drawBorder: false
      },
      ticks: {
        color: '#64748b',
        font: { family: 'Inter', size: 10 },
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6
      }
    };

    // 1) Dedicated Temperature Chart (°C)
    this.tempChart = new Chart(this.tempCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Suhu (°C)',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: tempGradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipOptions,
            callbacks: {
              label: (context) => `Suhu: ${context.parsed.y.toFixed(2).replace('.', ',')} °C`
            }
          }
        },
        scales: {
          x: xAxisConfig,
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Suhu (°C)',
              color: '#3b82f6',
              font: { family: 'Inter', size: 11, weight: '600' }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 10 }
            }
          }
        }
      }
    });

    // 2) Dedicated Humidity Chart (%)
    this.humChart = new Chart(this.humCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Kelembapan (%)',
            data: [],
            borderColor: '#f97316',
            backgroundColor: humGradient,
            borderWidth: 2.5,
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#ffffff',
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipOptions,
            callbacks: {
              label: (context) => `Kelembapan: ${context.parsed.y.toFixed(2).replace('.', ',')} %`
            }
          }
        },
        scales: {
          x: xAxisConfig,
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Kelembapan (%)',
              color: '#f97316',
              font: { family: 'Inter', size: 11, weight: '600' }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.05)',
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 10 }
            },
            min: 0,
            max: 100
          }
        }
      }
    });
  }

  addDataPoint(point) {
    this.allDataPoints.push(point);
    this.render();
  }

  setFilter(rangeStr) {
    this.activeFilter = rangeStr;
    this.render();
  }

  clearData() {
    this.allDataPoints = [];
    this.tempChart.data.labels = [];
    this.tempChart.data.datasets[0].data = [];
    this.tempChart.update();

    this.humChart.data.labels = [];
    this.humChart.data.datasets[0].data = [];
    this.humChart.update();
  }

  render() {
    const now = Date.now();
    let filteredPoints = [...this.allDataPoints];

    if (this.activeFilter === '15m') {
      const cutoff = now - 15 * 60 * 1000;
      filteredPoints = filteredPoints.filter(p => p.timestamp >= cutoff);
    } else if (this.activeFilter === '1h') {
      const cutoff = now - 60 * 60 * 1000;
      filteredPoints = filteredPoints.filter(p => p.timestamp >= cutoff);
    }

    const labels = filteredPoints.map(p => p.timeStr);
    const tempData = filteredPoints.map(p => p.temperature);
    const humData = filteredPoints.map(p => p.humidity);

    // Update Temperature Chart
    this.tempChart.data.labels = labels;
    this.tempChart.data.datasets[0].data = tempData;
    this.tempChart.update('none');

    // Update Humidity Chart
    this.humChart.data.labels = labels;
    this.humChart.data.datasets[0].data = humData;
    this.humChart.update('none');
  }
}
