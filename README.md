# Nextbike Viewer

Small static website that shows live free-bike availability for selected Nextbike stations near TU Kaiserslautern.

## Details

- Run `node api.js` and open `http://127.0.0.1:5729`.
- The standalone JSON API is available at `http://127.0.0.1:5729/api/availability`.
- Data comes from the Nextbike live JSON API through the local API server.
- The map uses Leaflet with OpenStreetMap tiles.
- Station filtering and display names are configured in `api.js`.
