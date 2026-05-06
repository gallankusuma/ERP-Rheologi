const jwt = require('jsonwebtoken');
const token = jwt.sign({userId:1, userLevel:10}, 'erp_rheologi_jwt_secret_2024_prod');
console.log('TOKEN:', token);

const http = require('http');
const options = {
  hostname: '127.0.0.1',
  port: 3002,
  path: '/api/bom/1/approve',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data);
  });
});
req.on('error', e => console.error('ERROR:', e.message));
req.end();
