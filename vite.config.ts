import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';

function rewriteHlsManifest(content: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return content;
  }

  const lines = content.split('\n');

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." attributes inside HLS tags (#EXT-X-KEY, #EXT-X-MAP, etc.)
      if (trimmed.startsWith('#')) {
        return trimmed.replace(/URI="([^"]+)"/gi, (_, uri: string) => {
          try {
            const absoluteUrl = new URL(uri, base).href;
            return `URI="/api/proxy?url=${encodeURIComponent(absoluteUrl)}"`;
          } catch {
            return `URI="${uri}"`;
          }
        });
      }

      // Non-comment, non-empty lines are URLs (segments or sub-playlists)
      try {
        const absoluteUrl = new URL(trimmed, base).href;
        return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

function corsProxyPlugin() {
  return {
    name: 'cors-proxy',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use(
        '/api/proxy',
        async (req: IncomingMessage, res: ServerResponse) => {
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Max-Age': '86400',
            });
            res.end();
            return;
          }

          // Parse the target URL from query string
          const queryStr = (req.url || '').split('?')[1] || '';
          const params = new URLSearchParams(queryStr);
          const targetUrl = params.get('url');

          if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing url parameter');
            return;
          }

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
                Accept: '*/*',
              },
              redirect: 'follow',
              signal: controller.signal,
            });

            clearTimeout(timeout);

            const contentType =
              response.headers.get('content-type') || '';

            // Detect HLS manifest by content-type or URL extension
            let pathname = '';
            try {
              pathname = new URL(targetUrl).pathname.toLowerCase();
            } catch {
              // ignore
            }

            const isManifest =
              contentType.includes('mpegurl') ||
              contentType.includes('m3u') ||
              pathname.endsWith('.m3u8') ||
              pathname.endsWith('.m3u');

            if (isManifest) {
              const text = await response.text();

              // Only rewrite if it actually contains HLS tags
              const isHlsContent =
                text.includes('#EXTM3U') || text.includes('#EXT-X-');
              const body = isHlsContent
                ? rewriteHlsManifest(text, targetUrl)
                : text;

              res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type':
                  contentType || 'application/vnd.apple.mpegurl',
              });
              res.end(body);
            } else {
              // Stream non-manifest content (video segments, etc.)
              res.writeHead(response.status, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type':
                  contentType || 'application/octet-stream',
              });

              if (response.body) {
                const reader = (
                  response.body as ReadableStream<Uint8Array>
                ).getReader();
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const canContinue = res.write(Buffer.from(value));
                    if (!canContinue) {
                      await new Promise<void>((resolve) =>
                        res.once('drain', resolve)
                      );
                    }
                  }
                } catch {
                  // Stream ended or client disconnected
                }
              }
              res.end();
            }
          } catch (err: unknown) {
            if (!res.headersSent) {
              res.writeHead(502, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain',
              });
              const msg =
                err instanceof Error ? err.message : 'Unknown error';
              res.end('Proxy error: ' + msg);
            }
          }
        }
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), corsProxyPlugin()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
