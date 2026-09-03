/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdfjs-dist tries to bundle node-canvas for rendering. We only use text
      // extraction (getTextContent), which doesn't need canvas, and its native
      // binding (.node) can't be resolved by webpack. Externalize it so pdfjs
      // requires it at runtime instead — where it's optional (warning only).
      config.externals = config.externals || [];
      config.externals.push({
        canvas: "commonjs canvas",
        // pdfjs loads its .worker.js relative to its own file. Plain Node can
        // resolve that from node_modules, but webpack cannot when it re-bundles
        // pdfjs (breaking its fake-worker setup). Externalizing both lets pdfjs
        // run from node_modules exactly as in plain Node.
        "pdfjs-dist": "commonjs pdfjs-dist",
        "pdfjs-dist/legacy/build/pdf.js": "commonjs pdfjs-dist/legacy/build/pdf.js",
      });
    }
    return config;
  },
};

export default nextConfig;
