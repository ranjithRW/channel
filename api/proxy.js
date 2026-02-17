export const config = {
  maxDuration: 60,
};

function rewriteHlsManifest(content, baseUrl) {
  let base;
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

      // Rewrite URI="..." attributes inside HLS tags
      if (trimmed.startsWith('#')) {
        return trimmed.replace(/URI="([^"]+)"/gi, (_, uri) => {
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

export default async function handler(req, res) {
  // CORS headers on every response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';

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
      const isHlsContent =
        text.includes('#EXTM3U') || text.includes('#EXT-X-');
      const body = isHlsContent
        ? rewriteHlsManifest(text, targetUrl)
        : text;

      res.setHeader(
        'Content-Type',
        contentType || 'application/vnd.apple.mpegurl'
      );
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(body);
    } else {
      // Buffer and forward non-manifest content (segments, etc.)
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      res.setHeader(
        'Content-Type',
        contentType || 'application/octet-stream'
      );
      res.status(response.status).send(buffer);
    }
  } catch (err) {
    res.status(502).send('Proxy error: ' + (err.message || 'Unknown error'));
  }
}
