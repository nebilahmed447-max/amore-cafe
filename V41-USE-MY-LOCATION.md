# Amore Cafe V41 — Use My Location

V41 keeps the V40 whole-Ethiopia map and address search, and adds a **Your Location** button.

## How it works

1. Customer opens the delivery map.
2. Customer can tap **Your Location**.
3. The browser asks for location permission.
4. The current location is placed on the Kombolcha map and used as the delivery pin.
5. The customer can drag the pin to the exact house/landmark before ordering.
6. The existing Google driving-route calculation determines the delivery fee.

## Important

- GPS is only a convenience for placing the initial pin. It is not used as a special GPS-based fee system.
- If browser location accuracy is poor, the customer is told to check/drag the pin.
- If the detected location is outside Kombolcha, it is not accepted as a delivery pin because Amore Cafe currently delivers within Kombolcha.
- Search and manual map selection continue to work without location permission.
- The button uses `navigator.geolocation` with `enableHighAccuracy: true`, `maximumAge: 0`, and a 12-second timeout.
