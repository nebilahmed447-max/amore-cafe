"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const AMORE_LOCATION = { lat: 11.0866315, lng: 39.7370094 };
const KOMBOLCHA_CENTER = { lat: 11.0866315, lng: 39.7370094 };
// Delivery eligibility is intentionally generous enough to cover the full Kombolcha town area.
// This is NOT used to calculate the fee; the fee always comes from the driving route API.
const DELIVERY_RADIUS_METERS = 6500;

export type DeliveryPin = { lat: number; lng: number };
type SearchResult = {
  placeId: string;
  displayName: string;
  lat: number;
  lng: number;
  type: string;
  inDeliveryArea?: boolean;
};
type Props = {
  value: DeliveryPin | null;
  onChange: (location: DeliveryPin) => void;
  onAddressChange?: (address: string) => void;
};
type LeafletMap = any;
type LeafletLayer = any;

declare global {
  interface Window {
    L?: any;
    __amoreLeafletPromise?: Promise<any>;
  }
}

function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("Map is only available in the browser."));
  if (window.L) return Promise.resolve(window.L);
  if (window.__amoreLeafletPromise) return window.__amoreLeafletPromise;

  window.__amoreLeafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-amore-leaflet="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.amoreLeaflet = "true";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-amore-leaflet="true"]') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.L));
      existingScript.addEventListener("error", () => reject(new Error("Map library could not be loaded.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.amoreLeaflet = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Map library loaded without Leaflet."));
    script.onerror = () => reject(new Error("Map library could not be loaded. Check your internet connection."));
    document.body.appendChild(script);
  });

  return window.__amoreLeafletPromise;
}

function distanceMeters(a: DeliveryPin, b: DeliveryPin) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function insideDeliveryArea(location: DeliveryPin) {
  return distanceMeters(AMORE_LOCATION, location) <= DELIVERY_RADIUS_METERS;
}

export default function DeliveryMap({ value, onChange, onAddressChange }: Props) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const customerMarkerRef = useRef<LeafletLayer | null>(null);
  const accuracyCircleRef = useRef<LeafletLayer | null>(null);
  const cafeMarkerRef = useRef<LeafletLayer | null>(null);
  const onChangeRef = useRef(onChange);
  const onAddressChangeRef = useRef(onAddressChange);
  const watchIdRef = useRef<number | null>(null);
  const locationSamplesRef = useRef<{lat:number;lng:number;accuracy:number;time:number}[]>([]);
  const locationTimerRef = useRef<number | null>(null);
  const lastAcceptedPinRef = useRef<DeliveryPin | null>(value);
  const [mapError, setMapError] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [usingLocation, setUsingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onAddressChangeRef.current = onAddressChange; }, [onAddressChange]);

  const stopLocationWatch = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationTimerRef.current !== null) {
      window.clearTimeout(locationTimerRef.current);
      locationTimerRef.current = null;
    }
  };

  const updateCustomerMarker = (location: DeliveryPin) => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    if (customerMarkerRef.current) {
      customerMarkerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      const marker = L.marker([location.lat, location.lng], { draggable: true }).addTo(map);
      marker.bindTooltip("Your delivery location", { direction: "top", offset: [0, -12] });
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setPin({ lat: Number(pos.lat), lng: Number(pos.lng) });
      });
      customerMarkerRef.current = marker;
    }
  };

  const setAccuracyCircle = (location: DeliveryPin, accuracy: number) => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L || !Number.isFinite(accuracy) || accuracy <= 0) return;
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([location.lat, location.lng]);
      accuracyCircleRef.current.setRadius(Math.min(accuracy, 1000));
    } else {
      accuracyCircleRef.current = L.circle([location.lat, location.lng], {
        radius: Math.min(accuracy, 1000),
        color: "#20685c",
        weight: 1,
        fillColor: "#20685c",
        fillOpacity: 0.08,
      }).addTo(map);
    }
  };

  const setPin = (location: DeliveryPin, options: { address?: string; fit?: boolean } = {}) => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return false;

    if (!insideDeliveryArea(location)) {
      if (lastAcceptedPinRef.current) updateCustomerMarker(lastAcceptedPinRef.current);
      setSearchError("This location is outside Amore Cafe's Kombolcha delivery area. Move the pin to Kombolcha or search for a Kombolcha landmark.");
      return false;
    }

    setSearchError("");
    updateCustomerMarker(location);
    lastAcceptedPinRef.current = location;
    onChangeRef.current(location);
    if (options.address) onAddressChangeRef.current?.(options.address);
    if (options.fit) map.setView([location.lat, location.lng], 18, { animate: true });
    return true;
  };

  async function reverseGeocode(location: DeliveryPin) {
    try {
      const response = await fetch(`/api/reverse-geocode?lat=${location.lat}&lng=${location.lng}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.address === "string" && data.address.trim()) {
        onAddressChangeRef.current?.(data.address.trim());
      }
    } catch {
      // Reverse geocoding is helpful but never blocks delivery location selection.
    }
  }

  async function useMyLocation() {
    // Mobile browsers normally block geolocation on a plain LAN HTTP address
    // (for example http://192.168.x.x:3007). Do not pretend it is working.
    // Localhost is treated as a secure development origin, but a phone accessing
    // a PC over its LAN IP needs HTTPS.
    const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
    if (!window.isSecureContext && !isLocalhost) {
      setLocationMessage("Your Location is blocked because this page is not using HTTPS. On a phone, open the live HTTPS website. If you are testing from a PC over Wi-Fi, use an HTTPS tunnel or deploy the site first.");
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage("This phone/browser does not provide location access. Please search for your address or place the pin manually.");
      return;
    }
    const map = mapRef.current;
    if (!map) {
      setLocationMessage("The map is still loading. Please try again in a moment.");
      return;
    }

    // Give a clearer message when the browser has permanently denied the site.
    // Safari may not expose Permissions API, so failure here must never block GPS.
    try {
      if (navigator.permissions?.query) {
        const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (permission.state === "denied") {
          setLocationMessage("Location permission is blocked for this website. Open your phone browser's site settings, allow Location, then return and tap Your Location again.");
          return;
        }
      }
    } catch {
      // Ignore unsupported Permissions API and continue with the real geolocation request.
    }

    stopLocationWatch();
    locationSamplesRef.current = [];
    setUsingLocation(true);
    setLocationMessage("Finding your location… keep the phone still for a few seconds. We will use the best GPS reading.");
    setSearchError("");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      stopLocationWatch();
      setUsingLocation(false);

      const samples = locationSamplesRef.current
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.accuracy) && s.accuracy > 0)
        .sort((a, b) => a.accuracy - b.accuracy);

      if (!samples.length) {
        setLocationMessage("We could not get a GPS fix. Turn on Location/GPS for your phone and allow this website to use your location, then try again.");
        return;
      }

      const best = samples[0];
      const location = { lat: best.lat, lng: best.lng };
      setAccuracyCircle(location, best.accuracy);
      map.setView([location.lat, location.lng], 18, { animate: true });

      if (!insideDeliveryArea(location)) {
        updateCustomerMarker(location);
        setLocationMessage(`Your phone reported a location about ±${Math.round(best.accuracy)} m away, but it appears outside Kombolcha. You can move the pin manually or search for your address.`);
        return;
      }

      // Always place the visual marker when a valid GPS fix is received.
      // Even a weaker fix is useful as a starting point; the customer can drag it.
      updateCustomerMarker(location);
      lastAcceptedPinRef.current = location;
      onChangeRef.current(location);
      reverseGeocode(location);

      if (best.accuracy > 300) {
        setLocationMessage(`Location found, but GPS accuracy is about ±${Math.round(best.accuracy)} m. Check the pin and drag it to your exact house before ordering.`);
      } else if (best.accuracy > 100) {
        setLocationMessage(`Location found (about ±${Math.round(best.accuracy)} m). Check the pin and drag it to your exact house if needed.`);
      } else {
        setLocationMessage(`Location found (about ±${Math.round(best.accuracy)} m). Check the pin and drag it to your exact house if needed.`);
      }
    };

    const onSuccess = (position: GeolocationPosition) => {
      const accuracy = Number(position.coords.accuracy);
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      locationSamplesRef.current.push({
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 9999,
        time: Date.now(),
      });

      // On phones, finish quickly once we have a genuinely good fix.
      if (Number.isFinite(accuracy) && accuracy > 0 && accuracy <= 60) finish();
    };

    const onError = (error: GeolocationPositionError) => {
      // Some mobile browsers can return an error after one or more usable samples.
      if (locationSamplesRef.current.length) {
        finish();
        return;
      }

      stopLocationWatch();
      setUsingLocation(false);
      const message = error.code === error.PERMISSION_DENIED
        ? "Location permission is blocked. On your phone, open the browser/site settings, allow Location for this website, then return here and tap Your Location again."
        : error.code === error.TIMEOUT
          ? "Your phone took too long to provide GPS. Turn on Location/GPS, move near a window or outdoors, and tap Your Location again."
          : "Your phone could not provide a location. Turn on Location/GPS and try again, or use Search / the map pin.";
      setLocationMessage(message);
    };

    try {
      // First request a single fix. This is more reliable on mobile browsers than
      // starting with watchPosition alone, especially after a permission prompt.
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });

      // Continue collecting better readings while the first request is resolving.
      watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, () => {
        // Do not replace a useful getCurrentPosition result with a transient watch error.
      }, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      });

      // Mobile GPS can take several seconds, so give it a generous window.
      locationTimerRef.current = window.setTimeout(finish, 15000);
    } catch {
      setUsingLocation(false);
      setLocationMessage("This browser could not start location access. Please allow Location for this website or use Search / the map pin.");
    }
  }

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    if (query.length < 2) {
      setSearchError("Enter at least 2 characters: town, area, landmark, street, or place name.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Address search failed.");
      const results = Array.isArray(data.results) ? data.results : [];
      setSearchResults(results);
      if (!results.length) setSearchError(`No Ethiopian result found for “${query}”. Try a landmark, kebele, street, or “${query}, Kombolcha”.`);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Address search failed.");
    } finally {
      setSearching(false);
    }
  }

  function chooseSearchResult(result: SearchResult) {
    const location = { lat: result.lat, lng: result.lng };
    if (!insideDeliveryArea(location)) {
      setSearchError("That search result is outside Amore Cafe's Kombolcha delivery area. Search for a Kombolcha address or landmark.");
      mapRef.current?.setView([location.lat, location.lng], 14, { animate: true });
      return;
    }

    setSearchResults([]);
    setSearch(result.displayName);
    setPin(location, { fit: true, address: result.displayName });
  }

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapElement.current || mapRef.current) return;
      const map = L.map(mapElement.current, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 7,
        maxZoom: 19,
      }).setView([KOMBOLCHA_CENTER.lat, KOMBOLCHA_CENTER.lng], 13);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(map);

      cafeMarkerRef.current = L.circleMarker([AMORE_LOCATION.lat, AMORE_LOCATION.lng], {
        radius: 9,
        color: "#20685c",
        weight: 3,
        fillColor: "#20685c",
        fillOpacity: 1,
      }).addTo(map).bindPopup("<b>Amore Cafe</b><br/>Delivery starts here");

      map.on("click", (event: any) => {
        const location = { lat: Number(event.latlng.lat), lng: Number(event.latlng.lng) };
        if (setPin(location, { fit: false })) reverseGeocode(location);
      });

      mapRef.current = map;
      if (value) {
        updateCustomerMarker(value);
        lastAcceptedPinRef.current = value;
        map.setView([value.lat, value.lng], 17);
      }
      setTimeout(() => map.invalidateSize(), 50);
    }).catch((error) => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : "Map could not be loaded.");
    });

    return () => {
      cancelled = true;
      stopLocationWatch();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      customerMarkerRef.current = null;
      accuracyCircleRef.current = null;
      cafeMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (value && mapRef.current && window.L) {
      updateCustomerMarker(value);
      lastAcceptedPinRef.current = value;
    }
  }, [value]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white p-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchResults([]); setSearchError(""); }}
            placeholder="Search Ethiopia: town, area, landmark..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-[var(--brand-green)]"
          />
          <button type="submit" disabled={searching} className="h-11 rounded-xl bg-[var(--brand-green)] px-4 text-sm font-black text-white disabled:opacity-60">
            {searching ? "Searching…" : "Search"}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-500">Search an Ethiopian address or landmark, then select a result. Delivery is limited to Kombolcha.</p>
        {searchResults.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            {searchResults.map((result) => (
              <button key={result.placeId} type="button" onClick={() => chooseSearchResult(result)} className="block w-full border-b border-neutral-100 px-3 py-3 text-left text-xs last:border-0 hover:bg-neutral-50">
                <span className="block font-bold text-neutral-900">{result.displayName.split(",")[0]}</span>
                <span className="mt-1 block leading-4 text-neutral-500">{result.displayName}</span>
                {result.inDeliveryArea === false && <span className="mt-1 block text-[10px] font-bold text-amber-600">Outside Kombolcha delivery area</span>}
              </button>
            ))}
          </div>
        )}
        {searchError && <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{searchError}</div>}
      </div>

      <div className="relative">
        <div ref={mapElement} className="h-[360px] w-full sm:h-[450px]" />
        <button type="button" onClick={useMyLocation} disabled={usingLocation} className="absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-black text-neutral-800 shadow-md transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-70" title="Use your current location">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-green)] text-white">⌾</span>
          <span>{usingLocation ? "Locating…" : "Your Location"}</span>
        </button>
      </div>

      {locationMessage && <div className="border-t border-neutral-200 bg-white px-4 py-3 text-xs font-semibold leading-5 text-neutral-700">{locationMessage}</div>}
      {mapError
        ? <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{mapError}</div>
        : <div className="border-t border-neutral-200 bg-white px-4 py-3 text-xs leading-5 text-neutral-600"><b>How to use:</b> Search an Ethiopian address, tap <b>Your Location</b>, tap the map, or drag the pin. The green circle is Amore Cafe.</div>}
    </div>
  );
}
