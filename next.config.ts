import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // CalDAV/ICS parsing pulls in temporal-polyfill, whose minified global build
  // breaks when bundled (`s.BigInt is not a function`). Use native require for
  // these packages so they run unminified in the serverless function.
  serverExternalPackages: [
    'node-ical',
    'tsdav',
    'rrule-temporal',
    'temporal-polyfill',
  ],
};

export default nextConfig;
