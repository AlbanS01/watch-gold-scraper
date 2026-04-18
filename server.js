const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());

let cache = {
  or: 132201.62,
  ag: 2217.39,
  timestamp: new Date().toISOString(),
  status: 'initializing'
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (!data || data.trim() === '') {
          reject(new Error('Empty response'));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function updatePrices() {
  try {
    console.log(`[${new Date().toISOString()}] Updating prices...`);
    
    let taux = null;
    try {
      const d = await fetchJSON('https://open.er-api.com/v6/latest/USD');
      if (d.rates && d.rates.EUR) taux = d.rates.EUR;
    } catch(e) {}
    
    if (!taux) {
      try {
        const d = await fetchJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        if (d.usd && d.usd.eur) taux = d.usd.eur;
      } catch(e) {}
    }
    
    if (!taux) taux = 0.92;
    
    try {
      const d = await fetchJSON('https://api.metals.live/v1/spot/metals?symbols=AU,AG');
      if (d.metals && d.metals.AU && d.metals.AG) {
        cache.or = d.metals.AU;
        cache.ag = d.metals.AG;
        cache.timestamp = new Date().toISOString();
        cache.status = 'ok';
        console.log(`✓ Updated - Or: ${cache.or.toFixed(2)}, Ag: ${cache.ag.toFixed(2)}`);
        return;
      }
    } catch(e) {
      console.warn('metals.live error:', e.message);
    }
    
    cache.status = 'error';
  } catch(e) {
    console.error('Update error:', e.message);
    cache.status = 'error';
  }
}

// Update immediately on startup
updatePrices();

// Update every 15 minutes
setInterval(updatePrices, 15 * 60 * 1000);

app.get('/api/cours', (req, res) => {
  res.json({
    or: cache.or,
    ag: cache.ag,
    timestamp: cache.timestamp,
    source: 'metals.live',
    status: cache.status
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
