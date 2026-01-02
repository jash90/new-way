/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ksiegowacrm/api', '@ksiegowacrm/shared', '@ksiegowacrm/auth'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
