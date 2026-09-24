# V43 — Pro Delivery Location & Fee System

## What changed

V43 rebuilds the Amore Cafe delivery-location flow around three reliable inputs:

1. **Search** — server-side Google Places Text Search first, Google Geocoding second, and Nominatim as a fallback.
2. **Your Location** — browser `watchPosition()` collects multiple fixes for up to 8 seconds and chooses the best reported accuracy instead of averaging bad coordinates.
3. **Map pin** — the customer can click the map or drag the marker to the exact doorstep.

The customer never chooses the delivery fee.

## Delivery area

The UI and server use a 6.5 km straight-line eligibility radius from Amore Cafe to cover Kombolcha. This radius is only a delivery-area guard. It is **not** the fee calculation.

## Fee calculation

The server calculates the actual driving route from Amore Cafe to the selected destination using Google Routes API Compute Routes with:

- travel mode: DRIVE
- routing preference: TRAFFIC_UNAWARE
- response: distanceMeters

Fee brackets:

- 0–50 m: FREE
- 51–600 m: 50 ETB
- 601–2500 m: 100 ETB
- >2500 m: 200 ETB

The route is recalculated again immediately before the order is saved.

## Search

Google Places Text Search is used first because it is designed for arbitrary place/landmark searches. Google Geocoding is used for address-style queries. Both are server-side so API keys are not exposed to the browser.

The fallback Nominatim integration is search-on-submit only and is throttled to 1 request/second. It is not autocomplete.

## Your Location

The browser must allow geolocation. Production websites need HTTPS for browser geolocation. A strong location fix is accepted quickly; otherwise several updates are collected. The best reading is used rather than averaging coordinates, because averaging unstable GPS readings can move the pin to a location that was never actually measured.

If accuracy is worse than 300 m, the location is shown as a visual starting point but is not submitted for fee calculation. The customer must drag the pin or search for the address.

## Automatic address

When a search result or usable map location is selected, V43 attempts reverse geocoding to populate the checkout address field. The customer can edit the address/landmark manually.

## Required Google Cloud APIs

The same server-side `GOOGLE_MAPS_API_KEY` should have access to:

- Routes API
- Geocoding API
- Places API (New)

Billing is required by Google for these Maps Platform services.

## Security / integrity

The delivery-radius check is repeated on the server. The browser cannot change the fee by editing the UI. The final order fee is derived from a fresh server-side route calculation.
