# Amore Cafe – Google Maps Driving Delivery Fee

The delivery fee is based on the **driving route distance** from the fixed Amore Cafe location to the customer's current GPS location. It is not based on straight-line/Haversine distance.

## Fixed origin

```ts
const AMORE_LOCATION = { lat: 11.0866315, lng: 39.7370094 };
```

Only the origin is fixed. The destination is supplied dynamically from the customer's browser GPS coordinates.

## Flow

1. Customer taps **Use my location**.
2. Browser obtains the customer's latitude/longitude.
3. Server sends Amore Cafe → customer to Google Maps Routes API.
4. Google returns the actual driving `distanceMeters`.
5. The fee is calculated from that road distance.
6. The route is recalculated immediately before order submission so the saved order uses a fresh result.

Google's Routes API `ComputeRoutes` supports an origin and destination and returns `distanceMeters` for the travel route. This application uses `DRIVE` with `TRAFFIC_UNAWARE`, so traffic conditions do not affect the delivery fee.

## Fee rules

- 0–50 m = 0 ETB
- 51–600 m = 50 ETB
- 601–2500 m = 100 ETB
- >2500 m = 200 ETB

## Server configuration

Set this server-only environment variable:

```env
GOOGLE_MAPS_API_KEY=your_key_here
```

The Google Cloud project must have the **Routes API** enabled and billing configured. The API key should be restricted to the Routes API and appropriate server usage.

The checkout does not silently fall back to straight-line distance if Google routing fails, because that could charge the customer using an incorrect distance. Instead, checkout shows the routing error and prevents a delivery order from being submitted until a valid route is obtained.
