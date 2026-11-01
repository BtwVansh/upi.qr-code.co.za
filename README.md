# UPI Pay QR

**Your UPI. One Link.**

A completely static UPI QR generator for GitHub Pages.

Production site:

```text
https://btwvansh.github.io/upi-gen/
```

Enter a UPI ID, review the disclaimer, and get a shareable payment page at:

```text
https://btwvansh.github.io/upi-gen/pay/ABCD%40OKAXIS
```

The payment page is reconstructed entirely from that URL. There is no backend,
database, account, API, server-side storage or per-QR image file.

---

## How it works

1. Enter a UPI ID on the homepage.
2. Press **Generate QR Code** and review the disclaimer.
3. Choose **Agree & Generate QR**.
4. The browser validates the UPI ID and opens the static payment route.
5. The payment page reads the UPI ID from the URL path, decodes it, rebuilds the
   UPI payment URI and generates the QR code in the browser.
6. Visitors can scan the QR, open Google Pay, PhonePe or Paytm, copy the UPI ID,
   copy the payment URI, download the QR as PNG, copy the shareable link or use
   the native share sheet.

The QR contains the **UPI payment URI**, never the website URL:

```text
upi://pay?pa=ABCD%40OKAXIS&cu=INR
```

Optional `amount` and `note` query parameters are also reflected in both the QR
code and the shareable URL.

## Static routing on GitHub Pages

The site is a Next.js static export:

```bash
npm run build
```

The output is written to `out/`. It contains:

- `out/index.html` — homepage at `/upi-gen/`
- `out/pay/index.html` — the static payment shell at `/upi-gen/pay/`
- `out/404.html` — GitHub Pages fallback used for arbitrary payment URLs
- `out/_next/...` — scripts, styles and assets under `/upi-gen/_next/...`
- `out/.nojekyll` — keeps GitHub Pages from ignoring the `_next` directory

GitHub Pages cannot serve arbitrary Next.js dynamic routes. It does, however,
serve `404.html` for paths that do not map to a file. For a request such as:

```text
https://btwvansh.github.io/upi-gen/pay/ABCD%40OKAXIS
```

GitHub Pages serves `out/404.html` with a 404 status while keeping the browser
URL unchanged. The exported fallback reads `window.location.pathname`, decodes
the UPI ID, and renders the payment page. Refreshing, bookmarking, opening in
another browser, or opening on another device all follow the same path.

The static export is configured with `basePath: "/upi-gen"` in
`next.config.ts`. All Next.js assets and the manual links in the app include
this base path. To deploy under a different project path, set
`NEXT_PUBLIC_BASE_PATH` at build time; it is used by both `next.config.ts` and
the client code.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000/upi-gen/
```

The dev server serves the app under the same base path. The payment fallback is
handled by the app's 404 route during development.

Production build:

```bash
npm run build
```

Then serve the contents of `out/` with a static host that is configured to serve
`out/404.html` for unknown paths. GitHub Pages does this automatically. A plain
static server configured to fall back to `index.html` will not reproduce the
payment-link routing.

Checks:

```bash
npm run typecheck
npm test
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked by the execution
policy.

## URL encoding

- The UPI ID is stored in the path, for example `/pay/ABCD%40OKAXIS`.
- `@` is encoded as `%40`.
- The UPI ID is encoded exactly once when the URL is created and decoded exactly
  once when the page is opened. Double-encoded IDs are rejected.
- The entered casing is preserved. UPI validation is case-insensitive, but the
  application does not lower-case the ID in the URL or QR code.
- Amount and note values are encoded once in the query string and once in the
  UPI URI. The resulting QR payload uses percent-encoded parameters.

## Payment-app launching

| App | Android package | iOS scheme |
| --- | --- | --- |
| Google Pay | `com.google.android.apps.nbu.paisa.user` | `gpay://upi/pay?...` |
| PhonePe | `com.phonepe.app` | `phonepe://pay?...` |
| Paytm | `net.one97.paytm` | `paytmmp://pay?...` |

- **Android:** each button uses an app-specific `intent://` URL with the package
  name above. A `browser_fallback_url` points back to the current payment page.
- **iOS:** each button uses that app's URL scheme. The Google Pay scheme is
  documented in Google's Google Pay for India iOS integration guide.
- **Desktop:** the buttons remain visible, but tapping one explains that UPI
  apps run on phones and the QR code should be scanned instead.

The browser cannot reliably detect whether a custom scheme was handled. After a
tap, the page shows guidance for the case where the app did not open and keeps
the QR code visible. No payment is ever initiated automatically and no UPI PIN,
OTP or banking credential is collected.

## Privacy and limitations

- No website database and no backend API.
- No phone-number lookup, provider, resolver or verification service.
- No cookies or local/session storage are used to store submitted UPI IDs. The
  theme toggle stores only the visitor's colour preference.
- The UPI ID is part of the URL, so the page can be reconstructed anywhere.
- Hosting providers, browsers and network infrastructure may retain technical
  access logs such as IP addresses, timestamps and requested URLs. The app does
  not claim otherwise.
- A URL remains reproducible only while the domain, hosting and this application
  remain available. There is no permanent-storage guarantee.
- Passing format validation does not prove that a UPI ID is active or belongs to
  the intended person. UPI applications display the beneficiary name; check it
  before paying.
- Payment-app schemes and packages can change. If an app does not open, scan the
  QR code or update the app.

## Project structure

```text
src/
  app/
    page.tsx                 Homepage
    pay/page.tsx             Static payment-page shell
    not-found.tsx            GitHub Pages 404 fallback
  components/
    home-form.tsx            UPI input + disclaimer modal
    payment-route.tsx        Reads the payment page from the URL
    payment-view.tsx         QR, app buttons, copy/download/share
    not-found-view.tsx       Invalid-link screen
  lib/
    site.ts                  /upi-gen base-path helpers
    payment-route.ts         URL pathname/query parsing
    upi.ts                   UPI URI, URL encoding, app intents/schemes
    validation.ts            UPI ID, amount and note rules
    qr.ts                    Browser-side QR data URL and download
    disclaimer.ts            Required notice copy
public/
  .nojekyll                  Required for GitHub Pages `_next` assets
tests/                       Vitest suites
out/                         Generated by `npm run build`
```

## Deployment note

Deploy the **contents of `out/`** to the GitHub Pages project site so that
`out/index.html` becomes `/upi-gen/index.html` and `out/404.html` becomes
`/upi-gen/404.html`. Do not deploy the repository root or the `.next` directory.
No GitHub Actions, repository, account or publishing configuration is set up by
this project.
