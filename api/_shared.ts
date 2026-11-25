/**
 * Reconstructs the client-requested URL path on a Request when Vercel rewrites
 * `/api/restful/*`, `/oauth2/*`, or `/login/oauth2/*` to `/api/wm-*?__wm_path=...`.
 */
export function restoreRewrittenRequest(request: Request): Request {
  const url = new URL(request.url);
  const originalPath = url.searchParams.get('__wm_path');
  if (!originalPath) {
    return request;
  }

  url.searchParams.delete('__wm_path');
  const normalizedPath = `/${originalPath.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  url.pathname = normalizedPath;

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null;
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    ...(hasBody ? { body: request.body, duplex: 'half' } : {}),
  };

  return new Request(url.toString(), init);
}
