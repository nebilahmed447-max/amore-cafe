# V44 — Delivery Routing Reliability

V44 fixes the checkout error `Google Maps could not calculate a driving route.`

## Routing behavior

1. Validate the selected pin and keep it inside the Kombolcha delivery radius.
2. If `GOOGLE_MAPS_API_KEY` exists, try Google Routes API first.
3. If Google fails because of a missing API, billing, quota, key restriction, or another API error, automatically try OSRM.
4. OSRM returns a driving-route distance in meters and is used to calculate the fee.
5. If both providers fail, checkout stops safely instead of inventing a fee.

## Fee rules

- 0–50 m: FREE
- 51–600 m: 50 ETB
- 601–2500 m: 100 ETB
- >2500 m: 200 ETB

## Production note

The default OSRM URL is the public Project OSRM demo server. For significant production traffic, set `OSRM_ROUTING_URL` to a routing server you control or another supported routing provider. OSRM's route service accepts longitude/latitude coordinates and returns route distance/duration.

## Google setup

Google Routes still remains the preferred provider when configured. Google requires billing and a valid API key for Routes API requests. If Google is not configured correctly, V44 no longer makes the customer checkout fail immediately; it uses the routing fallback.
