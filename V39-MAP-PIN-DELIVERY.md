# Amore Cafe V39 — Map-Pin Delivery Fee

V39 removes browser GPS from checkout. Customers select their delivery location directly on an interactive Kombolcha map by tapping the map or dragging a pin.

## How it works

1. Customer chooses **Delivery**.
2. Customer enters a delivery address / landmark.
3. Customer taps their location on the map or drags the delivery pin.
4. The server sends the selected coordinates to Google Routes API.
5. Google returns the driving distance from Amore Cafe to the selected pin.
6. The fee is calculated automatically:
   - 0–50 m = FREE
   - 51–600 m = 50 ETB
   - 601–2500 m = 100 ETB
   - >2500 m = 200 ETB
7. The route is recalculated again when the order is submitted.

## Map provider

The interactive map uses OpenStreetMap tiles through Leaflet. No Google Maps JavaScript API key is required for the map itself.

The existing server-side Google Routes API is still used for the driving-distance calculation, so `GOOGLE_MAPS_API_KEY` remains required.

## Important

The map pin is customer-selected. The customer should place it at the actual delivery location and provide a useful landmark/address. The admin can verify unusual orders before processing.
