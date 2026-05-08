/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Security Headers ────────────────────────────────────────────────────────
  // Applied to every response. These headers are a baseline requirement for
  // hospital IT security reviews and prevent a wide class of web attacks.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS for 1 year, include subdomains, allow preload list
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Prevent browsers guessing content type (MIME sniffing attacks)
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Block the page from being embedded in iframes (clickjacking)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Minimal referrer info when navigating away
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Restrict browser feature APIs
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // Content Security Policy — restricts script/style/connection sources.
          // 'unsafe-inline' on style is required for Next.js; tighten further
          // once a nonce-based approach is added in a future iteration.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed by Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Remove the X-Powered-By header to avoid revealing stack info
          {
            key: 'X-Powered-By',
            value: '',
          },
        ],
      },
    ]
  },

  // Strip X-Powered-By at the framework level too
  poweredByHeader: false,
}

module.exports = nextConfig

