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
  ShieldCheck,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Building,
  Tag,
  Key,
  Boxes,
  Activity,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { encodeFunctionData, keccak256, toHex, getAddress, parseAbiItem, type Hex } from 'viem';
import { sendMetaMaskTransaction } from '@/lib/wallet';

interface RegisteredEntity {
  address: string;
  role: string;
  displayName: string;
}

interface GlobalBatch {
  id: number;
  productName: string;
  origin: string;
  unitCount: number;
  producer: string;
  producerName: string;
  currentHolder: string;
  currentHolderName: string;
  pendingHolder: string;
  status: number;
  createdAt: number;
  eventCount: number;
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  // Form states
  const [targetAddress, setTargetAddress] = useState('');
  const [targetRole, setTargetRole] = useState<'PRODUCER' | 'DISTRIBUTOR' | 'SHOP'>('PRODUCER');
  const [targetName, setTargetName] = useState('');

  const [activeStep, setActiveStep] = useState<'idle' | 'metamask' | 'mining' | 'done'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Known entities registry table
  const [entities, setEntities] = useState<RegisteredEntity[]>([]);

  // Supply Chain Global Activities
  const [globalBatches, setGlobalBatches] = useState<GlobalBatch[]>([]);

  const defaultKnownAddresses = [
    { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', label: 'Anvil Admin Account #0' },
    { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Anvil Account #1 (Sidama Coffee)' },
    { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'Anvil Account #2 (Addis Export Co)' },
    { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Anvil Account #3 (Roast & Co)' },
    { address: '0x6411585cE9370C91B6926B85C761f902C4443fbF', label: 'User MetaMask Account' },
  ];

  async function loadAdminData() {
    if (!address) {
      setIsAdmin(false);
      setLoadingRole(false);
      return;
    }

    setLoadingRole(true);
    try {
      const contractAddress = getContractAddress();
      const roleStr: string = (await publicClient.readContract({
        address: contractAddress,
        abi: ProvenanceRegistryABI,
        functionName: 'getRole',
        args: [address],
      })) as string;

      setIsAdmin(roleStr === 'ADMIN');

      // Load known and on-chain registered entities
      let onChainAccounts: string[] = [];
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > BigInt(40000) ? currentBlock - BigInt(40000) : BigInt(0);
        const roleLogs = await publicClient.getLogs({
          address: contractAddress,
          event: parseAbiItem('event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)'),
          fromBlock,
          toBlock: 'latest',
        });
        onChainAccounts = roleLogs.map((l: any) => l.args.account as string);
      } catch (err) {
        console.warn('Could not fetch RoleGranted logs:', err);
      }

      let storedAccounts: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('provenance_registered_entities');
          if (raw) storedAccounts = JSON.parse(raw);
        } catch {}
      }

      const candidateAddresses = [
        ...defaultKnownAddresses.map((d) => d.address),
        ...storedAccounts,
        ...onChainAccounts,
        '0xa345AF15470a7CA692710cf3921fa40cBa07824e',
      ];

      const seen = new Set<string>();
      const uniqueEntries: { addr: string; label: string }[] = [];
      for (const rawAddr of candidateAddresses) {
        try {
          const checksummed = getAddress(rawAddr);
          const lower = checksummed.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            const defaultItem = defaultKnownAddresses.find(
              (d) => d.address.toLowerCase() === lower
            );
            uniqueEntries.push({ addr: checksummed, label: defaultItem?.label || '' });
          }
        } catch {}
      }

      const list: RegisteredEntity[] = [];
      for (const item of uniqueEntries) {
        try {
          const r: string = (await publicClient.readContract({
            address: contractAddress,
            abi: ProvenanceRegistryABI,
            functionName: 'getRole',
            args: [item.addr as Hex],
          })) as string;

          const n: string = (await publicClient.readContract({
            address: contractAddress,
            abi: ProvenanceRegistryABI,
            functionName: 'displayName',
            args: [item.addr as Hex],
          })) as string;

          list.push({
            address: item.addr,
            role: r,
            displayName: n || item.label || (r !== 'NONE' ? `${r} Entity` : 'Registered Address'),
          });
        } catch {}
      }

      list.sort((a, b) => {
        if (a.role !== 'NONE' && b.role === 'NONE') return -1;
        if (a.role === 'NONE' && b.role !== 'NONE') return 1;
        return 0;
      });

      setEntities(list);

      // Load all supply chain batches and activities
      try {
        const total = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'batchCount',
        })) as bigint;

        const count = Number(total);
        const batches: GlobalBatch[] = [];

        for (let i = 1; i <= count; i++) {
          try {
            const b: any = await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'getBatch',
              args: [BigInt(i)],
            });

            const hist: any = await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'getHistory',
              args: [BigInt(i)],
            });

            const pName: string = (await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'displayName',
              args: [b.producer as Hex],
            })) as string;

            const hName: string = (await publicClient.readContract({
              address: contractAddress,
              abi: ProvenanceRegistryABI,
              functionName: 'displayName',
              args: [b.currentHolder as Hex],
            })) as string;

            batches.push({
              id: Number(b.id),
              productName: b.productName,
              origin: b.origin,
              unitCount: Number(b.unitCount),
              producer: b.producer,
              producerName: pName || 'Producer',
              currentHolder: b.currentHolder,
              currentHolderName: hName || 'Holder',
              pendingHolder: b.pendingHolder,
              status: Number(b.status),
              createdAt: Number(b.createdAt),
              eventCount: Array.isArray(hist) ? hist.length : 1,
            });
          } catch {}
        }

        // Show newest batches first
        setGlobalBatches(batches.reverse());
      } catch (batchErr) {
        console.warn('Failed to load global batches:', batchErr);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingRole(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [address, activeStep]);

  // Grant Role + Set Name
  async function handleGrantRole(e: React.FormEvent) {
    e.preventDefault();
    if (!targetAddress || !address || typeof window === 'undefined') return;

    setError(null);
    setStatusMessage(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();
      const roleBytes = keccak256(toHex(`${targetRole}_ROLE`));

      // 1. Grant Role
      const calldataRole = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'grantRole',
        args: [roleBytes, targetAddress as Hex],
      });

      const hash1 = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldataRole,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash1 as Hex });

      // 2. Set Name if provided
      if (targetName.trim() !== '') {
        const calldataName = encodeFunctionData({
          abi: ProvenanceRegistryABI,
          functionName: 'setDisplayName',
          args: [targetAddress as Hex, targetName],
        });

        const hash2 = await sendMetaMaskTransaction({
          to: contractAddress as Hex,
          data: calldataName,
          from: address as Hex,
        });

        await publicClient.waitForTransactionReceipt({ hash: hash2 as Hex });
      }

      // 3. Save newly registered entity to localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('provenance_registered_entities');
          const existing: string[] = raw ? JSON.parse(raw) : [];
          const valid = getAddress(targetAddress);
          if (!existing.some((x) => x.toLowerCase() === valid.toLowerCase())) {
            existing.push(valid);
            localStorage.setItem('provenance_registered_entities', JSON.stringify(existing));
          }
        } catch {}
      }

      setStatusMessage(`Successfully granted ${targetRole} role to ${targetAddress}`);
      setActiveStep('done');
      setTargetAddress('');
      setTargetName('');
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Admin operation failed in MetaMask');
      setActiveStep('idle');
    }
  }

  // Revoke Role
  async function handleRevokeRole(addr: string, roleName: string) {
    if (!address || typeof window === 'undefined') return;
    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();
      const roleBytes = keccak256(toHex(`${roleName}_ROLE`));

      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'revokeRole',
        args: [roleBytes, addr as Hex],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setActiveStep('done');
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Revoke role failed');
      setActiveStep('idle');
    }
  }

  // Emergency Safety Recall
  async function handleRecallBatch(batchId: number) {
    if (!address || typeof window === 'undefined') return;
    const reason = window.prompt(
      `Enter safety recall notice for Batch #${batchId}:`,
      'Safety quality inspection failure'
    );
    if (!reason || !reason.trim()) return;

    setError(null);
    setActiveStep('metamask');

    try {
      const contractAddress = getContractAddress();
      const calldata = encodeFunctionData({
        abi: ProvenanceRegistryABI,
        functionName: 'recallBatch',
        args: [BigInt(batchId), reason.trim()],
      });

      const hash = await sendMetaMaskTransaction({
        to: contractAddress as Hex,
        data: calldata,
        from: address as Hex,
      });

      setActiveStep('mining');
      await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
      setStatusMessage(`Batch #${batchId} has been officially RECALLED on-chain.`);
      setActiveStep('done');
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Recall batch failed');
      setActiveStep('idle');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-900 bg-purple-100 px-2.5 py-1 rounded-full">
            Supply Chain Role: ADMIN
          </span>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Platform Administration</h1>
          <p className="text-xs text-slate-500">
            Grant supply chain roles and register verified business display names on the smart contract.
          </p>
        </div>

        {/* Guard */}
        {!isConnected ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-4">
            <Key className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">Admin Wallet Required</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Please connect your designated Administrator MetaMask account to manage roles.
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
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-600" />
            <p className="mt-2 text-xs">Checking on-chain admin permissions...</p>
          </div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center space-y-3">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900">Access Restricted: Admin Role Required</h2>
            <p className="text-xs text-amber-700 max-w-md mx-auto">
              Your connected address (<span className="font-mono">{address}</span>) does not have the DEFAULT_ADMIN_ROLE.
            </p>
            <p className="text-[11px] text-amber-600">
              Demo tip: Switch MetaMask to Account #0 (<span className="font-mono">0xf39F...2266</span>) which is the deployer & admin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                  <h2 className="text-base font-bold text-slate-900">Grant Business Role</h2>
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 mb-4 border border-rose-200">
                    {error}
                  </div>
                )}

                {statusMessage && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 mb-4 border border-emerald-200">
                    {statusMessage}
                  </div>
                )}

                <form onSubmit={handleGrantRole} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700">Account Address (0x...)</label>
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={targetAddress}
                      onChange={(e) => setTargetAddress(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">Select Role</label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as any)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white font-semibold"
                    >
                      <option value="PRODUCER">PRODUCER (Can create batches & send)</option>
                      <option value="DISTRIBUTOR">DISTRIBUTOR (Can accept & dispatch to shops)</option>
                      <option value="SHOP">SHOP (Can accept & mark sold out)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700">Official Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Sidama Specialty Coffee Co-op"
                      value={targetName}
                      onChange={(e) => setTargetName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={activeStep !== 'idle'}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-xs font-bold text-white shadow hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {activeStep === 'metamask' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {activeStep === 'mining' && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {activeStep === 'metamask'
                        ? 'Confirm in MetaMask...'
                        : activeStep === 'mining'
                        ? 'Saving Role On-Chain...'
                        : 'Sign & Grant On-Chain Role'}
                    </span>
                  </button>
                </form>
              </div>
            </div>

            {/* Registry Table Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                  Registered Supply Chain Entities
                </h2>

                <div className="space-y-3">
                  {entities.map((ent) => (
                    <div
                      key={ent.address}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{ent.displayName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              ent.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : ent.role === 'PRODUCER'
                                ? 'bg-indigo-100 text-indigo-800'
                                : ent.role === 'DISTRIBUTOR'
                                ? 'bg-amber-100 text-amber-800'
                                : ent.role === 'SHOP'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {ent.role}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 block mt-1">
                          {ent.address}
                        </span>
                      </div>

                      {ent.role !== 'NONE' && ent.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleRevokeRole(ent.address, ent.role)}
                          className="text-[11px] text-rose-600 hover:underline font-semibold"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Global Supply Chain Activities Section */}
            <div className="lg:col-span-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-600" />
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Supply Chain Global Activity Feed ({globalBatches.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real-time visibility across all registered batches, active handovers, and retail stock.
                    </p>
                  </div>
                </div>
              </div>

              {globalBatches.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <Boxes className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  No batches have been registered on-chain yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {globalBatches.map((b) => {
                    const isPending = b.pendingHolder !== '0x0000000000000000000000000000000000000000';
                    return (
                      <div
                        key={b.id}
                        className="p-4 bg-white hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              Batch #{b.id}: {b.productName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                b.status === 1
                                  ? 'bg-rose-100 text-rose-800'
                                  : b.status === 2
                                  ? 'bg-slate-200 text-slate-700'
                                  : isPending
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {b.status === 1
                                ? 'Recalled'
                                : b.status === 2
                                ? 'Sold Out'
                                : isPending
                                ? 'In Transit'
                                : 'Active'}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {b.eventCount} Custody Event{b.eventCount > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            <span>
                              <strong>Producer:</strong> {b.producerName} ({b.origin})
                            </span>
                            <span>&bull;</span>
                            <span>
                              <strong>Current Custody:</strong> {b.currentHolderName}
                            </span>
                            <span>&bull;</span>
                            <span>
                              <strong>Units:</strong> {b.unitCount}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            href={`/v/${b.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition"
                          >
                            <span>Inspect Scan</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>

                          {b.status === 0 && (
                            <button
                              onClick={() => handleRecallBatch(b.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 transition"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span>Recall</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
