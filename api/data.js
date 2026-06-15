const { readFileSync } = require('fs');
const { join } = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300');
  try {
    const data = readFileSync(join(process.cwd(), 'data', 'data.json'), 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
