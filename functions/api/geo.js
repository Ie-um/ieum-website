/**
 * IEUM Concierge — visitor country endpoint
 *
 * Cloudflare Pages Function. Returns the visitor's country so the site can
 * decide whether a consent banner is legally required before any non
 * essential cookie is set.
 *
 * Cloudflare resolves the country at the edge, so no third party lookup and
 * no IP address ever leaves our own infrastructure.
 *
 * Fails closed: if the country cannot be determined, consent is treated as
 * required. The safer answer is the default.
 */

const CONSENT_REQUIRED = new Set([
  // European Union
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
  'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  // European Economic Area and the UK and Switzerland
  'GB','IS','LI','NO','CH',
]);

export async function onRequestGet({ request }) {
  const country =
    (request.cf && request.cf.country) ||
    request.headers.get('cf-ipcountry') ||
    null;

  // No country, or Cloudflare's placeholder for unknown, means we ask.
  const unknown = !country || country === 'XX' || country === 'T1';
  const required = unknown ? true : CONSENT_REQUIRED.has(country);

  return new Response(
    JSON.stringify({ country: unknown ? null : country, consentRequired: required }),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'private, no-store',
      },
    }
  );
}
