import { createPublicClient, http, fallback, type Hex } from 'viem';
import { ProvenanceRegistryABI } from '@provenance/shared';
import { activeChain, anvilChain, baseSepoliaChain, sepoliaChain, isBaseSepolia, isSepolia } from './wagmi';

export const publicClient = createPublicClient({
  chain: activeChain,
  transport:
    activeChain.id === 11155111
      ? fallback([
          http(process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
          http('https://rpc.sepolia.ethpandaops.io'),
          http('https://1rpc.io/sepolia'),
          http('https://sepolia.gateway.tenderly.co'),
        ])
      : http(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
});

export function getContractAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (
    !addr ||
    typeof addr !== 'string' ||
    !addr.startsWith('0x') ||
    (activeChain.id === 11155111 && addr.toLowerCase() === '0x5fbdb2315678afecb367f032d93f642f64180aa3'.toLowerCase())
  ) {
    if (activeChain.id === 11155111) {
      return '0x2233de21599201a5674f8c54505f162373478a13';
    }
    return '0x5fbdb2315678afecb367f032d93f642f64180aa3';
  }
  return addr as `0x${string}`;
}

export { ProvenanceRegistryABI, activeChain, anvilChain, baseSepoliaChain, sepoliaChain, isBaseSepolia, isSepolia };
