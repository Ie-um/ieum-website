/**
 * IEUM Concierge — Instagram feed endpoint
 *
 * Cloudflare Pages Function. Serves the latest posts from @ieumconcierge
 * without ever exposing the access token to the browser.
 *
 * Bindings expected on the Pages project:
 *   IG_TOKEN  (secret)          long lived Instagram access token
 *   IG_KV     (KV namespace)    optional. If bound, the token is refreshed
 *                               automatically and the fresh one stored here,
 *                               so the feed never expires.
 *
 * Without IG_KV the feed still works, but the token must be replaced by hand
 * every 60 days.
 */

const GRAPH = 'https://graph.instagram.com';
const FIELDS = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
const EDGE_CACHE_SECONDS = 1800;   // 30 minutes at the edge
const REFRESH_AFTER_DAYS = 20;     // refresh well before the 60 day expiry

function json(body, status, seconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=300, s-maxage=${seconds}`,
      'access-control-allow-origin': 'https://ie-um.com',
    },
  });
}

/**
 * Returns a usable token, refreshing it if it is getting old.
 * Falls back to the environment secret when KV is not bound.
 */
async function getToken(env) {
  const envToken = env.IG_TOKEN;
  if (!env.IG_KV) return envToken;

  let stored = null;
  try {
    stored = await env.IG_KV.get('token', { type: 'json' });
  } catch (e) {
    return envToken;
  }

  const token = (stored && stored.value) || envToken;
  if (!token) return null;

  const refreshedAt = stored && stored.refreshedAt ? stored.refreshedAt : 0;
  const ageDays = (Date.now() - refreshedAt) / 86400000;
  if (ageDays < REFRESH_AFTER_DAYS) return token;

  // Time to roll it forward. A failure here is not fatal: the current token
  // is still valid for a while yet, so we simply carry on and try next time.
  try {
    const r = await fetch(
      `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    if (!r.ok) return token;
    const data = await r.json();
    if (!data.access_token) return token;
    await env.IG_KV.put(
      'token',
      JSON.stringify({ value: data.access_token, refreshedAt: Date.now() })
    );
    return data.access_token;
  } catch (e) {
    return token;
  }
}

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/instagram', request);

  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const token = await getToken(env);
  if (!token) return json({ error: 'not_configured', posts: [] }, 503, 60);

  const limit = 12;
  const url = `${GRAPH}/me/media?fields=${FIELDS}&limit=${limit}&access_token=${encodeURIComponent(token)}`;

  let payload;
  try {
    const r = await fetch(url, { cf: { cacheTtl: 300 } });
    if (!r.ok) return json({ error: 'upstream', posts: [] }, 502, 60);
    payload = await r.json();
  } catch (e) {
    return json({ error: 'unreachable', posts: [] }, 502, 60);
  }

  const items = Array.isArray(payload.data) ? payload.data : [];
  const posts = items
    .filter((p) => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL_ALBUM' || p.media_type === 'VIDEO')
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      image: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
      permalink: p.permalink,
      caption: (p.caption || '').split('\n')[0].slice(0, 120),
      timestamp: p.timestamp,
    }))
    .filter((p) => Boolean(p.image));

  const res = json({ posts }, 200, EDGE_CACHE_SECONDS);
  waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
