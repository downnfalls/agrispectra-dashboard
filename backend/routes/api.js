const express = require('express');
const router = express.Router();
const DashboardData = require('../models/DashboardData');

// Endpoint: GET /api/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // อนาคต: const dashboardStats = await DashboardData.findOne().sort({ createdAt: -1 });
        
        // ข้อมูลจำลองสำหรับยิงทดสอบก่อนที่จะมีฐานข้อมูลจริง
        const mockApiResponse = {
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
            spectrum: [
                { name: "Blue (450nm)", status: "+3% Above Target", percentage: 70, barColor: "bg-[#97CBFF]", statusColor: "text-[#34D399]" },
                { name: "Red (660nm)", status: "Target Match", percentage: 85, barColor: "bg-red-500", statusColor: "text-[#625D71]" },
                { name: "Far-Red (730nm)", status: "-2% Below Target", percentage: 20, barColor: "bg-pink-700", statusColor: "text-red-400" },
                { name: "White (Target 10%)", status: "Target Match", percentage: 10, barColor: "bg-gray-500", statusColor: "text-[#625D71]" }
            ],
            stats: {
                ppfd: { range: "250 - 280", unit: "µmol/m²/s", diff: "+0.8%", diffSource: "VS AVG", stable: true },
                latency: { value: 12, unit: "ms", status: "Stable" },
                harvest: { estimateDays: 18, dateStr: "May 25" },
                power: { watts: 380, usagePercentage: 60 }
            }
        };

        // หน่วงเวลาจำลอง Server Processing Time
        setTimeout(() => {
            res.json(mockApiResponse);
        }, 150);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Endpoint: GET /api/energy
router.get('/energy', (req, res) => {
    const mockApiResponse = {
        metadata: {
            date: "AUG 25, 2026",
            status: "ONLINE",
            recipe: "Default Lettuce"
        },
        overview: {
            avgKw: 4.2,
            currentDrawWatts: 380,
            dailyKwh: 9.12,
            dailyQuotaRemainingPct: 68,
            dliRatio: 0.84,
            dliStatus: "OPTIMAL",
            monthlyForecastThb: 975.00
        },
        pricing: {
            onPeakRate: 4.10,
            offPeakRate: 2.58,
            todayEstimate: 32.50,
            vsSeasonalPct: 12
        },
        hourlyConsumption: [
            { hour: 0, val: 20, peak: false },
            { hour: 1, val: 28, peak: false },
            { hour: 2, val: 35, peak: false },
            { hour: 3, val: 50, peak: true },
            { hour: 4, val: 65, peak: true },
            { hour: 5, val: 80, peak: true },
            { hour: 6, val: 85, peak: true },
            { hour: 7, val: 75, peak: true },
            { hour: 8, val: 60, peak: true },
            { hour: 9, val: 45, peak: false },
            { hour: 10, val: 35, peak: false },
            { hour: 11, val: 25, peak: false },
            { hour: 12, val: 30, peak: false },
            { hour: 13, val: 40, peak: false },
            { hour: 14, val: 55, peak: true },
            { hour: 15, val: 70, peak: true },
            { hour: 16, val: 85, peak: true },
            { hour: 17, val: 95, peak: true },
            { hour: 18, val: 100, peak: true },
            { hour: 19, val: 80, peak: true },
            { hour: 20, val: 60, peak: true },
            { hour: 21, val: 45, peak: false },
            { hour: 22, val: 30, peak: false },
            { hour: 23, val: 20, peak: false },
        ]
    };
    
    setTimeout(() => {
        res.json(mockApiResponse);
    }, 150);
});

module.exports = router;
