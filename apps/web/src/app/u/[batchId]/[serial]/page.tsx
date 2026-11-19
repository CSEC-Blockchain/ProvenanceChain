import Link from 'next/link';
import { headers } from 'next/headers';
import { Navbar } from '@/components/Navbar';
import { readBatchFromChain } from '@/lib/chain-reader';
import { recordScan } from '@/lib/db';
import { publicClient, getContractAddress, ProvenanceRegistryABI, activeChain, isSepolia, isBaseSepolia } from '@/lib/viem';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Building,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  QrCode,
  KeyRound,
} from 'lucide-react';

export const revalidate = 0; // Always fresh analytics and claim check

interface PageProps {
  params: {
    batchId: string;
    serial: string;
  };
}

export default async function PublicUnitPage({ params }: PageProps) {
  const batchIdNum = parseInt(params.batchId, 10);
  const serialNum = parseInt(params.serial, 10);

  if (isNaN(batchIdNum) || isNaN(serialNum) || batchIdNum <= 0 || serialNum < 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto px-4 py-12 text-center space-y-4">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="text-xl font-bold text-slate-900">Invalid Unit Identifier</h1>
          <p className="text-xs text-slate-500">
            Please ensure you scanned a valid unit QR code format: /u/[batchId]/[serial].
          </p>
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

  // 1. Record scan analytics
  const headersList = headers();
  const rawIp = headersList.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const country =
    headersList.get('x-vercel-ip-country') ||
    headersList.get('cf-ipcountry') ||
    'Unknown';

  const scanStats = recordScan(batchIdNum, serialNum, rawIp, country);

  // 2. Fetch batch journey from chain
  const chainResult = await readBatchFromChain(batchIdNum);
  const { batch, history, verdict, verdictReason, producerName, currentHolderName, isCustodyChainComplete } = chainResult;

  // 3. Check on-chain unit claim status
  let isUnitClaimed = false;
  let unitClaimedTimestamp = 0;

  try {
    const contractAddress = getContractAddress();
    isUnitClaimed = (await publicClient.readContract({
      address: contractAddress,
      abi: ProvenanceRegistryABI,
      functionName: 'isClaimed',
      args: [BigInt(batchIdNum), serialNum],
    })) as boolean;

    if (isUnitClaimed) {
      const ts = (await publicClient.readContract({
        address: contractAddress,
        abi: ProvenanceRegistryABI,
        functionName: 'claimedAt',
        args: [BigInt(batchIdNum), serialNum],
      })) as bigint;
      unitClaimedTimestamp = Number(ts);
    }
  } catch (err) {
    console.warn('Could not read unit claim status:', err);
  }

  const isRecalled = verdict === 'RECALLED';
  const explorerUrl = isSepolia
    ? 'https://sepolia.etherscan.io'
    : isBaseSepolia
    ? 'https://sepolia.basescan.org'
    : null;
  const explorerName = isSepolia ? 'Etherscan' : isBaseSepolia ? 'BaseScan' : 'Explorer';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6 sm:py-8 space-y-5">
        {/* Unit Header Badge */}
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Unit Authenticity Passport
              </span>
              <span className="text-xs font-bold text-slate-800">
                Batch #{batchIdNum} &bull; Unit Serial #{serialNum}
              </span>
            </div>
          </div>
          <Link
            href={`/v/${batchIdNum}`}
            className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            View Entire Batch &rarr;
          </Link>
        </div>

        {/* Scan Frequency / Multi-Country Caution Banner */}
        {scanStats.caution && (
          <div className="rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-4 text-amber-900 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Caution: High Scan Activity Detected
              </h3>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              This unit QR code has been scanned <strong>{scanStats.totalScans} times</strong> across{' '}
              <strong>{scanStats.uniqueCountries} distinct geographic regions</strong>. While this can happen with legitimate transfers, repeated scans in different locations may indicate that this packaging QR has been photocopied or cloned. Verify that the scratch-off security seal is intact.
            </p>
          </div>
        )}

        {/* Unit Claim Status Card */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Scratch-Off Ownership Status
              </span>
              <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                {isUnitClaimed ? 'Unit Code Already Claimed' : 'Unit Code Unclaimed'}
              </h2>
            </div>
            {isUnitClaimed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Claimed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Unclaimed &amp; Sealed
              </span>
            )}
          </div>

          {isUnitClaimed ? (
            <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold text-amber-950">
                Verification timestamp: {new Date(unitClaimedTimestamp * 1000).toLocaleString()}
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800">
                The scratch-off security code for this unit was already submitted and redeemed on-chain. If you are purchasing this as an unopened box, this package may be a counterfeit or reused container.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200/80 text-xs text-emerald-900 space-y-2">
              <p className="text-[11px] leading-relaxed text-emerald-800">
                This unit is protected by a 128-bit cryptographic scratch-off secret. The secret has not been claimed on Ethereum yet.
              </p>
              <div className="pt-1">
                <Link
                  href={`/claim/${batchIdNum}/${serialNum}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Scratch &amp; Claim Authenticity Now &rarr;</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Batch & Product Overview */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Batch Information
              </span>
              <h2 className="text-base font-extrabold text-slate-900">{batch?.productName || 'Unknown Product'}</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span>{batch?.origin || 'Unknown Origin'}</span>
              </p>
            </div>
            {isRecalled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-800 border border-rose-200">
                <XCircle className="h-3.5 w-3.5" />
                Recalled
              </span>
            ) : isCustodyChainComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Retail Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700">
                In Transit
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Producer</span>
              <span className="font-bold text-slate-800 truncate block">{producerName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium">Current Custody</span>
              <span className="font-bold text-slate-800 truncate block">{currentHolderName}</span>
            </div>
          </div>
        </div>

        {/* Custody Timeline */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Verified Custody Chain ({history.length} Handovers)
            </h3>
            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Cryptographically Verified
            </span>
          </div>

          <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-100">
            {history.map((step, idx) => (
              <div key={idx} className="relative flex items-start gap-3 pl-1">
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white border-2 border-emerald-500 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {idx === 0
                        ? 'Batch Created & Registered'
                        : `Custody Transfer #${idx}`}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(Number(step.timestamp) * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span>{step.location}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 pt-0.5 truncate">
                    Holder: {step.to}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* On-Chain Explorer Link */}
        {explorerUrl && (
          <div className="text-center pt-2">
            <a
              href={`${explorerUrl}/address/${getContractAddress()}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition"
            >
              <span>Verify contract on {explorerName}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
