/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@provenance/shared'],
  async redirects() {
    return [
      {
        source: '/batches/new',
        destination: '/producer',
        permanent: false,
      },
      {
        source: '/batches',
        destination: '/producer',
        permanent: false,
      },
      {
        source: '/scan',
        destination: '/v/1',
        permanent: false,
      },
      {
        source: '/dashboard',
        destination: '/producer',
        permanent: false,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'mppx/client': false,
      mppx: false,
    };
    return config;
  },
};

export default nextConfig;
