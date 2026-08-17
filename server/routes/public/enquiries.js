const crypto = require('crypto');
const { putPrivate } = require('../../lib/private-data');

function clean(value, max) {
  return String(value || '').trim().replace(/\0/g, '').slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (clean(req.body?.website, 200)) return res.status(200).json({ submitted: true });

    const enquiry = {
      id: `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
      name: clean(req.body?.name, 160),
      email: clean(req.body?.email, 254),
      company: clean(req.body?.company, 200),
      area: clean(req.body?.area, 180),
      message: clean(req.body?.message, 6000),
      status: 'new',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (String(req.body?.consent || '') !== 'yes') {
      return res.status(400).json({ error: 'Consent is required before an enquiry can be submitted.' });
    }

    if (!enquiry.name || !validEmail(enquiry.email) || !enquiry.area || !enquiry.message) {
      return res.status(400).json({ error: 'Please complete all required enquiry fields.' });
    }

    await putPrivate(`kdh/enquiries/${enquiry.id}.json`, `${JSON.stringify(enquiry, null, 2)}\n`, {
      contentType: 'application/json'
    });
    return res.status(201).json({ submitted: true });
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    return res.status(status).json({ error: error?.message || 'The enquiry could not be submitted.' });
  }
};
