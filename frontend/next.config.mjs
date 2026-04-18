/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://blostemiq.myddns.me/api',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || 'https://blostemiq.myddns.me/ws',
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
      { source: '/api/reports/:path*', destination: 'http://report-service.blostemiq.svc.cluster.local:8005/:path*' },
      { source: '/ws/:path*', destination: 'http://notification-service.blostemiq.svc.cluster.local:3004/:path*' },
    ];
  },
};

export default nextConfig;



