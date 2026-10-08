import { Page } from "@/components/Shell";

const galleryImages = [
  "/gallery/amore-1.svg",
  "/gallery/amore-2.svg",
  "/gallery/amore-3.svg",
  "/gallery/amore-4.svg",
  "/gallery/amore-5.svg",
  "/gallery/amore-6.svg",
];

export default function Gallery() {
  return (
    <Page>
      <main className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <p className="text-xs font-bold tracking-[.3em] text-amore-500">
          INSIDE AMORE
        </p>
        <h1 className="mt-3 text-5xl font-black">Gallery</h1>

        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {galleryImages.map((src, index) => (
            <div key={src} className="overflow-hidden rounded-[24px] bg-gray-100">
              <img
                src={src}
                alt={`Amore Cafe ${index + 1}`}
                className="aspect-square w-full object-cover transition duration-500 hover:scale-105"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </main>
    </Page>
  );
}
