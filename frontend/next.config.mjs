/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://blostemiq.ddns.net/api',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || 'http://blostemiq.ddns.net/ws',
  },
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: 'http://auth-service.blostemiq.svc.cluster.local:3001/auth/:path*' },
      { source: '/api/org/:path*', destination: 'http://auth-service.blostemiq.svc.cluster.local:3001/org/:path*' },
      { source: '/api/partners/:path*', destination: 'http://partner-service.blostemiq.svc.cluster.local:3002/partners/:path*' },
      { source: '/api/ingest/:path*', destination: 'http://partner-service.blostemiq.svc.cluster.local:3002/ingest/:path*' },
      { source: '/api/ml/:path*', destination: 'http://ml-service.blostemiq.svc.cluster.local:8001/:path*' },
      { source: '/api/leads/:path*', destination: 'http://lead-scoring-service.blostemiq.svc.cluster.local:8002/:path*' },
      { source: '/api/outreach/:path*', destination: 'http://outreach-service.blostemiq.svc.cluster.local:8003/:path*' },
      { source: '/api/analytics/:path*', destination: 'http://analytics-service.blostemiq.svc.cluster.local:8004/:path*' },
      { source: '/ws/:path*', destination: 'http://notification-service.blostemiq.svc.cluster.local:3004/:path*' },
    ];
  },
};

export default nextConfig;



