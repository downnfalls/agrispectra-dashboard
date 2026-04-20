const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/hardware/command');

ws.on('open', function open() {
  console.log('✅ Simulated ESP32: Connected to Server');
});

ws.on('message', function message(data) {
  console.log('📥 Simulated ESP32 Received Command:', JSON.parse(data));
});

ws.on('close', function close() {
  console.log('❌ Simulated ESP32: Disconnected');
});

ws.on('error', function error(err) {
  console.error('⚠️ ESP32 Error:', err.message);
});
