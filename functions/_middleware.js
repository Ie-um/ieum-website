// Serves Doha's portfolio (stored in /doha/) on doha.ie-um.com,
// and keeps the /doha/ copy on the main site out of search results.
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  if (url.hostname.startsWith('doha.')) {
    let p = url.pathname;
    if (!p.startsWith('/doha/')) p = '/doha' + (p === '/' ? '/' : p);
    return ctx.env.ASSETS.fetch(new Request(new URL(p + url.search, url.origin), ctx.request));
  }
  if (url.pathname === '/doha' || url.pathname.startsWith('/doha/')) {
    const res = await ctx.next();
    const out = new Response(res.body, res);
    out.headers.set('X-Robots-Tag', 'noindex');
    return out;
  }
  return ctx.next();
}
