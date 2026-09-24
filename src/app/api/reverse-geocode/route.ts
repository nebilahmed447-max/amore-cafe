import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    if (apiKey) {
      const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      endpoint.searchParams.set("latlng", `${lat},${lng}`);
      endpoint.searchParams.set("language", "en");
      endpoint.searchParams.set("key", apiKey);
      const response = await fetch(endpoint.toString(), { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && data.results?.[0]?.formatted_address) {
          return NextResponse.json({ address: String(data.results[0].formatted_address), provider: "google-geocoding" });
        }
      }
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
      "accept-language": "en,am",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "AmoreCafeDelivery/43 (+Amore Cafe customer delivery map)" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ address: "" });
    const data = await response.json();
    return NextResponse.json({ address: typeof data?.display_name === "string" ? data.display_name : "", provider: "nominatim" });
  } catch {
    return NextResponse.json({ address: "" });
  }
}
