# Amore Cafe V40 — Ethiopia Map + Address Search

V40 keeps the V39 map-pin delivery flow and adds a whole-Ethiopia map plus user-triggered Ethiopian address/place search.

## Map
- Starts on a whole-Ethiopia view.
- Uses OpenStreetMap tiles through Leaflet.
- Customers can zoom/pan across Ethiopia.
- Delivery selection remains restricted to the Kombolcha service area.

## Search
- Search is submitted by the customer with the Search button; it is not autocomplete.
- The app uses a small server-side `/api/geocode` proxy to query Nominatim.
- Results are limited to Ethiopia (`countrycodes=et`).
- Selecting a result moves the map and places the delivery pin.
- Search results are cached for 5 minutes in the server process and requests are throttled to one per second.

## Delivery
- Customer cannot choose the fee manually.
- The selected Kombolcha pin is sent to the existing Google Routes API for driving distance.
- Existing V39 fee rules remain unchanged.

## OSM service requirements
The implementation keeps visible OpenStreetMap attribution and does not implement autocomplete. Public Nominatim and tile services have usage limits and policies; for higher-volume production traffic, move to a dedicated/paid geocoding and map provider or self-host the services.
