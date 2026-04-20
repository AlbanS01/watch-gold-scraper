const express = require('express');
const cors = require('cors');
const https = require('https');
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
    https.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

async function updatePrices() {
  try {
    console.log(`[${new Date().toISOString()}] Updating prices...`);
    
    const apiKey = process.env.METAL_API_KEY;
    const url = `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=XAU,XAG`;
    
    const data = await fetchJSON(url);
    
    if (data.rates && data.rates.XAU && data.rates.XAG) {
      const usdEur = 0.92;
      const ozEnKg = 32.1507;
      cache.or = (1 / data.rates.XAU) * ozEnKg * usdEur;
      cache.ag = (1 / data.rates.XAG) * ozEnKg * usdEur;
      cache.timestamp = new Date().toISOString();
      cache.status = 'ok';
      console.log(`✓ Updated - Or: ${cache.or.toFixed(2)}, Ag: ${cache.ag.toFixed(2)}`);
    } else {
      cache.status = 'error';
    }
  } catch(e) {
    console.error('Update error:', e.message);
    cache.status = 'error';
  }
}

updatePrices();
setInterval(updatePrices, 15 * 60 * 1000);

app.get('/api/cours', (req, res) => {
  res.json({
    or: cache.or,
    ag: cache.ag,
    timestamp: cache.timestamp,
    source: 'metalpriceapi.com',
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
