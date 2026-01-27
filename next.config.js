/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // For Tauri apps, we handle routing client-side
  // Dynamic routes will be handled at runtime with force-dynamic
  trailingSlash: false,
}

module.exports = nextConfig
