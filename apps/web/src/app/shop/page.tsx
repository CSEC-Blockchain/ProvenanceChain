'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useConnect } from 'wagmi';
import { injected } from '@wagmi/connectors/injected';
import { Navbar } from '@/components/Navbar';
import {
  publicClient,
  getContractAddress,
  ProvenanceRegistryABI,
} from '@/lib/viem';
import {
  Store,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Inbox,
  CheckCheck,
  Tag,
} from 'lucide-react';
import { encodeFunctionData, type Hex } from 'viem';
import { sendMetaMaskTransaction } from '@/lib/wallet';

interface BatchSummary {
  id: number;
  productName: string;
  origin: string;
  unitCount: number;
  currentHolder: string;
  pendingHolder: string;
  status: number;
  createdAt: number;
}

export default function ShopPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const [role, setRole] = useState<string>('LOADING');
  const [loadingRole, setLoadingRole] = useState(true);

  const [incomingBatches, setIncomingBatches] = useState<BatchSummary[]>([]);
  const [inStockBatches, setInStockBatches] = useState<BatchSummary[]>([]);
  const [soldOutBatches, setSoldOutBatches] = useState<BatchSummary[]>([]);

  const [shopLocation, setShopLocation] = useState('Downtown Coffee Bar - Retail Store');
  const [activeStep, setActiveStep] = useState<'idle' | 'metamask' | 'mining' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!address) {
        setRole('DISCONNECTED');
        setLoadingRole(false);
        return;
      }

      setLoadingRole(true);
      try {
        const contractAddress = getContractAddress();
        const userRole: string = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'getRole',
          args: [address],
        })) as string;

        setRole(userRole);

        const total = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'batchCount',
        })) as bigint;

        const count = Number(total);
        const incoming: BatchSummary[] = [];
        const inStock: BatchSummary[] = [];
        const soldOut: BatchSummary[] = [];

        for (let i = 1; i <= count; i++) {
          try {
            const b: any = await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'getBatch',
              args: [BigInt(i)],
            });

            const summary: BatchSummary = {
              id: Number(b.id),
              productName: b.productName,
              origin: b.origin,
              unitCount: Number(b.unitCount),
              currentHolder: b.currentHolder,
              pendingHolder: b.pendingHolder,
              status: Number(b.status),
              createdAt: Number(b.createdAt),
            };

            if (b.pendingHolder.toLowerCase() === address.toLowerCase()) {
              incoming.push(summary);
            }
            if (b.currentHolder.toLowerCase() === address.toLowerCase()) {
              if (b.status === 0) {
                inStock.push(summary);
              } else if (b.status === 2) {
                soldOut.push(summary);
              }
            }
          } catch {}
        }

        setIncomingBatches(incoming);
        setInStockBatches(inStock);
        setSoldOutBatches(soldOut);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingRole(false);
      }
    }

    loadData();
  }, [address, activeStep]);

  // Accept custody
  async function handleAccept(batchId: number) {
    if (!address || typeof window === 'undefined' || !(window as any).ethereum) return;
    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'acceptTransfer',
        args: [BigInt(batchId), shopLocation],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setActiveStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Accept transfer failed');
      setActiveStep('idle');
    }
  }

  // Mark Sold Out
  async function handleMarkSoldOut(batchId: number) {
    if (!address || typeof window === 'undefined' || !(window as any).ethereum) return;
    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'markSoldOut',
        args: [BigInt(batchId)],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setActiveStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Mark sold out failed');
      setActiveStep('idle');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
            Supply Chain Role: RETAIL SHOP
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Retail Shop Portal</h1>
          <p className="text-xs text-slate-500">
            Confirm deliveries into inventory and update customer-facing stock statuses on the blockchain.
          </p>
        </div>

        {/* Guard */}
        {!isConnected ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
            <Store className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">MetaMask Wallet Required</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please connect your authorized retail shop MetaMask account to accept deliveries.
            </p>
            <button
              onClick={() => connect({ connector: injected() })}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800"
            >
              Connect MetaMask
            </button>
          </div>
        ) : loadingRole ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
            <p className="mt-2 text-xs">Checking on-chain retail shop role...</p>
          </div>
        ) : role !== 'SHOP' && role !== 'ADMIN' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">Access Restricted: Shop Role Required</h2>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Your connected address (<span className="font-mono">{address}</span>) does not have the on-chain SHOP role. Current role: <strong>{role}</strong>.
            </p>
            <p className="text-[11px] text-amber-600">
              Demo tip: Switch MetaMask to Account #3 (<span className="font-mono">0x90F7...906</span>: Roast & Co.) or grant this role via the Admin portal.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Incoming Deliveries */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Inbox className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Incoming Deliveries Waiting For Store Acceptance ({incomingBatches.length})
                </h2>
              </div>

              {incomingBatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No incoming shipments waiting for acceptance.</p>
              ) : (
                <div className="space-y-3">
                  {incomingBatches.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-slate-900">Batch #{b.id}: {b.productName}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{b.origin} &bull; {b.unitCount} units</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/v/${b.id}`} className="text-emerald-600 hover:underline font-semibold pr-2">
                          View Scan &rarr;
                        </Link>
                        <button
                          onClick={() => handleAccept(b.id)}
                          disabled={activeStep !== 'idle'}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 transition disabled:opacity-50"
                        >
                          {activeStep === 'metamask' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {activeStep === 'mining' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <span>
                            {activeStep === 'metamask'
                              ? 'Confirm in MetaMask...'
                              : activeStep === 'mining'
                              ? 'Signing on-chain...'
                              : 'Accept into Store Inventory'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: In-Stock Inventory */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Current Retail Inventory In Stock ({inStockBatches.length})
                </h2>
              </div>

              {inStockBatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active batches in stock.</p>
              ) : (
                <div className="space-y-3">
                  {inStockBatches.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">Batch #{b.id}: {b.productName}</span>
                          <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                            Verified Authentic &bull; In Stock
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          <span>{b.origin} &bull; {b.unitCount} units</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/v/${b.id}`} className="text-emerald-600 hover:underline font-semibold pr-2">
                          Consumer QR Scan &rarr;
                        </Link>
                        <button
                          onClick={() => handleMarkSoldOut(b.id)}
                          disabled={activeStep !== 'idle'}
                          className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition"
                        >
                          <Tag className="h-3.5 w-3.5" />
                          <span>Mark Sold Out</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Sold Out Archive */}
            {soldOutBatches.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
                <h2 className="text-sm font-bold text-slate-500 border-b border-slate-100 pb-2">
                  Sold Out Batches Archive ({soldOutBatches.length})
                </h2>
                <div className="space-y-2">
                  {soldOutBatches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-xs text-slate-500 py-1">
                      <span>Batch #{b.id}: {b.productName} ({b.unitCount} units)</span>
                      <Link href={`/v/${b.id}`} className="text-emerald-600 hover:underline font-semibold">
                        View Scan &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
