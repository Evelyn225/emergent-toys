export default async function handler(req, res) {
  const RADAR_KEY = process.env.RADAR_KEY;
  const url = 'https://api.cloudflare.com/client/v4/radar/http/summary/countries?dateRange=1d';

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${RADAR_KEY}` }
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch Cloudflare Radar country data.' });
  }
}
