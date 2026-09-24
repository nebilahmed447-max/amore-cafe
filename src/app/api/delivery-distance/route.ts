import { NextResponse } from "next/server";

const AMORE_LOCATION = { lat: 11.0866315, lng: 39.7370094 };
const DELIVERY_RADIUS_METERS = 6500;
const OSRM_URL = process.env.OSRM_ROUTING_URL || "https://router.project-osrm.org";

type Coordinate = { lat: number; lng: number };

type RouteResult = {
  distanceMeters: number;
  durationSeconds: number | null;
  provider: "google-routes" | "osrm";
};

function straightLineMeters(a: Coordinate, b: Coordinate) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validCoordinate(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function deliveryFee(distanceMeters: number) {
  if (distanceMeters <= 50) return { zone: "Free", fee: 0 };
  if (distanceMeters <= 600) return { zone: "Near", fee: 50 };
  if (distanceMeters <= 2500) return { zone: "Medium", fee: 100 };
  return { zone: "Far", fee: 200 };
}

async function getGoogleRoute(destination: Coordinate, apiKey: string): Promise<RouteResult> {
  const payload = {
    origin: { location: { latLng: { latitude: AMORE_LOCATION.lat, longitude: AMORE_LOCATION.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    routeModifiers: { avoidTolls: false, avoidHighways: false, avoidFerries: false },
    languageCode: "en-US",
    units: "METRIC",
  };

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const raw = await response.text();
  let result: any = null;
  try { result = raw ? JSON.parse(raw) : null; } catch { /* handled below */ }

  if (!response.ok) {
    const message = result?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Google Routes: ${message}`);
  }

  const route = result?.routes?.[0];
  const distanceMeters = Number(route?.distanceMeters);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error("Google Routes returned no usable route distance.");
  }

  const durationText = typeof route?.duration === "string" ? route.duration : "";
  const durationSeconds = durationText.endsWith("s") ? Number.parseFloat(durationText.slice(0, -1)) : null;

  return {
    distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    provider: "google-routes",
  };
}

async function getOsrmRoute(destination: Coordinate): Promise<RouteResult> {
  // OSRM expects longitude,latitude and returns driving-route distance in meters.
  const coordinates = `${AMORE_LOCATION.lng},${AMORE_LOCATION.lat};${destination.lng},${destination.lat}`;
  const endpoint = `${OSRM_URL.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=false&steps=false&alternatives=false`;

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.code !== "Ok") {
    throw new Error(`OSRM: ${data?.message || data?.code || `${response.status} ${response.statusText}`}`);
  }

  const route = data?.routes?.[0];
  const distanceMeters = Number(route?.distance);
  const durationSeconds = Number(route?.duration);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error("OSRM returned no usable route distance.");
  }

  return {
    distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    provider: "osrm",
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const data = body as { lat?: unknown; lng?: unknown };
  const lat = data.lat;
  const lng = data.lng;

  if (!validCoordinate(lat, -90, 90) || !validCoordinate(lng, -180, 180)) {
    return NextResponse.json({ error: "Invalid delivery coordinates." }, { status: 400 });
  }

  const destination: Coordinate = { lat: lat as number, lng: lng as number };
  const eligibilityDistance = straightLineMeters(AMORE_LOCATION, destination);
  if (eligibilityDistance > DELIVERY_RADIUS_METERS) {
    return NextResponse.json({
      error: "The selected delivery location is outside Amore Cafe's Kombolcha delivery area. Please move the pin inside Kombolcha.",
      code: "OUTSIDE_DELIVERY_AREA",
    }, { status: 400 });
  }

  const errors: string[] = [];
  let route: RouteResult | null = null;

  // Google is preferred when configured. If its key, billing, quota, or API configuration
  // is not ready, automatically fall back to OSRM instead of breaking checkout.
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (apiKey) {
    try {
      route = await getGoogleRoute(destination, apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Google Routes error";
      errors.push(message);
      console.warn("[delivery-distance] Google route failed; trying OSRM fallback", message);
    }
  } else {
    errors.push("GOOGLE_MAPS_API_KEY is not configured");
  }

  if (!route) {
    try {
      route = await getOsrmRoute(destination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OSRM error";
      errors.push(message);
      console.error("[delivery-distance] All routing providers failed", errors);
      return NextResponse.json({
        error: "We could not calculate the driving distance right now. Please move the pin slightly onto a nearby road and try again.",
        code: "ROUTING_UNAVAILABLE",
      }, { status: 502 });
    }
  }

  const pricing = deliveryFee(route.distanceMeters);

  return NextResponse.json({
    origin: AMORE_LOCATION,
    destination,
    distanceMeters: Math.round(route.distanceMeters),
    distanceKm: route.distanceMeters / 1000,
    durationSeconds: route.durationSeconds,
    zone: pricing.zone,
    fee: pricing.fee,
    provider: route.provider,
  });
}
