# Four separate Amore Cafe installs

This project exposes four distinct installable web apps on the same domain:

- Customer: `/` using `/manifest.json` (app ID `/`)
- Admin: `/admin` using `/admin-manifest.json` (app ID `/admin`)
- Delivery: `/delivery` using `/delivery-manifest.json` (app ID `/delivery`)
- Waiter: `/waiter` using `/waiter-manifest.json` (app ID `/waiter`)

Each manifest has a unique ID, start URL, scope, name, theme color, and role-specific icons. Delivery and Waiter panels show their own install button on the login screen and dashboard. Admin install buttons identify the Admin app. Customer install buttons continue to identify Amore Cafe.

## Install all four on one Android device

1. Deploy this updated project to the same HTTPS domain.
2. Open `https://www.amore-cafe.com/`, use the browser's Install app option.
3. Open `https://www.amore-cafe.com/admin`, sign in or view the login page, and install Amore Admin.
4. Open `https://www.amore-cafe.com/delivery`, and install Amore Delivery.
5. Open `https://www.amore-cafe.com/waiter`, and install Amore Waiter.

On iPhone/iPad, open each route in Safari and use Share → Add to Home Screen. Give each install a moment to use its route-specific name/icon. Browser support differs, and iOS may not expose the same automatic install prompt as Android/desktop.

## Important

The manifest IDs and scopes distinguish the apps; the root service worker is still shared at `/sw.js` and currently only uses network-first fetching without writing app-shell caches. Authentication and staff role checks remain required. This changes PWA install metadata/UI, not staff permissions or order workflow.
