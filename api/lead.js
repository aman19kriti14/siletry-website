// POST /api/lead — "Book a demo" requests from siletry.com.
// Sends the lead to your WhatsApp through Meta's WhatsApp Cloud API.
//
// Default: a plain text message. Meta only delivers plain text if LEAD_NOTIFY_TO has messaged
// the business number in the last 24 hours, so message it once a day.
// Later: create an approved template and set WA_LEAD_TEMPLATE to switch to template mode.
//
// Vercel → siletry-landing → Settings → Environment Variables:
//   WA_TOKEN            permanent access token (System User token with whatsapp_business_messaging)
//   WA_PHONE_NUMBER_ID  "Phone number ID" of your Siletry business number (WhatsApp → API Setup)
//   LEAD_NOTIFY_TO      your personal WhatsApp number, digits only with 91 (e.g. 919876543210)
//   WA_LEAD_TEMPLATE    (optional) approved template name, e.g. new_demo_lead. Unset = plain text.
//   WA_LEAD_TEMPLATE_LANG  (optional) template language code (default: en)
//
// Template body (category Utility), when you create it:
//   💬 New Demo Request\n\nName: {{1}}\nWhatsApp: {{2}}\nCity: {{3}}\nClinic: {{4}}\n\nContact them within a few hours to book their demo.

const GRAPH = 'https://graph.facebook.com/v21.0';
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
  // Backup copy in Vercel logs, in case WhatsApp delivery fails
  console.log('LEAD', JSON.stringify({ name, phone, city, clinic, when }));

  const token = process.env.WA_TOKEN;
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const to = String(process.env.LEAD_NOTIFY_TO || '').replace(/\D/g, '');
  if (!token || !phoneId || !to) {
    console.error('WA_TOKEN / WA_PHONE_NUMBER_ID / LEAD_NOTIFY_TO not set');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const template = process.env.WA_LEAD_TEMPLATE;
  const text = [
    '💬 New Demo Request',
    '',
    `Name: ${name}`,
    `WhatsApp: +91${phone}`,
    `City: ${city}`,
    clinic ? `Clinic: ${clinic}` : null,
    `Time: ${when}`,
    '',
    'Contact them within a few hours to book their demo.',
    `https://wa.me/91${phone}`,
  ].filter((l) => l !== null).join('\n');

  const payload = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WA_LEAD_TEMPLATE_LANG || 'en' },
          components: [{
            type: 'body',
            parameters: [name, `+91 ${phone}`, city, clinic || 'not given'].map((t) => ({ type: 'text', text: t })),
          }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } };

  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(phoneId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9000),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Meta send failed', r.status, JSON.stringify(out.error || out).slice(0, 500));
      return res.status(502).json({ ok: false, error: 'send_failed' });
    }
    console.log('Meta sent', out.messages && out.messages[0] && out.messages[0].id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Meta send error', e && e.message);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
