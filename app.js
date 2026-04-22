// ═══════════════════════════════════════
// GLOBALS
// ═══════════════════════════════════════
let map;
let markersLayer;
let currentCity = "Delhi"; // safer default

// ═══════════════════════════════════════
// AQI HELPERS
// ═══════════════════════════════════════
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
  if (aqi <= 150) return "Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function getHealthTip(aqi) {
  if (aqi <= 50) return "Air quality is good. Enjoy outdoor activities.";
  if (aqi <= 100) return "Acceptable air. Sensitive people take care.";
  if (aqi <= 150) return "Limit prolonged outdoor exertion.";
  if (aqi <= 200) return "Avoid outdoor activity if possible.";
  if (aqi <= 300) return "Stay indoors. Wear a mask if outside.";
  return "Health alert! Avoid going outside.";
}

// ═══════════════════════════════════════
// INIT MAP
// ═══════════════════════════════════════
function initMap() {
  map = L.map("map").setView([28.6139, 77.2090], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// ═══════════════════════════════════════
// FETCH CITY AQI (SAFE VERSION)
// ═══════════════════════════════════════
async function fetchCityAQI(city) {
  try {
    showLoading(true);

    const res = await fetch(
      `https://api.waqi.info/feed/${city}/?token=${CONFIG.WAQI_TOKEN}`
    );

    const data = await res.json();
    console.log("API:", data);

    if (data.status !== "ok" || !data.data) {
      throw new Error("Invalid API response");
    }

    updateMainUI(data.data);

    if (data.data.city && data.data.city.geo) {
      const geo = data.data.city.geo;
      map.setView(geo, 11);
      fetchNearbyStations(geo);
    }

    showLoading(false);

  } catch (err) {
    console.error("ERROR:", err);
    showError(true);
    showLoading(false);
  }
}

// ═══════════════════════════════════════
// FETCH NEARBY STATIONS (SAFE)
// ═══════════════════════════════════════
async function fetchNearbyStations([lat, lon]) {
  try {
    markersLayer.clearLayers();

    const res = await fetch(
      `https://api.waqi.info/map/bounds/?token=${CONFIG.WAQI_TOKEN}&latlng=${lat - 0.3},${lon - 0.3},${lat + 0.3},${lon + 0.3}`
    );

    const data = await res.json();

    if (!data.data) return;

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

      // SIDEBAR ITEM
      const div = document.createElement("div");
      div.className = "station-item";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between">
          <span>${station.station.name || "Unknown"}</span>
          <span style="color:${color}">${aqi}</span>
        </div>
      `;
      stationsList.appendChild(div);
    });

    document.getElementById("station-count").innerText =
      `(${data.data.length})`;

  } catch (err) {
    console.error("Stations error:", err);
  }
}

// ═══════════════════════════════════════
// UPDATE UI (SAFE)
// ═══════════════════════════════════════
function updateMainUI(data) {
  const aqi = data.aqi || 0;

  document.getElementById("city-name").innerText =
    data.city?.name || "Unknown";

  document.getElementById("aqi-main-number").innerText = aqi;

  const badge = document.getElementById("aqi-main-badge");
  badge.innerText = getAQILabel(aqi);
  badge.style.background = getAQIColor(aqi);

  document.getElementById("health-tip-text").innerText =
    getHealthTip(aqi);

  // AQI BAR
  const marker = document.getElementById("aqi-bar-marker");
  const percent = Math.min(aqi / 300, 1) * 100;
  marker.style.left = percent + "%";

  // POLLUTANTS
  const grid = document.getElementById("pollutants-grid");
  grid.innerHTML = "";

  if (data.iaqi && typeof data.iaqi === "object") {
    Object.entries(data.iaqi).forEach(([key, val]) => {
      if (!val || !val.v) return;

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

  const aqi = Number(station.aqi) || 0;

  document.getElementById("modal-station-name").innerText =
    station.station?.name || "Unknown";

  document.getElementById("modal-aqi-num").innerText = aqi;

  const badge = document.getElementById("modal-aqi-badge");
  badge.innerText = getAQILabel(aqi);
  badge.style.background = getAQIColor(aqi);

  document.getElementById("modal-tip").innerText =
    getHealthTip(aqi);
}

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

document.getElementById("city-search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("search-btn").click();
  }
});

// ═══════════════════════════════════════
// GEOLOCATION (SAFE)
// ═══════════════════════════════════════
document.getElementById("locate-btn").onclick = () => {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const { latitude, longitude } = pos.coords;

      map.setView([latitude, longitude], 12);

      const res = await fetch(
        `https://api.waqi.info/feed/geo:${latitude};${longitude}/?token=${CONFIG.WAQI_TOKEN}`
      );

      const data = await res.json();

      if (data.status !== "ok") return;

      updateMainUI(data.data);
      fetchNearbyStations([latitude, longitude]);

    } catch (err) {
      console.error("Geo error:", err);
    }
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
// INIT (FIXED)
// ═══════════════════════════════════════
window.onload = () => {
  initMap();
  fetchCityAQI(currentCity);
};
