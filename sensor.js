// ═══════════════════════════════════════════════════════════════════════════
//  sensor.js  –  Reads from Firebase and renders the sensor panel
//  Sensors: MQ-135 (Air Quality) + Sound Level
// ═══════════════════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs,
         query, orderBy, limit, onSnapshot }
    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────────────────
//  🔧 PASTE YOUR FIREBASE CONFIG HERE (same as seed-firebase.html)
// ─────────────────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCLl2BjSbb6wOesxJoHzEtWu3MeeoObGtI",
  authDomain: "smart-pollution-monitor.firebaseapp.com",
  projectId: "smart-pollution-monitor",
  storageBucket: "smart-pollution-monitor.firebasestorage.app",
  messagingSenderId: "578304169408",
  appId: "1:578304169408:web:e02b2c868c880efbaba425"
};
// ─────────────────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Inject sensor panel HTML ──────────────────────────────────────────────────
function injectSensorPanel() {
    const card = document.getElementById('resultCard');
    if (!card || document.getElementById('sensorPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'sensorPanel';
    panel.innerHTML = `
        <div class="sensor-panel">

            <!-- Header -->
            <div class="sensor-header">
                <span class="sensor-title">🔬 Local Sensor Data</span>
                <span class="sensor-subtitle" id="sensorLocation">—</span>
                <span class="live-tag" style="margin-left:auto">
                    <span class="live-dot"></span> Live
                </span>
            </div>

            <!-- 2 live sensor cards -->
            <div class="sensor-live-row">

                <div class="sensor-card">
                    <div class="sc-icon">💨</div>
                    <div class="sc-label">MQ-135 — Air Quality</div>
                    <div class="sc-value" id="live-mq135">--</div>
                    <div class="sc-unit">ppm (CO₂ equivalent)</div>
                    <div class="sc-status" id="status-mq135">—</div>
                    <div class="sc-bar-wrap">
                        <div class="sc-bar" id="bar-mq135"></div>
                    </div>
                    <div class="sc-range-labels">
                        <span>0</span><span>350</span><span>700</span>
                    </div>
                </div>

                <div class="sensor-card">
                    <div class="sc-icon">🔊</div>
                    <div class="sc-label">Sound Level</div>
                    <div class="sc-value" id="live-sound">--</div>
                    <div class="sc-unit">dB</div>
                    <div class="sc-status" id="status-sound">—</div>
                    <div class="sc-bar-wrap">
                        <div class="sc-bar" id="bar-sound"></div>
                    </div>
                    <div class="sc-range-labels">
                        <span>30</span><span>65</span><span>100</span>
                    </div>
                </div>

            </div>

            <!-- 7-day trend -->
            <div class="sensor-trend">
                <div class="sensor-trend-header">
                    <span>📈 7-Day Trend</span>
                    <div class="trend-toggle">
                        <button class="trend-btn active" onclick="sensorTrendSwitch(this,'mq135')">MQ-135</button>
                        <button class="trend-btn"        onclick="sensorTrendSwitch(this,'sound')">Sound</button>
                    </div>
                </div>
                <div class="trend-bars" id="trendBars">
                    <div class="trend-loading">Loading sensor history…</div>
                </div>
            </div>

            <!-- Stats row -->
            <div class="sensor-stats-row">
                <div class="stat-box">
                    <div class="stat-label">7-day avg MQ-135</div>
                    <div class="stat-val" id="stat-mq135-avg">--</div>
                    <div class="stat-unit">ppm</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">MQ-135 peak (7d)</div>
                    <div class="stat-val" id="stat-mq135-max">--</div>
                    <div class="stat-unit">ppm</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">7-day avg Sound</div>
                    <div class="stat-val" id="stat-sound-avg">--</div>
                    <div class="stat-unit">dB</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Local AQI (sensor)</div>
                    <div class="stat-val" id="stat-local-aqi">--</div>
                    <div class="stat-unit">index</div>
                </div>
            </div>

            <div class="sensor-updated" id="sensorUpdated">Last updated: —</div>
        </div>`;

    card.appendChild(panel);
}

// ── Colour + label helpers ────────────────────────────────────────────────────
function mq135Color(v) {
    if (v < 200) return '#00e400';
    if (v < 350) return '#ffcc00';
    if (v < 500) return '#f4872a';
    return '#ff0000';
}
function mq135Label(v) {
    if (v < 200) return 'Good';
    if (v < 350) return 'Moderate';
    if (v < 500) return 'Poor';
    return 'Hazardous';
}

function soundColor(v) {
    if (v < 55) return '#00e400';
    if (v < 70) return '#ffcc00';
    if (v < 85) return '#f4872a';
    return '#ff0000';
}
function soundLabel(v) {
    if (v < 55) return 'Quiet';
    if (v < 70) return 'Moderate';
    if (v < 85) return 'Loud';
    return 'Very Loud';
}

// ── Render live card ──────────────────────────────────────────────────────────
function renderLive(data) {
    const fmt = v => typeof v === 'number' ? v.toFixed(1) : '--';

    // MQ-135
    const mq135 = data.mq135 || 0;
    const el135 = document.getElementById('live-mq135');
    el135.textContent      = fmt(mq135);
    el135.style.color      = mq135Color(mq135);
    document.getElementById('status-mq135').textContent  = mq135Label(mq135);
    document.getElementById('status-mq135').style.color  = mq135Color(mq135);
    const b135 = document.getElementById('bar-mq135');
    b135.style.width       = Math.min(100, (mq135 / 700) * 100) + '%';
    b135.style.background  = mq135Color(mq135);

    // Sound
    const sound  = data.sound || 0;
    const elSnd  = document.getElementById('live-sound');
    elSnd.textContent     = fmt(sound);
    elSnd.style.color     = soundColor(sound);
    document.getElementById('status-sound').textContent  = soundLabel(sound);
    document.getElementById('status-sound').style.color  = soundColor(sound);
    const bSnd = document.getElementById('bar-sound');
    bSnd.style.width      = Math.min(100, ((sound - 30) / 70) * 100) + '%';
    bSnd.style.background = soundColor(sound);

    // Location & time
    document.getElementById('sensorLocation').textContent = data.location || '';
    if (data.updatedAt) {
        const t = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
        document.getElementById('sensorUpdated').textContent =
            'Last updated: ' + t.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    }
}

// ── Trend chart ───────────────────────────────────────────────────────────────
let trendDays    = [];
let activeSeries = 'mq135';

window.sensorTrendSwitch = function(btn, series) {
    document.querySelectorAll('.trend-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSeries = series;
    renderTrendBars(trendDays, series);
};

function renderTrendBars(days, series) {
    const container = document.getElementById('trendBars');
    if (!days || days.length === 0) {
        container.innerHTML = '<div class="trend-loading">No historical data yet.</div>';
        return;
    }

    const colorFn  = series === 'mq135' ? mq135Color : soundColor;
    const maxScale = series === 'mq135' ? 700 : 100;
    const maxVal   = Math.max(...days.map(d => d[series]?.avg || 0), 1);
    const today    = new Date().toISOString().slice(0, 10);

    container.innerHTML = days.map(d => {
        const val     = d[series]?.avg ?? 0;
        const pct     = Math.max(4, (val / Math.max(maxVal, maxScale * 0.4)) * 100);
        const color   = colorFn(val);
        const isToday = d.date === today;
        const label   = isToday ? 'Today'
            : new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });

        return `
            <div class="trend-bar-wrap ${isToday ? 'trend-today' : ''}">
                <div class="trend-bar-val" style="color:${color}">${Math.round(val)}</div>
                <div class="trend-bar-track">
                    <div class="trend-bar" style="height:${pct}%;background:${color}"></div>
                </div>
                <div class="trend-bar-label">${label}</div>
            </div>`;
    }).join('');
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function renderStats(days) {
    if (!days || days.length === 0) return;
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    const mq135avg = avg(days.map(d => d.mq135?.avg || 0));
    const mq135max = Math.max(...days.map(d => d.mq135?.max || 0));
    const soundavg = avg(days.map(d => d.sound?.avg  || 0));
    const aqiavg   = avg(days.map(d => d.localAqi    || 0));

    const s = document.getElementById('stat-mq135-avg');
    s.textContent = mq135avg.toFixed(0);
    s.style.color = mq135Color(mq135avg);

    const sm = document.getElementById('stat-mq135-max');
    sm.textContent = mq135max.toFixed(0);
    sm.style.color = mq135Color(mq135max);

    const ss = document.getElementById('stat-sound-avg');
    ss.textContent = soundavg.toFixed(0);
    ss.style.color = soundColor(soundavg);

    document.getElementById('stat-local-aqi').textContent = aqiavg.toFixed(0);
}

// ── Main init (called from index.html) ───────────────────────────────────────
export async function initSensorPanel() {
    injectSensorPanel();

    // Real-time listener — updates instantly when ESP32 writes new data
    onSnapshot(doc(db, 'sensor_live', 'current'), snap => {
        if (snap.exists()) renderLive(snap.data());
    });

    // Load last 7 days for trend chart
    try {
        const q    = query(collection(db, 'sensor_daily'), orderBy('date', 'desc'), limit(7));
        const snap = await getDocs(q);
        trendDays  = snap.docs.map(d => d.data()).reverse();
        renderTrendBars(trendDays, activeSeries);
        renderStats(trendDays);
    } catch (err) {
        console.error('Sensor history fetch failed:', err);
    }
}