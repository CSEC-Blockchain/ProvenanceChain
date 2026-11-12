import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/components/Web3Provider';

export const metadata: Metadata = {
  title: 'ProvenanceChain | Role-Based Product Authenticity',
  description:
    'On-chain supply chain provenance and tamper-proof product authenticity tracker using MetaMask on Base / Anvil.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
