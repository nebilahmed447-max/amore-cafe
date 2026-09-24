# Amore Cafe V38 — GPS Stabilization + Google Driving Distance

V38 improves the automatic delivery-fee calculation by refusing to price an order from an unreliable browser location reading.

## What changed

- Uses `navigator.geolocation.watchPosition()` instead of trusting a single GPS reading.
- Requests `enableHighAccuracy: true`.
- Rejects readings worse than **±75 m** accuracy. A reading such as **±500 m is never used** for pricing.
- Requires at least **3 acceptable readings**.
- Averages the recent readings when they are reasonably clustered to reduce normal GPS jitter.
- Waits up to **30 seconds** for a stable location.
- If the readings remain unstable, the customer is asked to improve GPS/location rather than receiving a potentially incorrect fee.
- The stabilized coordinate is sent to the existing server-side Google Routes API endpoint.
- Google `ComputeRoutes` with `DRIVE` returns `distanceMeters`, which is the travel distance of the route.
- The order submission still recalculates the Google driving route before saving the order.

## Delivery fees

- 0–50 m: FREE
- 51–600 m: 50 ETB
- 601 m–2.5 km: 100 ETB
- Over 2.5 km: 200 ETB

## Important

GPS accuracy is controlled by the customer's device/browser. The website cannot turn a ±500 m reading into a precise location. V38 therefore treats poor accuracy as unusable instead of pretending it is precise. For best results on a phone, Location/GPS should be enabled and the customer should try outdoors or near a window.

Google also notes that latitude/longitude waypoints can be snapped to the nearest road; Place IDs are preferred when a precise property access point is available.
