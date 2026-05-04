const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/hardware/ws');
ws.on('open', () => {
  console.log('connected');
});
ws.on('message', (data) => {
  console.log('received:', data.toString());
});
ws.on('close', () => {
  console.log('closed');
});
ws.on('error', (err) => {
  console.log('error:', err);
});
