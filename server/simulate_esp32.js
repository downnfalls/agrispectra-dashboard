const WebSocket = require('ws');
const http = require('http');

const ws = new WebSocket('ws://localhost:8080/hardware/command');

ws.on('open', function open() {
  console.log('✅ Simulated ESP32: Connected to Server');
});

ws.on('message', function message(data) {
  const payload = JSON.parse(data);
  console.log('📥 Simulated ESP32 Received Command:', payload);

  if (payload.action === 'FORCE_RESCAN') {
      console.log('🔄 Executing FORCE_RESCAN: Sending fresh telemetry data to server...');
      
      const mockState = {
          stage: "STAGE 1",
          leaf_count: Math.floor(Math.random() * 5) + 10,
          leaf_density: Math.floor(Math.random() * 20) + 60,
          total: 800,
          white: { value: 150, diff: -5 },
          blue: { value: 200, diff: 0 },
          red: { value: 400, diff: 10 },
          farRed: { value: 50, diff: 0 }
      };

      const postData = JSON.stringify(mockState);

      const options = {
          hostname: 'localhost',
          port: 8080,
          path: '/hardware/state',
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
          }
      };

      const req = http.request(options, (res) => {
          console.log(`📤 Telemetry sent. Server responded with status: ${res.statusCode}`);
      });

      req.on('error', (e) => {
          console.error(`⚠️ Problem sending telemetry: ${e.message}`);
      });

      req.write(postData);
      req.end();
  }
});

ws.on('close', function close() {
  console.log('❌ Simulated ESP32: Disconnected');
});

ws.on('error', function error(err) {
  console.error('⚠️ ESP32 Error:', err.message);
});
