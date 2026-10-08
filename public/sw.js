const CACHE="amore-shell-v1";
self.addEventListener("install",event=>{self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim());});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin) return;
  if(url.pathname.startsWith("/api/") || url.pathname.includes("_next/data")) return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
