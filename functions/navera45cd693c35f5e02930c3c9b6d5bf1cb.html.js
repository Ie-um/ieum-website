// Naver Search Advisor verification for https://ie-um.com (served at exact .html path).
export function onRequest() {
  return new Response("naver-site-verification: navera45cd693c35f5e02930c3c9b6d5bf1cb.html", {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}
