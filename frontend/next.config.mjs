/** @type {import('next').NextConfig} */
const serviceUrls = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  partner: process.env.PARTNER_SERVICE_URL || 'http://partner-service:3002',
  ml: process.env.ML_SERVICE_URL || 'http://ml-service:8001',
  leadScoring: process.env.LEAD_SCORING_SERVICE_URL || 'http://lead-scoring-service:8002',
  outreach: process.env.OUTREACH_SERVICE_URL || 'http://outreach-service:8003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004',
  report: process.env.REPORT_SERVICE_URL || 'http://report-service:8005',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004',
  billing: process.env.BILLING_SERVICE_URL || 'http://billing-service:3005',
};

const nextConfig = {
  output: 'standalone',
  images: { unoptimized: true },
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  || '/ws',
  },
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${serviceUrls.auth}/auth/:path*` },
      { source: '/api/org/:path*', destination: `${serviceUrls.auth}/org/:path*` },
      { source: '/api/partners/:path*', destination: `${serviceUrls.partner}/partners/:path*` },
      { source: '/api/ingest/:path*', destination: `${serviceUrls.partner}/ingest/:path*` },
      { source: '/api/ml/:path*', destination: `${serviceUrls.ml}/:path*` },
      { source: '/api/leads/:path*', destination: `${serviceUrls.leadScoring}/:path*` },
      { source: '/api/outreach/:path*', destination: `${serviceUrls.outreach}/:path*` },
      { source: '/api/analytics/:path*', destination: `${serviceUrls.analytics}/:path*` },
      { source: '/api/reports/:path*', destination: `${serviceUrls.report}/:path*` },
      { source: '/api/billing/:path*', destination: `${serviceUrls.billing}/:path*` },
      { source: '/ws/:path*', destination: `${serviceUrls.notification}/:path*` },
    ];
  },
};

export default nextConfig;
