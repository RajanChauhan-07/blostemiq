import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const sansFont = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
});

const monoFont = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
  display: 'swap',
});

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
    <html lang="en" className={`${sansFont.variable} ${monoFont.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
