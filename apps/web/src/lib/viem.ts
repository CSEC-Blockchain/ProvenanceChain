import { createPublicClient, http, type Hex } from 'viem';
import { ProvenanceRegistryABI } from '@provenance/shared';
import { activeChain, anvilChain, baseSepoliaChain, isBaseSepolia } from './wagmi';

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
});

export function getContractAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr || typeof addr !== 'string' || !addr.startsWith('0x')) {
    return '0x5fbdb2315678afecb367f032d93f642f64180aa3';
  }
  return addr as `0x${string}`;
}

export { ProvenanceRegistryABI, activeChain, anvilChain, baseSepoliaChain, isBaseSepolia };
