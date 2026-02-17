export const config = {
  runtime: 'edge',
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

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const reqUrl = new URL(request.url);
  const targetUrl = reqUrl.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        Accept: '*/*',
      },
      redirect: 'follow',
    });

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

      return new Response(body, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Stream non-manifest content (video segments, etc.)
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType || 'application/octet-stream',
      },
    });
  } catch (err) {
    return new Response('Proxy error: ' + (err.message || 'Unknown error'), {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain',
      },
    });
  }
}
