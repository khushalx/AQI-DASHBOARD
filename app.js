// ═══════════════════════════════════════
// GLOBALS
// ═══════════════════════════════════════
let map;
let markersLayer;
let currentCity = "Ahmedabad";

// AQI COLORS
function getAQIColor(aqi) {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

function getAQILabel(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (Sensitive)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// HEALTH TIP
function getHealthTip(aqi) {
  if (aqi <= 50) return "Air quality is good. Enjoy outdoor activities.";
  if (aqi <= 100) return "Acceptable air. Sensitive people should be cautious.";
  if (aqi <= 150) return "Limit prolonged outdoor exertion.";
  if (aqi <= 200) return "Avoid outdoor activity if possible.";
  if (aqi <= 300) return "Stay indoors. Wear a mask if outside.";
  return "Health alert! Avoid going outside.";
}

// ═══════════════════════════════════════
// INIT MAP
// ═══════════════════════════════════════
function initMap() {
  map = L.map("map").setView([23.0225, 72.5714], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// ═══════════════════════════════════════
// FETCH CITY AQI
// ═══════════════════════════════════════
async function fetchCityAQI(city) {
  try {
    showLoading(true);

    const res = await fetch(
      `https://api.waqi.info/feed/${city}/?token=${CONFIG.WAQI_TOKEN}`
    );
    const data = await res.json();

    if (data.status !== "ok") throw new Error("API error");

    updateMainUI(data.data);
    fetchNearbyStations(data.data.city.geo);

    showLoading(false);
  } catch (err) {
    console.error(err);
    showError(true);
  }
}

// ═══════════════════════════════════════
// FETCH NEARBY STATIONS
// ═══════════════════════════════════════
async function fetchNearbyStations([lat, lon]) {
  try {
    markersLayer.clearLayers();

    const res = await fetch(
      `https://api.waqi.info/map/bounds/?token=${CONFIG.WAQI_TOKEN}&latlng=${lat - 0.3},${lon - 0.3},${lat + 0.3},${lon + 0.3}`
    );

    const data = await res.json();

    const stationsList = document.getElementById("stations-list");
    stationsList.innerHTML = "";

    data.data.forEach((station) => {
      if (!station.aqi || station.aqi === "-") return;

      const aqi = Number(station.aqi);
      const color = getAQIColor(aqi);

      // MAP MARKER
      const marker = L.circleMarker(
        [station.lat, station.lon],
        {
          radius: 8,
          color: color,
          fillColor: color,
          fillOpacity: 0.8,
        }
      ).addTo(markersLayer);

      marker.on("click", () => openModal(station));

      // SIDEBAR LIST
      const div = document.createElement("div");
      div.className = "station-item";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between">
          <span>${station.station.name}</span>
          <span style="color:${color}">${aqi}</span>
        </div>
      `;
      stationsList.appendChild(div);
    });

    document.getElementById("station-count").innerText =
      `(${data.data.length})`;

  } catch (err) {
    console.error(err);
  }
}

// ═══════════════════════════════════════
// UPDATE MAIN UI
// ═══════════════════════════════════════
function updateMainUI(data) {
  const aqi = data.aqi;

  document.getElementById("city-name").innerText = data.city.name;
  document.getElementById("aqi-main-number").innerText = aqi;

  const badge = document.getElementById("aqi-main-badge");
  badge.innerText = getAQILabel(aqi);
  badge.style.background = getAQIColor(aqi);

  document.getElementById("health-tip-text").innerText =
    getHealthTip(aqi);

  // AQI BAR MARKER
  const marker = document.getElementById("aqi-bar-marker");
  const percent = Math.min(aqi / 300, 1) * 100;
  marker.style.left = percent + "%";

  // POLLUTANTS
  const grid = document.getElementById("pollutants-grid");
  grid.innerHTML = "";

  if (data.iaqi) {
    Object.entries(data.iaqi).forEach(([key, val]) => {
      const div = document.createElement("div");
      div.className = "pollutant-box";
      div.innerHTML = `
        <div style="font-size:11px;color:#9ca3af">${key.toUpperCase()}</div>
        <div style="font-size:16px">${val.v}</div>
      `;
      grid.appendChild(div);
    });
  }
}

// ═══════════════════════════════════════
// MODAL
// ═══════════════════════════════════════
function openModal(station) {
  const modal = document.getElementById("station-modal");
  modal.classList.remove("hidden");

  const aqi = Number(station.aqi);

  document.getElementById("modal-station-name").innerText =
    station.station.name;

  document.getElementById("modal-aqi-num").innerText = aqi;

  const badge = document.getElementById("modal-aqi-badge");
  badge.innerText = getAQILabel(aqi);
  badge.style.background = getAQIColor(aqi);

  document.getElementById("modal-tip").innerText =
    getHealthTip(aqi);
}

// CLOSE MODAL
document.getElementById("modal-close").onclick = () => {
  document.getElementById("station-modal").classList.add("hidden");
};

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════
document.getElementById("search-btn").onclick = () => {
  const city = document.getElementById("city-search").value.trim();
  if (city) fetchCityAQI(city);
};

// ENTER KEY SEARCH
document.getElementById("city-search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("search-btn").click();
  }
});

// ═══════════════════════════════════════
// GEOLOCATION
// ═══════════════════════════════════════
document.getElementById("locate-btn").onclick = () => {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;

    map.setView([latitude, longitude], 12);

    const res = await fetch(
      `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${CONFIG.WAQI_TOKEN}`
    );

    const data = await res.json();
    updateMainUI(data.data);
    fetchNearbyStations([latitude, longitude]);
  });
};

// ═══════════════════════════════════════
// LOADING / ERROR
// ═══════════════════════════════════════
function showLoading(state) {
  document.getElementById("map-loading").style.display =
    state ? "flex" : "none";
}

function showError(state) {
  document.getElementById("map-error").classList.toggle("hidden", !state);
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
initMap();
fetchCityAQI(currentCity);
