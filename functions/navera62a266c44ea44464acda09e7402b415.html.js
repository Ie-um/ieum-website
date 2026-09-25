// Serves the Naver Search Advisor verification file at its exact .html path,
// bypassing Cloudflare Pages' automatic .html -> extensionless redirect.
export function onRequest() {
  return new Response("naver-site-verification: navera62a266c44ea44464acda09e7402b415.html", {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}
