const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api-proxy/:path*", destination: `${backendOrigin}/:path*` },
    ];
  },
};

export default nextConfig;
