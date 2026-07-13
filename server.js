/* Cat Chipper dev server — static files + POST /api/labels (writes audio/labels.json).
   Run: node server.js   (port 8321) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PORT = 8321;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.ico': 'image/x-icon'
};

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/clips') {
    const files = fs.readdirSync(path.join(ROOT, 'audio'))
      .filter(f => /\.(mp3|wav|ogg)$/i.test(f))
      .map(f => ({ file: 'audio/' + f, size: fs.statSync(path.join(ROOT, 'audio', f)).size }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ clips: files }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/upload') {
    const name = String(req.headers['x-filename'] || 'clip.mp3')
      .replace(/[^a-zA-Z0-9._ ()-]/g, '_').replace(/\.\./g, '_');
    if (!/\.(mp3|wav|ogg)$/i.test(name)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'mp3/wav/ogg only' })); return;
    }
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > 60e6) { req.destroy(); return; } chunks.push(c); });
    req.on('end', () => {
      try {
        fs.writeFileSync(path.join(ROOT, 'audio', name), Buffer.concat(chunks));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: 'audio/' + name }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/labels') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try {
        const j = JSON.parse(body);
        if (!j.clips || !Array.isArray(j.clips)) throw new Error('missing clips[]');
        const target = path.join(ROOT, 'audio', 'labels.json');
        if (fs.existsSync(target)) fs.copyFileSync(target, path.join(ROOT, 'audio', 'labels.backup.json'));
        fs.writeFileSync(target, JSON.stringify(j, null, 1), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, clips: j.clips.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  // static
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, () => console.log('cat chipper dev server on :' + PORT));
