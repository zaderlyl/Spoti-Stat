module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const params = new URLSearchParams({
    ...req.query,
    api_key: process.env.LASTFM_KEY,
    format:  'json'
  });

  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur proxy Last.fm' });
  }
};
