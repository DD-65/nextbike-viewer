const API_URL =
  "https://maps.nextbike.net/maps/nextbike-live.json?lat=49.42457453273227&lng=7.751905004682108&distance=3000";

const STATIONS = [
  { apiName: "TUK Mensa" },
  { apiName: "TUK - Innenhof Gebäude 47" },
  { apiName: "Trippstadter Straße / Institute", displayName: "Institut" },
  { apiName: "Davenportplatz" },
  { apiName: "Pfaffplatz" },
];

const stationsEl = document.querySelector("#stations");
const stationTemplate = document.querySelector("#stationTemplate");
const stationMapEl = document.querySelector("#stationMap");
const refreshButton = document.querySelector("#refreshButton");
const statusText = document.querySelector("#statusText");
const updatedAt = document.querySelector("#updatedAt");

let stationMap;
let stationLayer;

function flattenPlaces(payload) {
  return payload.countries.flatMap((country) =>
    country.cities.flatMap((city) => city.places),
  );
}

function availabilityClass(count) {
  if (count <= 1) return "low";
  if (count <= 3) return "medium";
  return "high";
}

function stationLabel(station) {
  return station.displayName ?? station.name;
}

function renderStations(stations) {
  stationsEl.replaceChildren();

  for (const station of stations) {
    const node = stationTemplate.content.firstElementChild.cloneNode(true);
    const count = Number(station.bikes_available_to_rent ?? 0);

    node.classList.add(availabilityClass(count));
    node.querySelector("h3").textContent = stationLabel(station);
    node.querySelector(".bike-count strong").textContent = count;
    stationsEl.append(node);
  }
}

function createPinIcon(count) {
  const level = availabilityClass(count);

  return L.divIcon({
    className: "",
    html: `<div class="station-pin ${level}"><span>${count}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });
}

function createPopup(station, count) {
  const popup = document.createElement("div");
  popup.className = "station-popup";

  const name = document.createElement("strong");
  name.textContent = stationLabel(station);

  const bikes = document.createElement("span");
  bikes.textContent = `${count} verfügbare Nextbikes`;

  popup.append(name, bikes);
  return popup;
}

function renderMap(stations) {
  if (!window.L) {
    stationMapEl.classList.add("map-fallback");
    stationMapEl.textContent = "OSM-Karte nicht verfügbar";
    return;
  }

  const mappedStations = stations
    .map((station) => ({
      station,
      count: Number(station.bikes_available_to_rent ?? 0),
      position: [Number(station.lat), Number(station.lng)],
    }))
    .filter(({ position }) => position.every(Number.isFinite));

  if (!mappedStations.length) {
    stationMapEl.classList.add("map-fallback");
    stationMapEl.textContent = "Keine Stationskoordinaten gefunden";
    return;
  }

  if (!stationMap) {
    stationMap = L.map(stationMapEl, {
      attributionControl: true,
      scrollWheelZoom: false,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(stationMap);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(stationMap);

    stationLayer = L.layerGroup().addTo(stationMap);
  }

  stationLayer.clearLayers();

  const bounds = L.latLngBounds(mappedStations.map(({ position }) => position));

  for (const { station, count, position } of mappedStations) {
    L.marker(position, {
      icon: createPinIcon(count),
      title: stationLabel(station),
    })
      .bindPopup(createPopup(station, count))
      .addTo(stationLayer);
  }

  stationMap.fitBounds(bounds, {
    animate: false,
    maxZoom: 15,
    padding: [26, 26],
  });
  stationMap.invalidateSize();
}

function renderError(message) {
  const error = document.createElement("p");
  error.className = "empty-message";
  error.textContent = message;
  stationsEl.replaceChildren(error);
}

async function loadAvailability() {
  refreshButton.disabled = true;
  statusText.textContent = "Live-Daten werden geladen...";
  updatedAt.textContent = "Anfrage läuft...";

  try {
    const response = await fetch(API_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Nextbike returned ${response.status}`);
    }

    const payload = await response.json();
    const places = flattenPlaces(payload);
    const stations = STATIONS.map(({ apiName, displayName }) => {
      const station = places.find((place) => place.name.trim() === apiName);
      return station ? { ...station, displayName } : null;
    }).filter(Boolean);

    if (stations.length !== STATIONS.length) {
      const foundNames = new Set(stations.map((station) => station.name.trim()));
      const missingNames = STATIONS.map(({ apiName }) => apiName).filter(
        (name) => !foundNames.has(name),
      );
      throw new Error(`Missing station data for ${missingNames.join(", ")}`);
    }

    renderStations(stations);
    renderMap(stations);
    statusText.textContent = "Live-Daten geladen";
    updatedAt.textContent = `Zuletzt aktualisiert um ${new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date())} Uhr`;
  } catch (error) {
    statusText.textContent = "Konnte Daten nicht laden";
    updatedAt.textContent = "Versuchen Sie es in einem Moment erneut.";
    renderError(error.message);
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadAvailability);
loadAvailability();
