'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  KeyRound,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { isSepolia, isBaseSepolia } from '@/lib/viem';

interface PageProps {
  params: {
    batchId: string;
    serial: string;
  };
}

type ClaimStatus = 'idle' | 'submitting' | 'genuine' | 'already_claimed' | 'invalid';

export default function ConsumerClaimPage({ params }: PageProps) {
  const batchIdNum = parseInt(params.batchId, 10);
  const serialNum = parseInt(params.serial, 10);

  const [secret, setSecret] = useState<string>('');
  const [status, setStatus] = useState<ClaimStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimedAt, setClaimedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract secret from URL hash fragment client-side (keeps secret out of server logs)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#/, '').trim();
      if (hash) {
        setSecret(hash);
      }
    }
  }, []);

  async function handleClaim(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!secret.trim()) {
      setErrorMessage('Please enter or scan the scratch-off code.');
      return;
    }

    setErrorMessage(null);
    setStatus('submitting');

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: batchIdNum,
          serial: serialNum,
          secret: secret.trim(),
        }),
      });

      const data = await res.json();

      if (res.status === 200 && data.status === 'GENUINE') {
        setStatus('genuine');
        setTxHash(data.txHash);
        setClaimedAt(data.claimedAt || Math.floor(Date.now() / 1000));
      } else if (res.status === 409 || data.status === 'ALREADY_CLAIMED') {
        setStatus('already_claimed');
        setClaimedAt(data.claimedAt || null);
        setErrorMessage(data.error || 'This unit code was previously claimed.');
      } else {
        setStatus('invalid');
        setErrorMessage(data.error || 'Invalid scratch-off secret code.');
      }
    } catch (err: any) {
      console.error('Claim request error:', err);
      setStatus('invalid');
      setErrorMessage(err?.message || 'Network error while verifying unit code.');
    }
  }

  const explorerUrl = isSepolia
    ? 'https://sepolia.etherscan.io'
    : isBaseSepolia
    ? 'https://sepolia.basescan.org'
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-8 sm:py-12 space-y-6">
        {/* Unit Header Badge */}
        <div className="text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Consumer Verification Portal &bull; Zero Wallet Required
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Verify Scratch-Off Security Seal
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Batch #{batchIdNum} &bull; Serial #{serialNum}
          </p>
        </div>

        {/* State 1: Genuine First Verification */}
        {status === 'genuine' && (
          <div className="bg-white rounded-3xl p-6 border-2 border-emerald-500/30 shadow-lg text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-xs">
              <CheckCircle2 className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                <Sparkles className="h-3.5 w-3.5" /> First-Time Verification
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 pt-1">
                Authentic &amp; Genuine Product!
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                You are the first person to scratch and verify this unit. The claim transaction has been submitted and permanently sealed on Ethereum.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-left text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Verification Time:</span>
                <span className="font-semibold text-slate-800">
                  {claimedAt ? new Date(claimedAt * 1000).toLocaleString() : 'Just now'}
                </span>
              </div>
              {txHash && (
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-[10px] text-slate-400 block font-medium">On-Chain Transaction:</span>
                  <a
                    href={explorerUrl ? `${explorerUrl}/tx/${txHash}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[11px] text-emerald-600 hover:underline flex items-center gap-1 break-all"
                  >
                    <span>{txHash}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href={`/u/${batchIdNum}/${serialNum}`}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
              >
                <span>View Full Origin &amp; Journey Passport</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* State 2: Already Claimed Warning */}
        {status === 'already_claimed' && (
          <div className="bg-white rounded-3xl p-6 border-2 border-amber-500/30 shadow-lg text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-600 shadow-xs">
              <AlertTriangle className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                Duplicate Verification Warning
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 pt-1">
                Already Verified Previously
              </h2>
              <p className="text-xs text-amber-900 leading-relaxed max-w-sm mx-auto">
                Warning: This unit code was already claimed on{' '}
                <strong>
                  {claimedAt ? new Date(claimedAt * 1000).toLocaleString() : 'an earlier date'}
                </strong>
                . If you just opened a new box, this product may be a counterfeit or the packaging has been reused.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href={`/u/${batchIdNum}/${serialNum}`}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white shadow hover:bg-amber-700 transition"
              >
                <span>Inspect Unit Journey Passport &rarr;</span>
              </Link>
            </div>
          </div>
        )}

        {/* State 3: Invalid Secret */}
        {status === 'invalid' && (
          <div className="bg-white rounded-3xl p-6 border-2 border-rose-500/30 shadow-lg text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 shadow-xs">
              <XCircle className="h-10 w-10" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-3 py-1 rounded-full">
                Verification Failed
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 pt-1">
                Invalid Scratch-Off Code
              </h2>
              <p className="text-xs text-rose-700 leading-relaxed max-w-sm mx-auto">
                {errorMessage ||
                  'The scratch-off code you entered does not match the on-chain Merkle root commitment for this batch and unit.'}
              </p>
            </div>

            <button
              onClick={() => setStatus('idle')}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
            >
              Try Re-Entering Code
            </button>
          </div>
        )}

        {/* State 0: Idle / Submitting Form */}
        {(status === 'idle' || status === 'submitting') && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-5">
            <div className="flex items-center gap-3 bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
              <Lock className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-[11px] text-emerald-900 leading-snug">
                Scratch the silver tamper-evident coating on the package to reveal the secret code.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  128-Bit Scratch-Off Secret Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter 32-character scratch code"
                    className="w-full rounded-xl border border-slate-300 p-3 text-xs font-mono font-bold tracking-wider text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                  />
                  <KeyRound className="absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  If you scanned the hidden QR code directly, this field was automatically filled.
                </p>
              </div>

              <button
                type="submit"
                disabled={status === 'submitting' || !secret}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying on Ethereum (Relayer Sponsoring Gas)...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Claim &amp; Verify Authenticity On-Chain</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                href={`/u/${batchIdNum}/${serialNum}`}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
              >
                View public batch history without claiming &rarr;
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
