'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { encodeFunctionData, keccak256, toHex, type Hex } from 'viem';
import { sendMetaMaskTransaction } from '@/lib/wallet';

interface RegisteredEntity {
  address: string;
  role: string;
  displayName: string;
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

  const defaultKnownAddresses = [
    { address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', label: 'Anvil Admin Account #0' },
    { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', label: 'Anvil Account #1 (Sidama Coffee)' },
    { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', label: 'Anvil Account #2 (Addis Export Co)' },
    { address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', label: 'Anvil Account #3 (Roast & Co)' },
    { address: '0x6411585ce9378c91b6926b85c761f902c4443fbf', label: 'User MetaMask Account' },
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

      // Load known entities info
      const list: RegisteredEntity[] = [];
      for (const item of defaultKnownAddresses) {
        try {
          const r: string = (await publicClient.readContract({
            address: contractAddress,
            abi: ProvenanceRegistryABI,
            functionName: 'getRole',
            args: [item.address as Hex],
          })) as string;

          const n: string = (await publicClient.readContract({
            address: contractAddress,
            abi: ProvenanceRegistryABI,
            functionName: 'displayName',
            args: [item.address as Hex],
          })) as string;

          list.push({
            address: item.address,
            role: r,
            displayName: n || item.label,
          });
        } catch {}
      }
      setEntities(list);
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

      setStatusMessage(`Successfully granted ${targetRole} role to ${targetAddress}`);
      setActiveStep('done');
      setTargetAddress('');
      setTargetName('');
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
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Revoke role failed');
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
          </div>
        )}
      </main>
    </div>
  );
}
