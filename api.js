const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = 5729;
const SOURCE_URL =
  "https://maps.nextbike.net/maps/nextbike-live.json?lat=49.42457453273227&lng=7.751905004682108&distance=3000";
const STATION_NAMES = [
  "TUK Mensa",
  "TUK - Innenhof Gebäude 47",
  "Davenportplatz",
  "Pfaffplatz",
];

function flattenPlaces(payload) {
  return (payload.countries ?? []).flatMap((country) =>
    (country.cities ?? []).flatMap((city) => city.places ?? []),
  );
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

  return STATION_NAMES.map((name) => {
    const station = places.find((place) => place.name?.trim() === name);

    if (!station) {
      throw new Error(`Missing station data for ${name}`);
    }

    return {
      name,
      free_bikes: Number(station.bikes_available_to_rent ?? 0),
    };
  });
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (request.method !== "GET") {
    writeJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname !== "/") {
    writeJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const stations = await fetchAvailability();
    writeJson(response, 200, stations);
  } catch (error) {
    writeJson(response, 502, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`API listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  HOST,
  PORT,
  SOURCE_URL,
  STATION_NAMES,
  flattenPlaces,
  fetchAvailability,
  server,
};
