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
  Truck,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building,
  Send,
  ShieldAlert,
  Inbox,
  Package,
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

export default function DistributorPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const [role, setRole] = useState<string>('LOADING');
  const [loadingRole, setLoadingRole] = useState(true);

  const [incomingBatches, setIncomingBatches] = useState<BatchSummary[]>([]);
  const [inCustodyBatches, setInCustodyBatches] = useState<BatchSummary[]>([]);

  // Action states
  const [acceptLocation, setAcceptLocation] = useState('Addis Central Export Warehouse');
  const [activeStep, setActiveStep] = useState<'idle' | 'metamask' | 'mining' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Send to Shop modal
  const [transferBatchId, setTransferBatchId] = useState<number | null>(null);
  const [shopAddress, setShopAddress] = useState<string>('0x90F79bf6EB2c4f870365E785982E1f101E93b906'); // Roast & Co.
  const [dispatchLocation, setDispatchLocation] = useState<string>('Addis Distribution Terminal Hub');

  // Load distributor data
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
        const inCustody: BatchSummary[] = [];

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
            if (b.currentHolder.toLowerCase() === address.toLowerCase() && b.status === 0) {
              inCustody.push(summary);
            }
          } catch {}
        }

        setIncomingBatches(incoming);
        setInCustodyBatches(inCustody);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingRole(false);
      }
    }

    loadData();
  }, [address, activeStep]);

  // Accept incoming transfer
  async function handleAccept(batchId: number) {
    if (!address || typeof window === 'undefined' || !(window as any).ethereum) return;
    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'acceptTransfer',
        args: [BigInt(batchId), acceptLocation],
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

  // Send to Shop
  async function handleSendToShop(e: React.FormEvent) {
    e.preventDefault();
    if (!transferBatchId || !address || typeof window === 'undefined') return;

    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'initiateTransfer',
        args: [BigInt(transferBatchId), shopAddress as Hex, dispatchLocation],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setActiveStep('done');
      setTransferBatchId(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Send to shop failed');
      setActiveStep('idle');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full">
            Supply Chain Role: DISTRIBUTOR
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Distributor Portal</h1>
          <p className="text-xs text-slate-500">
            Accept shipments from certified producers and dispatch custody onward to licensed shops.
          </p>
        </div>

        {/* Guard */}
        {!isConnected ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
            <Truck className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">MetaMask Wallet Required</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please connect your authorized distributor MetaMask account to accept incoming batches.
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
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" />
            <p className="mt-2 text-xs">Checking on-chain distributor role...</p>
          </div>
        ) : role !== 'DISTRIBUTOR' && role !== 'ADMIN' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">Access Restricted: Distributor Role Required</h2>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Your connected address (<span className="font-mono">{address}</span>) does not have the on-chain DISTRIBUTOR role. Current role: <strong>{role}</strong>.
            </p>
            <p className="text-[11px] text-amber-600">
              Demo tip: Switch MetaMask to Account #2 (<span className="font-mono">0x3C44...93BC</span>: Addis Export Co.) or grant this role via the Admin portal.
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

            {/* Section 1: Incoming Handover Queue */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Inbox className="h-5 w-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Incoming Shipments Waiting For Acceptance ({incomingBatches.length})
                </h2>
              </div>

              {incomingBatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No shipments currently pending your acceptance.</p>
              ) : (
                <div className="space-y-3">
                  {incomingBatches.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-slate-900">Batch #{b.id}: {b.productName}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>{b.origin} &bull; {b.unitCount} units</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link href={`/v/${b.id}`} className="text-emerald-600 hover:underline font-semibold pr-2">
                          Audit Trail &rarr;
                        </Link>
                        <button
                          onClick={() => handleAccept(b.id)}
                          disabled={activeStep !== 'idle'}
                          className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-amber-700 transition disabled:opacity-50"
                        >
                          {activeStep === 'metamask' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {activeStep === 'mining' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <span>
                            {activeStep === 'metamask'
                              ? 'Confirm in MetaMask...'
                              : activeStep === 'mining'
                              ? 'Signing on-chain...'
                              : 'Accept Custody'}
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: In Custody (Ready to Send to Shop) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Package className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Batches Currently in My Custody ({inCustodyBatches.length})
                </h2>
              </div>

              {inCustodyBatches.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No active batches in your custody.</p>
              ) : (
                <div className="space-y-3">
                  {inCustodyBatches.map((b) => {
                    const hasPending = b.pendingHolder !== '0x0000000000000000000000000000000000000000';
                    return (
                      <div
                        key={b.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
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

                          {hasPending ? (
                            <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px]">
                              Waiting for Shop Acceptance
                            </span>
                          ) : (
                            <button
                              onClick={() => setTransferBatchId(b.id)}
                              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Dispatch to Shop</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal: Dispatch to Shop */}
            {transferBatchId && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-emerald-950 text-xs uppercase tracking-wider">
                    Dispatch Batch #{transferBatchId} to Licensed Retail Shop
                  </h3>
                  <button onClick={() => setTransferBatchId(null)} className="text-xs text-slate-400 font-bold">
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSendToShop} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">Choose Certified Shop</label>
                    <select
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs bg-white"
                    >
                      <option value="0x90F79bf6EB2c4f870365E785982E1f101E93b906">
                        Roast & Co. (0x90F7...906)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">Dispatch Hub Location</label>
                    <input
                      type="text"
                      value={dispatchLocation}
                      onChange={(e) => setDispatchLocation(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={activeStep !== 'idle'}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                  >
                    {activeStep === 'metamask' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {activeStep === 'mining' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>
                      {activeStep === 'metamask'
                        ? 'Confirm in MetaMask...'
                        : activeStep === 'mining'
                        ? 'Recording Handover On-Chain...'
                        : 'Sign & Initiate Transfer to Shop'}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
