const mongoose = require('mongoose');

// Schema ย่อยสำหรับส่วนของกอพืช (Bounding Boxes)
const PlantSchema = new mongoose.Schema({
    id: String,
    confidence: Number,
    position: {
        top: Number,
        bottom: Number,
        left: Number,
        right: Number
    },
    size: {
        width: Number,
        height: Number
    }
});

// Schema หลักจำลองข้อมูล Dashboard
const DashboardDataSchema = new mongoose.Schema({
    metadata: {
        batchId: String,
        cycleProgress: Number,
        cameraStatus: String,
        lastCapture: String
    },
    visionInfo: {
        canopyCoverage: Number,
        plants: [PlantSchema]
    },
    systemLogs: [
        {
            time: String,
            type: { type: String }, // e.g. CALIBRATION, AI VISION
            message: String,
            processTime: String
        }
    ],
    growthState: {
        currentPhase: String,
        currentStepIndex: Number,
        totalSteps: Number
    },
    stats: {
        power: {
            watts: Number,
            usagePercentage: Number
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('DashboardData', DashboardDataSchema);
