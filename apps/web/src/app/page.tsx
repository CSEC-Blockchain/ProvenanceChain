import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  ShieldCheck,
  QrCode,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building,
  Store,
  Truck,
  Sparkles,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Role-Based Supply Chain Authentication on Ethereum</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 max-w-3xl mx-auto leading-tight">
            Tamper-Proof Product Authenticity, <span className="text-emerald-600">Guaranteed On-Chain</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Every custody handover is permanently recorded on the blockchain from Producer &rarr; Distributor &rarr; Shop. Consumers scan a package QR code and see the verified journey with zero wallet, zero crypto, and zero app downloads required.
          </p>

          {/* Quick Demo Scan Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/v/1"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Try Demo Scan (Authentic Batch #1)</span>
            </Link>

            <Link
              href="/v/3"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-rose-700 transition"
            >
              <XCircle className="h-4 w-4" />
              <span>Try Recalled Scan (Batch #3)</span>
            </Link>
          </div>
        </section>

        {/* 4 Interactive Verification Scenarios */}
        <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="text-center text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
            Live On-Chain Demo Scenarios
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/v/1"
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition group space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Batch #1
                </span>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                Verified Authentic
              </h3>
              <p className="text-xs text-slate-500">
                Full 3-step custody chain: Producer &rarr; Distributor &rarr; Shop.
              </p>
              <div className="pt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
                <span>View Scan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/v/2"
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition group space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Batch #2
                </span>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition">
                Caution Advised
              </h3>
              <p className="text-xs text-slate-500">
                Stuck at producer; has not reached certified retail distributor or shop.
              </p>
              <div className="pt-2 flex items-center gap-1 text-xs font-bold text-amber-600">
                <span>View Scan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/v/3"
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-rose-400 hover:shadow-md transition group space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                  Batch #3
                </span>
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-rose-700 transition">
                Product Recalled
              </h3>
              <p className="text-xs text-slate-500">
                Official recall issued on-chain with safety alert and notice.
              </p>
              <div className="pt-2 flex items-center gap-1 text-xs font-bold text-rose-600">
                <span>View Scan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            <Link
              href="/v/999"
              className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-md transition group space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  Batch #999
                </span>
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm group-hover:text-slate-700 transition">
                Counterfeit Warning
              </h3>
              <p className="text-xs text-slate-500">
                Unregistered code that does not exist in the blockchain registry.
              </p>
              <div className="pt-2 flex items-center gap-1 text-xs font-bold text-slate-600">
                <span>View Scan</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* Business Roles Portals Section */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            <div className="max-w-xl">
              <h2 className="text-xl font-bold text-slate-900">Supply Chain Role Portals</h2>
              <p className="mt-1 text-xs text-slate-500">
                Connect MetaMask with an authorized role account to manage batches.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/producer"
                className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 mb-3">
                  <Building className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition">
                  1. Producer Portal
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Register new batches on-chain, generate QR labels, and initiate handovers.
                </p>
              </Link>

              <Link
                href="/distributor"
                className="p-4 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-800 mb-3">
                  <Truck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-800 transition">
                  2. Distributor Portal
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Accept incoming shipments from producers and transfer onward to retail shops.
                </p>
              </Link>

              <Link
                href="/shop"
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-3">
                  <Store className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                  3. Shop Portal
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Confirm receipt of goods from distributors and mark batches sold out.
                </p>
              </Link>

              <Link
                href="/admin"
                className="p-4 rounded-xl border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition">
                  4. Admin Portal
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Grant/revoke roles and configure official business entity display names.
                </p>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>ProvenanceChain &bull; Built with Solidity, Foundry, Next.js & MetaMask</p>
      </footer>
    </div>
  );
}
