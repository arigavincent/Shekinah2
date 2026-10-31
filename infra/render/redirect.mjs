import { createServer } from 'node:http';
// Keep bookmarks for the former standalone dashboard pointing at the current
// admin/API origin. There is one version of the admin and one CORS policy.
const target = 'https://shekinah-sons-backend.onrender.com';
createServer((request, response) => {
  if (request.url === '/healthz') { response.writeHead(200, { 'Content-Type': 'text/plain' }); response.end('ok'); return; }
  const path = request.url?.startsWith('/') ? request.url : '/';
  response.writeHead(308, { Location: target + path, 'Cache-Control': 'no-store' });
  response.end();
}).listen(Number(process.env.PORT || 10000), '0.0.0.0');
