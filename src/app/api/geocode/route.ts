import { NextResponse } from "next/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AmoreCafeDelivery/43 (+Amore Cafe customer delivery map)";
const AMORE_LOCATION = { lat: 11.0866315, lng: 39.7370094 };
const DELIVERY_RADIUS_METERS = 6500;
const cache = new Map<string, { expires: number; data: unknown }>();
let lastRequestAt = 0;

function distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeGoogle(raw: any) {
  if (!Array.isArray(raw?.results)) return [];
  return raw.results.map((item: any) => ({
    placeId: String(item.place_id ?? `${item.geometry?.location?.lat}-${item.geometry?.location?.lng}`),
    displayName: String(item.formatted_address ?? ""),
    lat: Number(item.geometry?.location?.lat),
    lng: Number(item.geometry?.location?.lng),
    type: String(item.types?.[0] ?? "place"),
  })).filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.displayName);
}

function normalizeNominatim(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    placeId: String(item.place_id ?? `${item.lat}-${item.lon}`),
    displayName: String(item.display_name ?? ""),
    lat: Number(item.lat),
    lng: Number(item.lon),
    type: String(item.type ?? item.class ?? "place"),
  })).filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.displayName);
}

function finishResults(results: any[]) {
  const withArea = results.map((item) => ({
    ...item,
    inDeliveryArea: distanceMeters(AMORE_LOCATION, { lat: item.lat, lng: item.lng }) <= DELIVERY_RADIUS_METERS,
    distanceFromCafeMeters: distanceMeters(AMORE_LOCATION, { lat: item.lat, lng: item.lng }),
  }));

  return withArea
    .sort((a, b) => Number(b.inDeliveryArea) - Number(a.inDeliveryArea) || a.distanceFromCafeMeters - b.distanceFromCafeMeters)
    .slice(0, 8)
    .map(({ distanceFromCafeMeters, ...item }) => item);
}

function normalizePlaces(raw: any) {
  if (!Array.isArray(raw?.places)) return [];
  return raw.places.map((item: any) => ({
    placeId: String(item.id ?? item.name ?? `${item.location?.latitude}-${item.location?.longitude}`),
    displayName: String(item.formattedAddress || item.displayName?.text || ""),
    lat: Number(item.location?.latitude),
    lng: Number(item.location?.longitude),
    type: String(item.types?.[0] ?? "place"),
  })).filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.displayName);
}

async function googlePlacesSearch(query: string, apiKey: string) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types",
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: "ET",
      includedRegionCodes: ["ET"],
      locationBias: {
        circle: {
          center: { latitude: AMORE_LOCATION.lat, longitude: AMORE_LOCATION.lng },
          radius: 25000,
        },
      },
      maxResultCount: 10,
      languageCode: "en",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}`);
  return normalizePlaces(await response.json());
}

async function googleSearch(query: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:ET");
  url.searchParams.set("region", "et");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Geocoding returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.status === "REQUEST_DENIED" || data.status === "OVER_DAILY_LIMIT" || data.status === "OVER_QUERY_LIMIT") {
    throw new Error(`Google Geocoding is unavailable: ${data.status}`);
  }
  return normalizeGoogle(data);
}

async function nominatimSearch(query: string) {
  const waitMs = Math.max(0, 1000 - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
    countrycodes: "et",
    "accept-language": "en,am",
    dedupe: "1",
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
  return normalizeNominatim(await response.json());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json({ results: cached.data, cached: true });

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const queries = /ethiopia|ኢትዮጵያ/i.test(q)
      ? [q]
      : [`${q}, Kombolcha, Ethiopia`, `${q}, Ethiopia`];

    let results: any[] = [];
    if (apiKey) {
      // Places Text Search handles landmarks and named businesses better than geocoding.
      for (const query of queries) {
        try {
          results = await googlePlacesSearch(query, apiKey);
        } catch (error) {
          console.warn("[geocode] Google Places search failed", error);
        }
        if (results.length) break;
      }

      // Geocoding is the fallback for street-style addresses that are not indexed as places.
      if (!results.length) {
        for (const query of queries) {
          try {
            results = await googleSearch(query, apiKey);
          } catch (error) {
            console.warn("[geocode] Google Geocoding failed", error);
          }
          if (results.length) break;
        }
      }
    }

    // Deliberate server-side fallback when Google is not configured or has no result.
    // This is search-on-submit, not autocomplete. Nominatim's public service has a 1 req/sec limit.
    if (!results.length) {
      for (const query of queries) {
        results = await nominatimSearch(query);
        if (results.length) break;
      }
    }

    const cleaned = finishResults(results);
    cache.set(key, { expires: Date.now() + 10 * 60 * 1000, data: cleaned });
    return NextResponse.json({ results: cleaned });
  } catch (error) {
    console.error("[geocode] search failed", error);
    return NextResponse.json({ error: "Address search is temporarily unavailable. Please try again or place the pin manually." }, { status: 502 });
  }
}
