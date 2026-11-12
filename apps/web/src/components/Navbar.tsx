'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { injected } from '@wagmi/connectors/injected';
import { ShieldCheck, Wallet, ChevronDown, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { publicClient, getContractAddress, ProvenanceRegistryABI } from '@/lib/viem';
import { activeChain } from '@/lib/wagmi';

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [role, setRole] = useState<string>('NONE');
  const [userName, setUserName] = useState<string>('');
  const [loadingRole, setLoadingRole] = useState<boolean>(false);

  const isWrongNetwork = isConnected && chainId !== activeChain.id;

  useEffect(() => {
    async function loadRole() {
      if (!address || isWrongNetwork) {
        setRole('NONE');
        setUserName('');
        return;
      }

      setLoadingRole(true);
      try {
        const contractAddress = getContractAddress();
        const detectedRole: string = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'getRole',
          args: [address],
        })) as string;

        setRole(detectedRole);

        const name: string = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'displayName',
          args: [address],
        })) as string;

        setUserName(name || '');
      } catch (e) {
        console.warn('Could not read role from chain:', e);
      } finally {
        setLoadingRole(false);
      }
    }

    loadRole();
  }, [address, isWrongNetwork]);

  return (
    <>
      {/* Network Warning Banner */}
      {isWrongNetwork && (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-bold text-white shadow-sm flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>
            You are connected to Chain ID {chainId}. Please switch to {activeChain.name} (Chain ID {activeChain.id}).
          </span>
          <button
            onClick={() => switchChain({ chainId: activeChain.id })}
            className="ml-2 rounded-md bg-white px-2 py-0.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100"
          >
            Switch to {activeChain.name}
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs group-hover:bg-emerald-700 transition">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="leading-tight">
                <span className="text-base font-extrabold tracking-tight text-slate-900">
                  Provenance<span className="text-emerald-600">Chain</span>
                </span>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  On-Chain Authenticity
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <Link
                href="/v/1"
                className={`rounded-lg px-3 py-1.5 transition ${
                  pathname.startsWith('/v/')
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Scan Explorer
              </Link>

              {role === 'PRODUCER' && (
                <Link
                  href="/producer"
                  className={`rounded-lg px-3 py-1.5 transition ${
                    pathname === '/producer'
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Producer Portal
                </Link>
              )}

              {role === 'DISTRIBUTOR' && (
                <Link
                  href="/distributor"
                  className={`rounded-lg px-3 py-1.5 transition ${
                    pathname === '/distributor'
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Distributor Portal
                </Link>
              )}

              {role === 'SHOP' && (
                <Link
                  href="/shop"
                  className={`rounded-lg px-3 py-1.5 transition ${
                    pathname === '/shop'
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Shop Portal
                </Link>
              )}

              {role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className={`rounded-lg px-3 py-1.5 transition ${
                    pathname === '/admin'
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  Admin Roles
                </Link>
              )}
            </nav>
          </div>

          {/* Right: MetaMask Connection */}
          <div className="flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                {/* Role badge */}
                <span
                  className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    role === 'PRODUCER'
                      ? 'bg-indigo-100 text-indigo-800'
                      : role === 'DISTRIBUTOR'
                      ? 'bg-amber-100 text-amber-900'
                      : role === 'SHOP'
                      ? 'bg-emerald-100 text-emerald-800'
                      : role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {userName ? `${role}: ${userName}` : role}
                </span>

                {/* Account button with disconnect */}
                <button
                  onClick={() => disconnect()}
                  title="Click to disconnect"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{`${address.slice(0, 6)}...${address.slice(-4)}`}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => connect({ connector: injected() })}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 transition active:scale-95"
              >
                <Wallet className="h-4 w-4 text-emerald-400" />
                <span>Connect MetaMask</span>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
