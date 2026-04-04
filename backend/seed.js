require('dotenv').config();
const mongoose = require('mongoose');
const DashboardData = require('./models/DashboardData');

const MONGO_URI = process.env.MONGO_URI;

// ข้อมูลจำลองตั้งต้นที่จะถูกอัดกลับเข้าไปใน Database ว่างๆ
const seedData = {
    metadata: {
        batchId: "L-8821",
        cycleProgress: 84,
        cameraStatus: "ONLINE",
        lastCapture: "Aug 25, 2026 - 14:15:39"
    },
    visionInfo: {
        canopyCoverage: 72,
        plants: [
            { id: "L-01", confidence: 96, position: { top: 30, left: 10 }, size: { width: 32, height: 32 } },
            { id: "L-02", confidence: 94, position: { top: 20, left: 30 }, size: { width: 36, height: 40 } },
            { id: "L-14", confidence: 87, position: { top: 35, right: 25 }, size: { width: 32, height: 32 } },
            { id: "L-19", confidence: 99, position: { bottom: 10, left: 45 }, size: { width: 24, height: 24 } }
        ]
    },
    systemLogs: [
        { time: "14:22:01", type: "CALIBRATION", message: "Sensor TSL-993 re-zeroed successfully.", processTime: "0.02ms" },
        { time: "14:21:44", type: "SYSTEM ACTION", message: "Irrigation valve #4 opened for cycle L-8821.", processTime: "0.45ms" },
        { time: "14:21:30", type: "AI VISION", message: "Lume-Scan completed: 72% coverage detected. Growth +1.2% dev.", processTime: "14.12ms" },
        { time: "14:20:12", type: "ALERT", message: "Humidity drop detected in Zone 4 (-4.5% RH). Adjusting ventilation.", processTime: "0.05ms" }
    ],
    growthState: {
        currentPhase: "Leaf Development",
        currentStepIndex: 2,
        totalSteps: 4
    },
    stats: {
        power: {
            watts: 380,
            usagePercentage: 60
        }
    }
};

const runSeeder = async () => {
    try {
        console.log('⏳ Connecting to MongoDB Atlas...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected!');

        // 1. ลบของเก่าออก (เพื่อป้องกันการเบิ้ลซ้ำเวลาคุณรันสคริปต์นี้หลายรอบ)
        console.log('🧹 Clearing old dashboard data...');
        await DashboardData.deleteMany({});

        // 2. ยัดก้อนข้อมูลของเราเข้าไปใหม่
        console.log('🌱 Seeding new data to Database...');
        await DashboardData.create(seedData);

        console.log('🎉 Data has been seeded successfully! Your database is no longer empty.');
        process.exit(); // จบการทำงาน
    } catch (error) {
        console.error('❌ Error saving data:', error);
        process.exit(1);
    }
};

runSeeder();
