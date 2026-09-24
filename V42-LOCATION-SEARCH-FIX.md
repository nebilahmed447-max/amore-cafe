# Amore Cafe V42 — Location + Address Search Fix

- Reworked “Your Location” to use `watchPosition()` for a short burst of readings instead of trusting one GPS reading.
- Does not require an unrealistically precise GPS accuracy value; the best available sample is used and the customer can drag the pin.
- Handles permission denied, timeout, unavailable location, and map-not-ready states.
- Search now appends Ethiopia for short queries and has a deliberate Kombolcha fallback when a short query returns no results.
- Search results are ranked to prefer exact matches and Kombolcha results.
- Search remains button-based; it does not implement Nominatim autocomplete, because the public Nominatim service explicitly prohibits client-side autocomplete and limits usage to 1 request/second.
- Existing Kombolcha delivery boundary, map pin, and Google driving-distance fee calculation remain unchanged.
