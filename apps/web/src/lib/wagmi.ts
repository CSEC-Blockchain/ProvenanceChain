import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from '@wagmi/connectors/injected';

export const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'],
    },
  },
});

export const baseSepoliaChain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
});

export const isBaseSepolia = process.env.NEXT_PUBLIC_CHAIN_ID === '84532';
export const activeChain = isBaseSepolia ? baseSepoliaChain : anvilChain;

export const wagmiConfig = createConfig({
  chains: [anvilChain, baseSepoliaChain],
  connectors: [injected()],
  transports: {
    [anvilChain.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
    [baseSepoliaChain.id]: http('https://sepolia.base.org'),
  },
  ssr: true,
});
