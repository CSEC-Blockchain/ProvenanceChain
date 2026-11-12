import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { readBatchFromChain } from '@/lib/chain-reader';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  ExternalLink,
  Building,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { activeChain, isBaseSepolia } from '@/lib/viem';

export const revalidate = 0; // Fresh on every scan

interface PageProps {
  params: {
    batchId: string;
  };
}

export default async function ConsumerScanPage({ params }: PageProps) {
  const idNum = parseInt(params.batchId, 10);
  if (isNaN(idNum) || idNum <= 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-12 text-center space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="text-xl font-bold text-slate-900">Invalid Batch Identifier</h1>
          <p className="text-xs text-slate-500">Please provide a valid numeric batch ID.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow"
          >
            Return to Homepage
          </Link>
        </main>
      </div>
    );
  }

  const result = await readBatchFromChain(idNum);
  const { batch, history, verdict, verdictReason, producerName, currentHolderName, isCustodyChainComplete } = result;

  const isRecalled = verdict === 'RECALLED';
  const isCaution = verdict === 'CAUTION';
  const isAuthentic = verdict === 'AUTHENTIC';
  const isNotFound = verdict === 'NOT_FOUND';

  const explorerUrl = isBaseSepolia ? 'https://sepolia.basescan.org' : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6 sm:py-8 space-y-5">
        {/* Quick Demo Switcher */}
        <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
          <span className="font-semibold text-slate-500 text-[11px]">Quick Demo Test:</span>
          <div className="flex items-center gap-1 text-[11px] font-bold">
            <Link
              href="/v/1"
              className={`px-2 py-0.5 rounded ${
                idNum === 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              #1 Authentic
            </Link>
            <Link
              href="/v/2"
              className={`px-2 py-0.5 rounded ${
                idNum === 2 ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              #2 Caution
            </Link>
            <Link
              href="/v/3"
              className={`px-2 py-0.5 rounded ${
                idNum === 3 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              #3 Recalled
            </Link>
            <Link
              href="/v/999"
              className={`px-2 py-0.5 rounded ${
                idNum === 999 ? 'bg-rose-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              #999 Fake
            </Link>
          </div>
        </div>

        {/* 1. Big Verdict Badge */}
        <div
          className={`rounded-2xl p-5 sm:p-6 text-center border shadow-xs transition ${
            isAuthentic
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : isCaution
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-inner mb-3">
            {isAuthentic && (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            )}
            {isCaution && (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle className="h-8 w-8" />
              </div>
            )}
            {(isRecalled || isNotFound) && (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
                <XCircle className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-1">
            {isAuthentic && <span className="text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">VERIFIED AUTHENTIC</span>}
            {isCaution && <span className="text-amber-800 bg-amber-100 px-3 py-1 rounded-full">CAUTION ADVISED</span>}
            {isRecalled && <span className="text-rose-800 bg-rose-100 px-3 py-1 rounded-full">SAFETY ALERT: RECALLED</span>}
            {isNotFound && <span className="text-rose-800 bg-rose-100 px-3 py-1 rounded-full">COUNTERFEIT WARNING</span>}
          </div>

          <h1 className="text-xl sm:text-2xl font-black mt-1">
            {isAuthentic && 'Genuine Product Guaranteed'}
            {isCaution && 'Custody Incomplete / In Transit'}
            {isRecalled && 'Product Recall Issued'}
            {isNotFound && 'Unrecognized Product Code'}
          </h1>

          <p className="mt-2 text-xs text-slate-600 max-w-sm mx-auto leading-relaxed font-medium">
            {verdictReason}
          </p>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Verified 100% On-Chain with Smart Contract</span>
          </div>
        </div>

        {/* 2. Product Information Card (if exists) */}
        {batch && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Batch #{batch.id.toString()}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{batch.productName}</h2>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{batch.origin}</span>
                </div>
              </div>

              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${
                  batch.status === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : batch.status === 2
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {batch.status === 0 ? 'Active' : batch.status === 2 ? 'Sold Out' : 'Recalled'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Producer</span>
                <span className="font-bold text-slate-900 truncate block mt-0.5">{producerName}</span>
                <span className="font-mono text-[10px] text-slate-500 truncate block">
                  {batch.producer.slice(0, 10)}...{batch.producer.slice(-4)}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Unit Volume</span>
                <span className="font-bold text-slate-900 block mt-0.5">{batch.unitCount} Total Units</span>
                <span className="text-[10px] text-slate-500 block">Individually labeled</span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Registered On-Chain</span>
              </div>
              <span className="font-mono font-semibold text-slate-800">
                {new Date(Number(batch.createdAt) * 1000).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        )}

        {/* 3. On-Chain Custody Audit Trail */}
        {history.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">On-Chain Custody Audit Trail</h3>
                <p className="text-[11px] text-slate-500">Immutable chronological transfer log</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                {history.length} Event{history.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:bottom-2 before:top-2 before:left-2.5 before:w-0.5 before:bg-slate-200">
              {history.map((evt, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === history.length - 1;
                const dateStr = new Date(Number(evt.timestamp) * 1000).toLocaleString();

                return (
                  <div key={idx} className="relative">
                    {/* Circle Dot */}
                    <div
                      className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white ${
                        isLast
                          ? isAuthentic
                            ? 'bg-emerald-600 ring-4 ring-emerald-100'
                            : 'bg-amber-500 ring-4 ring-amber-100'
                          : 'bg-slate-400'
                      }`}
                    >
                      <span className="text-[9px] font-bold">{idx + 1}</span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          {isFirst
                            ? 'Batch Created & Registered'
                            : `Custody Transfer #${idx}`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>{evt.location}</span>
                      </div>

                      <div className="pt-1 border-t border-slate-200/50 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-mono">
                        <div>
                          <span>To: </span>
                          <span className="font-semibold text-slate-800">
                            {evt.to.slice(0, 8)}...{evt.to.slice(-4)}
                          </span>
                        </div>
                        {explorerUrl ? (
                          <a
                            href={`${explorerUrl}/address/${evt.to}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:underline text-[10px]"
                          >
                            <span>BaseScan</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400">Local Dev Node Tx</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custody Chain Integrity Verdict */}
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isCustodyChainComplete
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`h-4 w-4 ${isCustodyChainComplete ? 'text-emerald-600' : 'text-slate-400'}`}
                />
                <span className="font-semibold">
                  {isCustodyChainComplete
                    ? 'Unbroken Producer-to-Shop Custody Verified'
                    : 'Custody Chain Still In Progress'}
                </span>
              </div>
              <span className="font-bold text-[11px]">
                {isCustodyChainComplete ? '100% Complete' : 'Incomplete'}
              </span>
            </div>
          </div>
        )}

        {/* 4. Expandable Explainer: How is this verified? */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span>How does ProvenanceChain verify authenticity?</span>
          </div>

          <div className="space-y-2 text-slate-600 leading-relaxed text-[11px]">
            <p>
              1. <strong>Direct Smart Contract Query:</strong> When you opened this page, your device queried the Ethereum blockchain directly. No middleman database or cache was involved.
            </p>
            <p>
              2. <strong>Role-Enforced Custody Handover:</strong> Handover paths are enforced on-chain. Producers can only send to registered Distributors or Shops. Unauthorized parties cannot insert fake records.
            </p>
            <p>
              3. <strong>Append-Only History:</strong> Every step is timestamped and cryptographically signed. No one—not even the producer—can alter or delete custody events once mined.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

