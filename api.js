const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 5729;
const PUBLIC_DIR = __dirname;
const API_PATHS = new Set(["/api/availability", "/api/stations"]);
const STATIC_PATHS = new Set([
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/favicon.ico",
  "/apple-touch-icon.png",
]);
const SOURCE_URL =
  "https://maps.nextbike.net/maps/nextbike-live.json?lat=49.42457453273227&lng=7.751905004682108&distance=3000";
const STATIONS = [
  { apiName: "TUK Mensa" },
  { apiName: "TUK - Innenhof Gebäude 47" },
  { apiName: "Trippstadter Straße / Institute", displayName: "Institut" },
  { apiName: "Davenportplatz" },
  { apiName: "Pfaffplatz" },
];
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

function flattenPlaces(payload) {
  return (payload.countries ?? []).flatMap((country) =>
    (country.cities ?? []).flatMap((city) => city.places ?? []),
  );
}

function stationLabel(station, displayName) {
  return displayName ?? station.name?.trim() ?? "";
}

function normalizeStation(station, config) {
  const bikeCount = Number(station.bikes_available_to_rent ?? 0);

  return {
    apiName: config.apiName,
    name: station.name?.trim() ?? config.apiName,
    displayName: stationLabel(station, config.displayName),
    bikes_available_to_rent: bikeCount,
    free_bikes: bikeCount,
    lat: Number(station.lat),
    lng: Number(station.lng),
  };
}

async function fetchAvailability() {
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Nextbike returned ${response.status}`);
  }

  const payload = await response.json();
  const places = flattenPlaces(payload);

  const stations = STATIONS.map((config) => {
    const station = places.find((place) => place.name?.trim() === config.apiName);

    if (!station) {
      throw new Error(`Missing station data for ${config.apiName}`);
    }

    return normalizeStation(station, config);
  });

  return {
    updatedAt: new Date().toISOString(),
    stations,
  };
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=30",
  });
  response.end(JSON.stringify(body, null, 2));
}

function writeStaticFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] ?? "application/octet-stream";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      writeJson(response, error.code === "ENOENT" ? 404 : 500, {
        error: error.code === "ENOENT" ? "Not found" : "Could not read file",
      });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=3600",
    });
    response.end(data);
  });
}

function resolveStaticPath(urlPathname) {
  let pathname;

  try {
    pathname = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }

  if (!STATIC_PATHS.has(pathname)) {
    return null;
  }

  return path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname.slice(1));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
    });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    writeJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (API_PATHS.has(url.pathname)) {
    try {
      const availability = await fetchAvailability();
      writeJson(response, 200, availability);
    } catch (error) {
      writeJson(response, 502, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return;
  }

  const filePath = resolveStaticPath(url.pathname);

  if (!filePath) {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  writeStaticFile(response, filePath);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Nextbike Viewer listening on http://${HOST}:${PORT}`);
    console.log(`Standalone API available at http://${HOST}:${PORT}/api/availability`);
  });
}

module.exports = {
  HOST,
  PORT,
  API_PATHS,
  STATIC_PATHS,
  SOURCE_URL,
  STATIONS,
  flattenPlaces,
  fetchAvailability,
  normalizeStation,
  resolveStaticPath,
  server,
};
