const backendOrigin = (process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || "https://foxly-backend.onrender.com").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api-proxy/:path*", destination: `${backendOrigin}/:path*` },
    ];
  },
};

export default nextConfig;
