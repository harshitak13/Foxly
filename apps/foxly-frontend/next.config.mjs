const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendOrigin}/api/:path*` },
      { source: "/auth/:path*", destination: `${backendOrigin}/auth/:path*` },
      { source: "/devices/:path*", destination: `${backendOrigin}/devices/:path*` },
      { source: "/approvals/:path*", destination: `${backendOrigin}/approvals/:path*` },
      { source: "/audit-log/:path*", destination: `${backendOrigin}/audit-log/:path*` },
      { source: "/notifications/:path*", destination: `${backendOrigin}/notifications/:path*` },
    ];
  },
};

export default nextConfig;
