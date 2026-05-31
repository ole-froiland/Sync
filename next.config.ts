import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // node-ical's recurrence expansion uses temporal-polyfill, whose minified
  // build breaks when bundled (`s.BigInt is not a function`). Use native
  // require for that chain so it runs unminified. tsdav is intentionally NOT
  // listed: it bundles correctly, and externalizing it resolves to its ESM
  // build, which native require can't load ("import statement outside a module").
  serverExternalPackages: [
    'node-ical',
    'rrule-temporal',
    'temporal-polyfill',
  ],
};

export default nextConfig;
