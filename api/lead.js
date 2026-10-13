// POST /api/lead — "Book a demo" requests from siletry.com.
// Sends the lead to Aman's WhatsApp through CallMeBot (free, self-notifications only).
//
// Vercel → Project → Settings → Environment Variables:
//   CALLMEBOT_PHONE   your WhatsApp number with country code, digits only (e.g. 919876543210)
//   CALLMEBOT_APIKEY  the key CallMeBot sends you after activation

const hits = new Map(); // best-effort rate limit per warm instance

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 5;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // Honeypot: real people never fill this hidden field
  if (clean(body.company_site, 200)) return res.status(200).json({ ok: true });

  const name = clean(body.name, 80);
  const city = clean(body.city, 60);
  const clinic = clean(body.clinic, 100);
  let phone = String(body.phone || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);

  if (name.length < 2) return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ ok: false, error: 'Please enter a valid 10-digit mobile number.' });
  if (city.length < 2) return res.status(400).json({ ok: false, error: 'Please enter your city.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again in a few minutes.' });

  const when = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const lines = [
    '*New demo request — siletry.com*',
    '',
    `Name: ${name}`,
    `WhatsApp: +91 ${phone}`,
    `City: ${city}`,
    clinic ? `Clinic: ${clinic}` : null,
    `Time: ${when}`,
    '',
    `Reply: https://wa.me/91${phone}`,
  ].filter((l) => l !== null);

  // Backup copy in Vercel logs, in case WhatsApp delivery fails
  console.log('LEAD', JSON.stringify({ name, phone, city, clinic, when }));

  const to = process.env.CALLMEBOT_PHONE;
  const key = process.env.CALLMEBOT_APIKEY;
  if (!to || !key) {
    console.error('CALLMEBOT_PHONE / CALLMEBOT_APIKEY not set');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  try {
    const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(to) +
      '&text=' + encodeURIComponent(lines.join('\n')) + '&apikey=' + encodeURIComponent(key);
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const text = await r.text();
    if (!r.ok) {
      console.error('CallMeBot failed', r.status, text.slice(0, 300));
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    console.log('CallMeBot', r.status, text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200));
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('CallMeBot error', e && e.message);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
