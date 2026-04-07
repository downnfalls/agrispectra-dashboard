require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // 🟢 เพิ่ม HTTP module พื้นฐานของ Node
const { Server } = require('socket.io'); // 🟢 นำเข้า Socket.io
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app); // 🟢 ให้ http ครอบเซิร์ฟเวอร์ express อีกชั้นเพื่อให้รองรับ WebSocket

// 🟢 ติดตั้งเสาอากาศ Socket.io และอนุญาตให้โดเมนอื่นๆ (เช่น React) ยิงทราฟฟิกเข้ามาได้ข้ามโดเมน (CORS)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Middleware พื้นฐาน
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// เชื่อมต่อ MongoDB
if (MONGO_URI && !MONGO_URI.includes('<username>')) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('✅ Successfully connected to MongoDB Atlas!'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
    console.log('⚠️ WARNING: Valid MONGO_URI is missing in .env file. Running without database connection.');
}

// ผูก Endpoint แบบปกติ (REST API)
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.send('🌱 AgriSpectra Backend API with WebSockets is running!');
});

// 🟢 ตัวจัดการสายการเชื่อมต่อแบบ Real-time (เมื่อมีคนเข้าเว็บ หรือ ESP32 เสียบเข้ามา)
io.on('connection', (socket) => {
    console.log(`📡 New WebSocket Connection: [${socket.id}]`);

    // หูฟังตั้งรับ Event จาก ESP32 (เช่น ส่งมาด้วยชื่อ 'sensorData')
    socket.on('sensorData', (data) => {
        // เมื่อได้รับค่าจาก ESP32:
        // ตัวอย่างข้อมูลที่รับมา: { w: 380, temp: 24.5, time: ... }
        
        // เราสามารถใช้คำสั่งบันทึกลง Database สะสมเป็นประวัติได้ตรงนี้
        // เช่น DashboardData.create(data); 

        // หลังจากนั้น ทำตัวเป็นโทรโข่ง กระจายค่า (Broadcast) ยิงกลับไปหน้าจอ React ทันทีโดยไม่สนรีเฟรชโหมด!
        io.emit('frontend_update', data); 
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client Disconnected: [${socket.id}]`);
    });
});

// 🟢 สำคัญ: ต้องเปลี่ยนจาก app.listen เป็น server.listen เพื่อเปิดหวูดการใช้ WebSocket ในพอร์ต 5000 ด้วย
server.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT} (WebSocket Ready!)`);
});
