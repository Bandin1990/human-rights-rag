const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const url = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';
const file = fs.createWriteStream(path.join(dir, 'thailand.json'));

https.get(url, (response) => {
  response.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Download completed');
  });
}).on('error', (err) => {
  console.error('Error downloading:', err.message);
});
