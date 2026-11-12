'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useSwitchChain, useChainId } from 'wagmi';
import { injected } from '@wagmi/connectors/injected';
import { Navbar } from '@/components/Navbar';
import {
  publicClient,
  getContractAddress,
  ProvenanceRegistryABI,
  activeChain,
  isBaseSepolia,
} from '@/lib/viem';
import {
  PackagePlus,
  QrCode,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Building,
  Send,
  Download,
  ShieldAlert,
} from 'lucide-react';
import QRCode from 'qrcode';
import { encodeFunctionData, keccak256, toHex, type Hex } from 'viem';
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

export default function ProducerPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [role, setRole] = useState<string>('LOADING');
  const [loadingRole, setLoadingRole] = useState(true);

  // Form states
  const [productName, setProductName] = useState('Specialty Coffee Batch');
  const [origin, setOrigin] = useState('Sidama, Ethiopia');
  const [unitCount, setUnitCount] = useState<number>(50);
  const [location, setLocation] = useState('Sidama Washing Station');
  const [customMetadata, setCustomMetadata] = useState('Grade 1 Organic Specialty Arabica');

  // Submit states: 'idle' | 'metamask' | 'mining' | 'done'
  const [step, setStep] = useState<'idle' | 'metamask' | 'mining' | 'done'>('idle');
  const [createdBatchId, setCreatedBatchId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Transfer states
  const [myBatches, setMyBatches] = useState<BatchSummary[]>([]);
  const [transferBatchId, setTransferBatchId] = useState<number | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [transferLocation, setTransferLocation] = useState<string>('Addis Distribution Terminal');
  const [transferStep, setTransferStep] = useState<'idle' | 'metamask' | 'mining' | 'done'>('idle');

  // Known registered partners
  const registeredPartners = [
    { name: 'Addis Export Co. (Distributor)', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
    { name: 'Roast & Co. (Shop)', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' },
  ];

  // 1. Check Role & Load Batches
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

        // Load batches
        const total = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'batchCount',
        })) as bigint;

        const count = Number(total);
        const batches: BatchSummary[] = [];

        for (let i = 1; i <= count; i++) {
          try {
            const b: any = await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'getBatch',
              args: [BigInt(i)],
            });
            if (b.producer.toLowerCase() === address.toLowerCase()) {
              batches.push({
                id: Number(b.id),
                productName: b.productName,
                origin: b.origin,
                unitCount: Number(b.unitCount),
                currentHolder: b.currentHolder,
                pendingHolder: b.pendingHolder,
                status: Number(b.status),
                createdAt: Number(b.createdAt),
              });
            }
          } catch {}
        }

        setMyBatches(batches.reverse());
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingRole(false);
      }
    }

    loadData();
  }, [address, step, transferStep]);

  // 2. Submit New Batch
  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!address || typeof window === 'undefined' || !(window as any).ethereum) {
      setError('Please connect MetaMask first');
      return;
    }

    setError(null);
    setStep('metamask');

    try {
      const contractAddress = getContractAddress();
      const metadataHash = keccak256(toHex(customMetadata));

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'createBatch',
        args: [productName, origin, metadataHash, Number(unitCount), location],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setTxHash(hash);
      setStep('mining');

      const receipt = await publicClient.waitForTransactionReceipt({ hash: hash as Hex });

      // Read new batchCount to determine the created batch ID
      const total = (await publicClient.readContract({
        address: contractAddress,
        abi: ProvenanceRegistryABI,
        functionName: 'batchCount',
      })) as bigint;

      const newBatchId = Number(total);
      setCreatedBatchId(newBatchId);

      // Generate QR Code encoding direct public scan URL
      const scanUrl = `${window.location.origin}/v/${newBatchId}`;
      const qr = await QRCode.toDataURL(scanUrl, { width: 300, margin: 2 });
      setQrDataUrl(qr);

      setStep('done');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Transaction rejected or failed in MetaMask');
      setStep('idle');
    }
  }

  // 3. Initiate Handover
  async function handleInitiateTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferBatchId || !recipientAddress) return;

    setError(null);
    setTransferStep('metamask');

    try {
      const contractAddress = getContractAddress();

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'initiateTransfer',
        args: [BigInt(transferBatchId), recipientAddress as Hex, transferLocation],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setTransferStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setTransferStep('done');
      setTransferBatchId(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Transfer failed in MetaMask');
      setTransferStep('idle');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Supply Chain Role: PRODUCER
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Producer Management Portal</h1>
          <p className="text-xs text-slate-500">
            Register new batches on the blockchain, download package QR labels, and initiate custody transfers.
          </p>
        </div>

        {/* Unauthorized / Disconnected Guard */}
        {!isConnected ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
            <Building className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">MetaMask Wallet Required</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please connect your authorized producer MetaMask account to access batch registration and custody management.
            </p>
            <button
              onClick={() => connect({ connector: injected() })}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
            >
              Connect MetaMask
            </button>
          </div>
        ) : loadingRole ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
            <p className="mt-2 text-xs">Checking on-chain role permissions...</p>
          </div>
        ) : role !== 'PRODUCER' && role !== 'ADMIN' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">Access Restricted: Producer Role Required</h2>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Your connected address (<span className="font-mono">{address}</span>) does not have the on-chain PRODUCER role.
              Your current role is: <strong>{role}</strong>.
            </p>
            <p className="text-[11px] text-amber-600">
              Demo tip: Switch MetaMask to Account #1 (<span className="font-mono">0x7099...79C8</span>) or grant this role from the Admin portal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
                  <PackagePlus className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">Register New Batch</h2>
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 mb-5 border border-rose-200 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {step === 'done' ? (
                  <div className="py-6 text-center space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Batch #{createdBatchId} Permanently Registered!
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Locked on-chain with immutable timestamps.
                      </p>
                    </div>

                    {qrDataUrl && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
                        <img src={qrDataUrl} alt="Batch QR Code" className="w-48 h-48 mx-auto" />
                        <span className="block text-[11px] font-mono text-slate-600 mt-2">
                          Scan URL: /v/{createdBatchId}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                      {qrDataUrl && (
                        <a
                          href={qrDataUrl}
                          download={`batch-${createdBatchId}-qr.png`}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download QR Label</span>
                        </a>
                      )}
                      <Link
                        href={`/v/${createdBatchId}`}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open Scan Explorer &rarr;
                      </Link>
                    </div>

                    <button
                      onClick={() => setStep('idle')}
                      className="text-xs text-emerald-600 hover:underline font-semibold block mx-auto pt-2"
                    >
                      + Register Another Batch
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateBatch} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Product Name</label>
                      <input
                        type="text"
                        required
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Origin / Farm</label>
                        <input
                          type="text"
                          required
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Unit Count</label>
                        <input
                          type="number"
                          required
                          min={1}
                          value={unitCount}
                          onChange={(e) => setUnitCount(parseInt(e.target.value, 10))}
                          className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Registration Location</label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Product Details / Certification (Hashed On-Chain)
                      </label>
                      <input
                        type="text"
                        value={customMetadata}
                        onChange={(e) => setCustomMetadata(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono text-slate-700 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={step !== 'idle'}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {step === 'metamask' && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>1/2 Confirm in MetaMask...</span>
                        </>
                      )}
                      {step === 'mining' && (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>2/2 Saving permanently to blockchain...</span>
                        </>
                      )}
                      {step === 'idle' && (
                        <>
                          <PackagePlus className="h-4 w-4" />
                          <span>Sign in MetaMask & Register Batch</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* My Batches & Transfer Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  My Registered Batches ({myBatches.length})
                </h2>

                {myBatches.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No batches created yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {myBatches.map((b) => {
                      const isAtProducer = b.currentHolder.toLowerCase() === address?.toLowerCase();
                      const hasPending = b.pendingHolder !== '0x0000000000000000000000000000000000000000';

                      return (
                        <div key={b.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-sm">
                              Batch #{b.id}: {b.productName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                b.status === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {b.status === 0 ? 'Active' : 'Recalled'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500">
                            <span>{b.origin} &bull; {b.unitCount} units</span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <Link href={`/v/${b.id}`} className="text-emerald-600 hover:underline font-semibold">
                              View QR Scan &rarr;
                            </Link>

                            {isAtProducer && b.status === 0 && !hasPending && (
                              <button
                                onClick={() => {
                                  setTransferBatchId(b.id);
                                  setRecipientAddress(registeredPartners[0].address);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800"
                              >
                                Send Onward
                              </button>
                            )}

                            {hasPending && (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                                Transfer Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Handover Dialog / Modal */}
              {transferBatchId && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-indigo-950 text-xs uppercase tracking-wider">
                      Initiate Custody Transfer (Batch #{transferBatchId})
                    </h3>
                    <button
                      onClick={() => setTransferBatchId(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      &times;
                    </button>
                  </div>

                  <form onSubmit={handleInitiateTransfer} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700">Choose Recipient Partner</label>
                      <select
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs bg-white"
                      >
                        {registeredPartners.map((p) => (
                          <option key={p.address} value={p.address}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700">Transit / Dispatch Location</label>
                      <input
                        type="text"
                        value={transferLocation}
                        onChange={(e) => setTransferLocation(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs bg-white"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={transferStep !== 'idle'}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                    >
                      {transferStep === 'metamask' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {transferStep === 'mining' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {transferStep === 'metamask'
                          ? 'Confirm in MetaMask...'
                          : transferStep === 'mining'
                          ? 'Recording Handover On-Chain...'
                          : 'Sign & Initiate Handover'}
                      </span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
