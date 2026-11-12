import { createPublicClient, http, type Hex } from 'viem';
import { ProvenanceRegistryABI } from '@provenance/shared';
import { activeChain, anvilChain, baseSepoliaChain, isBaseSepolia } from './wagmi';

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
});

export function getContractAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr || !addr.startsWith('0x')) {
    return '0xb7f8bc63bbcad18155201308c8f3540b07f84f5e';
  }
  return addr as `0x${string}`;
}

export { ProvenanceRegistryABI, activeChain, anvilChain, baseSepoliaChain, isBaseSepolia };
