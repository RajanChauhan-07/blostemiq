import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'BlostemIQ — Fintech Partner Intelligence',
  description: 'Real-time partner health monitoring, AI churn prediction, and compliance-aware outreach for fintech infrastructure companies.',
  keywords: ['fintech', 'partner health', 'churn prediction', 'B2B SaaS', 'ML'],
  openGraph: {
    title: 'BlostemIQ',
    description: 'The intelligence layer for fintech infrastructure companies.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
