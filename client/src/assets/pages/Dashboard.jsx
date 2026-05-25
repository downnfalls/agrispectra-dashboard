import React, { useState, useEffect, useRef } from 'react';
import agriImage from './login/resources/Agriculture.png';
import UserProfile from '../components/UserProfile';
import { API_BASE_URL } from '../../config';
import { fetchDeployedProfile } from '../utils/profileUtils';

// --- Hardware LED Power Constants (from datasheet) ---
// Max power per channel = Forward Voltage × Current × LED Count
const HW_POWER = {
    white:   { vf: 2.75,  mA: 65,  count: 180 },  // White 6500K   (2.6-2.9V)
    deepRed: { vf: 2.0,   mA: 700, count: 54 },   // Deep Red 660nm (1.8-2.2V)
    farRed:  { vf: 2.0,   mA: 350, count: 18 },   // Far Red 730nm  (1.8-2.2V)
    blue:    { vf: 2.975, mA: 350, count: 36 },   // Royal Blue 450nm (2.7-3.25V)
};
const MAX_WATTS_PER_CHANNEL = {
    white:   (HW_POWER.white.vf   * HW_POWER.white.mA   / 1000) * HW_POWER.white.count,
    deepRed: (HW_POWER.deepRed.vf * HW_POWER.deepRed.mA / 1000) * HW_POWER.deepRed.count,
    farRed:  (HW_POWER.farRed.vf  * HW_POWER.farRed.mA  / 1000) * HW_POWER.farRed.count,
    blue:    (HW_POWER.blue.vf    * HW_POWER.blue.mA    / 1000) * HW_POWER.blue.count,
};
const TOTAL_MAX_WATTS = MAX_WATTS_PER_CHANNEL.white + MAX_WATTS_PER_CHANNEL.deepRed + MAX_WATTS_PER_CHANNEL.farRed + MAX_WATTS_PER_CHANNEL.blue;

function Dashboard() {
    // --------------------------------------------------------
    // MOCK DATA PREPARATION (Ready for Backend Integration)
    // --------------------------------------------------------
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deployedProfile, setDeployedProfile] = useState(null);

    // --- WebSocket Hardware Status ---
    const [hardwareStatus, setHardwareStatus] = useState('OFFLINE');
    const [currentImageUrl, setCurrentImageUrl] = useState(agriImage);
    const [isRescanDisabled, setIsRescanDisabled] = useState(false);
    const [rescanCooldown, setRescanCooldown] = useState(0);
    const [lastCaptureTime, setLastCaptureTime] = useState("Aug 25, 2026 - 14:15:39");

    // --- Real-time System Logs ---
    const [systemLogs, setSystemLogs] = useState([]);
    const addLogRef = useRef(null);
    const hardwareStatusRef = useRef('OFFLINE');
    const addLog = (type, message) => {
        const now = new Date();
        const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSystemLogs(prev => [{ time, type, message, id: Date.now() + Math.random() }, ...prev].slice(0, 50));
    };
    addLogRef.current = addLog;

    useEffect(() => {
        let isComponentMounted = true;

        // 1. โหลดข้อมูล Profile ที่ Deployed ไว้จาก Server (sync ข้ามเครื่อง)
        const loadDeployedProfile = async () => {
            const profile = await fetchDeployedProfile();
            if (profile) setDeployedProfile(profile);
            return profile;
        };
        let currentProfile = null;

        // Helper to calculate active period based on local time
        const calculateActivePeriod = (timeline) => {
            if (!timeline || timeline.length === 0) return null;
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // Sort timeline by time
            const sorted = [...timeline].sort((a, b) => {
                const [hA, mA] = a.time.split(':').map(Number);
                const [hB, mB] = b.time.split(':').map(Number);
                return (hA * 60 + mA) - (hB * 60 + mB);
            });

            // Find active period (the latest period that has passed)
            let active = sorted[sorted.length - 1]; // default to last one (wrap around previous day)
            for (let i = 0; i < sorted.length; i++) {
                const [h, m] = sorted[i].time.split(':').map(Number);
                const mins = h * 60 + m;
                if (currentMinutes >= mins) {
                    active = sorted[i];
                } else {
                    break;
                }
            }
            return active;
        };

        // ฟังก์ชันส่วนกลางสำหรับแปลงข้อมูล ESP32 เป็น UI State
        const processPayload = (esp32Payload, activeProfile) => {
            const leafCount = esp32Payload.leaf_count;
            let currentPhaseName = "Initializing...";
            let currentStepIndex = 0;
            let totalSteps = activeProfile?.stages?.length || 4;
            let currentTimeline = [];
            let stageTargetPPFD = 0;
            let stageRatios = { blue: 25, red: 25, farRed: 25, white: 25 }; // default equal

            if (activeProfile && activeProfile.stages && activeProfile.stages.length > 0) {
                // Handle special 'Harvestable' stage from ESP32
                if (esp32Payload.stage === 'Harvestable') {
                    currentPhaseName = 'Harvestable';
                    currentStepIndex = totalSteps; // All steps completed
                    // Use last stage's timeline and PPFD as reference
                    const lastStage = activeProfile.stages[activeProfile.stages.length - 1];
                    currentTimeline = lastStage.timeline || [];
                    stageTargetPPFD = parseInt(lastStage.lightIntensity) || 0;
                    const total = (lastStage.blue || 0) + (lastStage.red || 0) + (lastStage.farRed || 0) + (lastStage.white || 0) || 1;
                    stageRatios = { blue: (lastStage.blue || 0) / total * 100, red: (lastStage.red || 0) / total * 100, farRed: (lastStage.farRed || 0) / total * 100, white: (lastStage.white || 0) / total * 100 };
                } else {
                    const foundIndex = activeProfile.stages.findIndex(s => s.name && s.name.split('\n')[0] === esp32Payload.stage);
                    if (foundIndex !== -1) {
                        currentPhaseName = esp32Payload.stage;
                        currentStepIndex = foundIndex + 1;
                        currentTimeline = activeProfile.stages[foundIndex].timeline || [];
                        stageTargetPPFD = parseInt(activeProfile.stages[foundIndex].lightIntensity) || 0;
                        const s = activeProfile.stages[foundIndex];
                        const total = (s.blue || 0) + (s.red || 0) + (s.farRed || 0) + (s.white || 0) || 1;
                        stageRatios = { blue: (s.blue || 0) / total * 100, red: (s.red || 0) / total * 100, farRed: (s.farRed || 0) / total * 100, white: (s.white || 0) / total * 100 };
                    } else {
                        // Fallback to first stage if stage name from hardware doesn't match or is missing
                        currentPhaseName = activeProfile.stages[0].name.split('\n')[0];
                        currentStepIndex = 1;
                        currentTimeline = activeProfile.stages[0].timeline || [];
                        stageTargetPPFD = parseInt(activeProfile.stages[0].lightIntensity) || 0;
                        const s = activeProfile.stages[0];
                        const total = (s.blue || 0) + (s.red || 0) + (s.farRed || 0) + (s.white || 0) || 1;
                        stageRatios = { blue: (s.blue || 0) / total * 100, red: (s.red || 0) / total * 100, farRed: (s.farRed || 0) / total * 100, white: (s.white || 0) / total * 100 };
                    }
                }
            }
            
            // Calculate current period based on local time
            const activePeriod = calculateActivePeriod(currentTimeline);

            let updatedPpfd = "--";
            let spectrumData = [
                { name: "Blue (450nm)", status: "WAITING...", percentage: 0, barColor: "bg-[#97CBFF]", statusColor: "text-[#625D71]" },
                { name: "Red (660nm)", status: "WAITING...", percentage: 0, barColor: "bg-red-500", statusColor: "text-[#625D71]" },
                { name: "Far-Red (730nm)", status: "WAITING...", percentage: 0, barColor: "bg-pink-700", statusColor: "text-[#625D71]" },
                { name: "White", status: "WAITING...", percentage: 0, barColor: "bg-gray-500", statusColor: "text-[#625D71]" }
            ];

            if (esp32Payload.total !== undefined) {
                updatedPpfd = esp32Payload.total.toString();
                const tot = esp32Payload.total;
                const calcPct = (v, t) => (!t || !v) ? 0 : Math.min(100, Math.round((v / t) * 100));

                const formatColor = (name, obj, colorClass) => {
                    const val = obj?.value || 0;
                    const diff = obj?.diff || 0;
                    let status = "Target Match";
                    let sColor = "text-[#625D71]";
                    if (diff > 0) { status = `+${diff} Above Target`; sColor = "text-[#34D399]"; }
                    else if (diff < 0) { status = `${diff} Below Target`; sColor = "text-[#EF4444]"; }

                    return {
                        name, status, percentage: calcPct(val, tot),
                        barColor: colorClass.bg, textColor: colorClass.text, statusColor: sColor,
                        rawValue: val
                    };
                };

                spectrumData = [
                    formatColor("Blue (450nm)", esp32Payload.blue, { bg: "bg-[#97CBFF]", text: "text-[#97CBFF]" }),
                    formatColor("Red (660nm)", esp32Payload.red, { bg: "bg-red-500", text: "text-red-500" }),
                    formatColor("Far-Red (730nm)", esp32Payload.farRed, { bg: "bg-pink-700", text: "text-pink-700" }),
                    formatColor("White", esp32Payload.white, { bg: "bg-gray-500", text: "text-gray-500" })
                ];
            }

            return {
                currentPhaseName, currentStepIndex, totalSteps,
                leafCount, spectrumData, currentPpfd: updatedPpfd,
                currentTimeline, activePeriod, stageTargetPPFD, stageRatios,
                pwm: {
                    blue: esp32Payload.blue?.pwm ?? null,
                    red: esp32Payload.red?.pwm ?? null,
                    farRed: esp32Payload.farRed?.pwm ?? null,
                    white: esp32Payload.white?.pwm ?? null
                }
            };
        };

        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Load deployed profile from server first
                currentProfile = await loadDeployedProfile();

                // 2. ขอข้อมูลจาก Backend
                const token = sessionStorage.getItem('token');
                let esp32Payload = null;
                try {
                    const hwResponse = await fetch(`${API_BASE_URL}/api/hardware/state`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (hwResponse.ok) {
                        esp32Payload = await hwResponse.json();
                        if (esp32Payload.last_image_url) {
                            setCurrentImageUrl(`${API_BASE_URL}${esp32Payload.last_image_url}`);
                        }
                        if (esp32Payload.last_capture_time) {
                            setLastCaptureTime(esp32Payload.last_capture_time);
                        }
                    }
                } catch (e) {
                    console.warn("Could not fetch hardware state.");
                }

                const processed = esp32Payload ? processPayload(esp32Payload, currentProfile) : {
                    currentPhaseName: currentProfile?.stages?.[0]?.name.split('\n')[0] || "No Active Profile",
                    currentStepIndex: currentProfile?.stages?.length > 0 ? 1 : 0,
                    totalSteps: currentProfile?.stages?.length || 4,
                    leafCount: null, currentPpfd: "--", 
                    currentTimeline: currentProfile?.stages?.[0]?.timeline || [],
                    activePeriod: calculateActivePeriod(currentProfile?.stages?.[0]?.timeline),
                    stageTargetPPFD: parseInt(currentProfile?.stages?.[0]?.lightIntensity) || 0,
                    stageRatios: (() => {
                        const s = currentProfile?.stages?.[0];
                        if (!s) return { blue: 25, red: 25, farRed: 25, white: 25 };
                        const total = (s.blue || 0) + (s.red || 0) + (s.farRed || 0) + (s.white || 0) || 1;
                        return { blue: (s.blue || 0) / total * 100, red: (s.red || 0) / total * 100, farRed: (s.farRed || 0) / total * 100, white: (s.white || 0) / total * 100 };
                    })(),
                    spectrumData: [
                        { name: "Blue (450nm)", status: "WAITING...", percentage: 0, barColor: "bg-[#97CBFF]", textColor: "text-[#97CBFF]", statusColor: "text-[#625D71]", rawValue: 0 },
                        { name: "Red (660nm)", status: "WAITING...", percentage: 0, barColor: "bg-red-500", textColor: "text-red-500", statusColor: "text-[#625D71]", rawValue: 0 },
                        { name: "Far-Red (730nm)", status: "WAITING...", percentage: 0, barColor: "bg-pink-700", textColor: "text-pink-700", statusColor: "text-[#625D71]", rawValue: 0 },
                        { name: "White", status: "WAITING...", percentage: 0, barColor: "bg-gray-500", textColor: "text-gray-500", statusColor: "text-[#625D71]", rawValue: 0 }
                    ]
                };

                const mockApiResponse = {
                    metadata: { batchId: "L-8821", cycleProgress: 84, lastCapture: "Aug 25, 2026 - 14:15:39" },
                    visionInfo: {
                        canopyCoverage: 72,
                        plants: [
                            { id: "L-01", confidence: 96, position: { top: 30, left: 10 }, size: { width: 32, height: 32 } },
                            { id: "L-02", confidence: 94, position: { top: 20, left: 30 }, size: { width: 36, height: 40 } },
                            { id: "L-14", confidence: 87, position: { top: 35, right: 25 }, size: { width: 32, height: 32 } },
                            { id: "L-19", confidence: 99, position: { bottom: 10, left: 45 }, size: { width: 24, height: 24 } }
                        ]
                    },
                    systemLogs: [],
                    growthState: {
                        currentPhase: processed.currentPhaseName,
                        currentStepIndex: processed.currentStepIndex,
                        totalSteps: processed.totalSteps,
                        leafCount: processed.leafCount,
                        currentTimeline: processed.currentTimeline,
                        activePeriod: processed.activePeriod,
                        stageTargetPPFD: processed.stageTargetPPFD || 0,
                        stageRatios: processed.stageRatios || { blue: 25, red: 25, farRed: 25, white: 25 },
                        pwm: processed.pwm || null
                    },
                    spectrum: processed.spectrumData,
                    stats: {
                        ppfd: { range: processed.currentPpfd, unit: "µmol/m²/s", diff: processed.currentPpfd === "--" ? "--" : "LIVE", diffSource: "ESP32", stable: processed.currentPpfd !== "--" },
                        latency: { value: 12, unit: "ms", status: "Stable" },
                        harvest: { estimateDays: 18, dateStr: "May 25" }
                    }
                };

                setTimeout(() => {
                    if (isComponentMounted) {
                        setDashboardData(mockApiResponse);
                        setIsLoading(false);
                    }
                }, 750);
            } catch (err) {
                console.error("Fetch Error:", err);
                if (isComponentMounted) setIsLoading(false);
            }
        };

        fetchDashboardData();

        // --- WebSocket Real-time Integration ---
        let socket = null;
        const connectWS = () => {
            const wsUrl = API_BASE_URL.replace('http', 'ws') + '/hardware/ws';
            console.log("Connecting to WebSocket:", wsUrl);
            socket = new WebSocket(wsUrl);

            socket.onopen = () => {
                console.log("✅ WebSocket Connected");
                addLogRef.current('SYSTEM ACTION', 'Dashboard WebSocket connected to server.');
            };

            socket.onmessage = (event) => {
                try {
                    const newPayload = JSON.parse(event.data);

                    // --- Handle Connection Status Update ---
                    if (newPayload.type === 'connection_status') {
                        const prevStatus = hardwareStatusRef.current;
                        hardwareStatusRef.current = newPayload.status;
                        setHardwareStatus(newPayload.status);
                        if (prevStatus !== newPayload.status) {
                            if (newPayload.status === 'ONLINE') {
                                addLogRef.current('SYSTEM ACTION', 'ESP32 CAM was Connected successfully.');
                            } else {
                                addLogRef.current('ALERT', 'Cannot connect to ESP32 CAM. Please check your network connection.');
                            }
                        }
                        return;
                    }

                    if (newPayload.type === 'new_image') {
                        console.log("📸 New image received:", newPayload.url);
                        setCurrentImageUrl(`${API_BASE_URL}${newPayload.url}`);

                        const now = new Date();
                        const options = { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
                        setLastCaptureTime(now.toLocaleString('en-US', options).replace(',', ' -'));
                        addLogRef.current('SYSTEM ACTION', 'Image uploaded successfully from ESP32 CAM.');
                        return;
                    }

                    console.log("📥 WS Message Received:", newPayload);
                    const processed = processPayload(newPayload, currentProfile);

                    // Log AI Vision result
                    if (processed.currentPhaseName) {
                        const leafInfo = processed.leafCount != null ? ` | Leaf Count: ${processed.leafCount}` : '';
                        addLogRef.current('AI VISION', `Current Stage: ${processed.currentPhaseName}${leafInfo}`);
                    }

                    // Log light calibration for current period
                    if (processed.activePeriod) {
                        addLogRef.current('CALIBRATION', `Light setup following period ${processed.activePeriod.time} : ${processed.activePeriod.intensity}%`);
                    }

                    // Log PPFD feedback
                    if (processed.currentPpfd !== "--") {
                        addLogRef.current('SYSTEM ACTION', 'Turned on TSL2591 Sensor for PPFD reading.');
                        addLogRef.current('CALIBRATION', `Current PPFD values received: ${processed.currentPpfd} µmol/m²/s`);
                    }

                    setDashboardData(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            growthState: {
                                ...prev.growthState,
                                currentPhase: processed.currentPhaseName || null,
                                currentStepIndex: processed.currentStepIndex,
                                totalSteps: processed.totalSteps,
                                leafCount: processed.leafCount,
                                currentTimeline: processed.currentTimeline,
                                activePeriod: processed.activePeriod,
                                stageTargetPPFD: processed.stageTargetPPFD || 0,
                                stageRatios: processed.stageRatios || { blue: 25, red: 25, farRed: 25, white: 25 },
                                pwm: processed.pwm || null
                            },
                            spectrum: processed.spectrumData,
                            stats: {
                                ...prev.stats,
                                ppfd: {
                                    ...prev.stats.ppfd,
                                    range: processed.currentPpfd,
                                    diff: processed.currentPpfd === "--" ? "--" : "LIVE",
                                    stable: processed.currentPpfd !== "--"
                                }
                            }
                        };
                    });
                } catch (e) {
                    console.error("Error parsing WS message:", e);
                }
            };

            socket.onclose = (e) => {
                console.log("❌ WebSocket Closed. Reconnecting in 3s...", e.reason);
                if (isComponentMounted) {
                    setTimeout(connectWS, 3000);
                }
            };

            socket.onerror = (err) => {
                console.error("⚠️ WebSocket Error:", err);
                socket.close();
            };
        };

        connectWS();

        return () => {
            isComponentMounted = false;
            if (socket) {
                console.log("Cleaning up WebSocket...");
                // Note: Calling close() while CONNECTING causes a harmless browser warning in React StrictMode.
                socket.close();
            }
        };
    }, []);

    const handleForceRescan = async () => {
        if (isRescanDisabled) return;

        setIsRescanDisabled(true);
        setRescanCooldown(5);

        const cooldownInterval = setInterval(() => {
            setRescanCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownInterval);
                    setIsRescanDisabled(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        addLog('SYSTEM ACTION', 'Force Re-Scan triggered by user. Sending command to ESP32...');

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/hardware/force-rescan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                console.log("Force Re-Scan command sent successfully.");
                addLog('SYSTEM ACTION', 'Force Re-Scan command delivered to ESP32 CAM successfully.');
            } else {
                console.error("Failed to send Force Re-Scan command.");
                addLog('ALERT', 'Failed to send Force Re-Scan command to ESP32.');
            }
        } catch (error) {
            console.error("Error sending Force Re-Scan command:", error);
            addLog('ALERT', 'Network error: Could not reach ESP32 for Re-Scan.');
        }
    };

    // Helper สำหรับสร้างสไตล์สีของก้อน Log
    const getLogStyle = (type) => {
        let textBase = type === 'CALIBRATION' ? 'text-[#97CBFF]' :
            type === 'SYSTEM ACTION' ? 'text-[#F1C40F]' :
                type === 'AI VISION' ? 'text-[#CBA6F7]' : 'text-[#F472B6]';

        return `${textBase} bg-[#2A2732]/50 px-2 py-0.5 rounded text-[9px] border ${textBase.replace('text-', 'border-')}/30 font-sans tracking-wider font-bold`;
    };

    if (isLoading || !dashboardData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A]">
                <div className="w-10 h-10 border-4 border-[#CBA6F7]/30 border-t-[#CBA6F7] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Fetching Dashboard Data...</div>
            </div>
        );
    }

    const { metadata, visionInfo, growthState, spectrum, stats } = dashboardData;

    return (
        <div className="p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto flex flex-col gap-4 md:gap-8">

            {/* Top Bar */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-4 sm:gap-8">
                    <h1 className="text-[#CBA6F7] text-xl sm:text-3xl font-bold tracking-wide">DASHBOARD</h1>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="bg-[#151515] rounded-full px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 border border-[#222]">
                        <div className={`w-2 h-2 rounded-full ${hardwareStatus === 'ONLINE' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-red-500'}`}></div>
                        <span className="text-white font-bold text-[10px] tracking-widest uppercase">System {hardwareStatus}</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-4 lg:gap-6">

                {/* Left Column (8) */}
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
                    {/* Big Image Container (Camera View) */}
                    <div className="bg-[#151515] rounded-2xl md:rounded-3xl overflow-hidden relative border border-[#222] h-[480px] p-1 flex flex-col">
                        <div className="relative flex-1 rounded-[1.4rem] overflow-hidden bg-[#1D1A24]">
                            <img src={currentImageUrl} alt="Canopy" className="w-full h-full object-contain absolute inset-0" />
                        </div>

                        {/* Capture Controls Bar */}
                        <div className="flex justify-between items-center p-4 bg-[#111]">
                            <div className="flex-1"></div>
                            <div className="flex flex-col items-end gap-3">
                                <span className="text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase">Last Capture: {lastCaptureTime}</span>
                                <button
                                    onClick={handleForceRescan}
                                    disabled={isRescanDisabled}
                                    className={`border px-6 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase transition ${isRescanDisabled
                                            ? 'border-[#625D71] text-[#625D71] cursor-not-allowed bg-transparent'
                                            : 'border-[#97CBFF]/50 text-[#97CBFF] hover:bg-[#97CBFF]/10 cursor-pointer'
                                        }`}>
                                    {isRescanDisabled ? `WAIT ${rescanCooldown}s...` : 'Force Re-Scan'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Daily Timeline (24-Hour) */}
                    {dashboardData.growthState.currentTimeline && dashboardData.growthState.currentTimeline.length > 0 && (
                        <div className="bg-[#151515] border border-[#222] rounded-3xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[#CBA6F7] font-bold text-[10px] tracking-widest uppercase">24-Hour Lighting Timeline</h3>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] font-bold uppercase ${dashboardData.growthState.activePeriod?.status === 'ACTIVE' ? 'text-[#34D399]' : 'text-[#625D71]'}`}>
                                            CURRENT PERIOD: {dashboardData.growthState.activePeriod?.status || 'UNKNOWN'}
                                        </span>
                                        {dashboardData.growthState.activePeriod?.status === 'ACTIVE' && (
                                            <span className="text-[#97CBFF] font-bold text-[11px] font-mono tracking-wider">
                                                {dashboardData.growthState.activePeriod?.intensity || 0}% ({Math.floor((dashboardData.growthState.stageTargetPPFD || 0) * ((dashboardData.growthState.activePeriod?.intensity || 0) / 100))} PPFD)
                                            </span>
                                        )}
                                    </div>
                            </div>
                            
                            <div className="relative mt-12 mb-8">
                                {/* Current Time Indicator Pin (Prominent Arrow) */}
                                {(() => {
                                    const now = new Date();
                                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                                    const leftPercent = (currentMinutes / 1440) * 100;
                                    
                                    return (
                                        <div 
                                            className="absolute top-[-1rem] bottom-[-1rem] z-30 flex flex-col items-center pointer-events-none drop-shadow-[0_0_5px_rgba(239,68,68,0.6)]"
                                            style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                                        >
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-red-500 mb-[1px]">
                                                <path d="M12 22L2 10H22L12 22Z" fill="currentColor"/>
                                            </svg>
                                            <div className="w-[1.5px] flex-1 bg-red-500/80"></div>
                                        </div>
                                    );
                                })()}

                                {/* Timeline Bar */}
                                <div className="relative h-2 bg-[#1A1822] rounded-full flex overflow-hidden border border-[#2A2732] shadow-inner z-10">
                                    {(() => {
                                        const timeline = dashboardData.growthState.currentTimeline;
                                        const sorted = [...timeline].sort((a, b) => {
                                            const [hA, mA] = a.time.split(':').map(Number);
                                            const [hB, mB] = b.time.split(':').map(Number);
                                            return (hA * 60 + mA) - (hB * 60 + mB);
                                        });
                                        
                                        const segments = [];
                                        for (let i = 0; i < sorted.length; i++) {
                                            const current = sorted[i];
                                            const next = sorted[i + 1];
                                            const [cH, cM] = current.time.split(':').map(Number);
                                            const startMins = cH * 60 + cM;
                                            
                                            if (i === 0 && startMins > 0) {
                                                const lastPeriod = sorted[sorted.length - 1];
                                                segments.push({
                                                    startMins: 0,
                                                    durationMins: startMins,
                                                    status: lastPeriod.status,
                                                    intensity: lastPeriod.intensity
                                                });
                                            }
                                            
                                            let endMins = 1440;
                                            if (next) {
                                                const [nH, nM] = next.time.split(':').map(Number);
                                                endMins = nH * 60 + nM;
                                            }
                                            
                                            segments.push({
                                                startMins: startMins,
                                                durationMins: endMins - startMins,
                                                status: current.status,
                                                intensity: current.intensity
                                            });
                                        }
                                        
                                        return segments.map((seg, idx) => (
                                            <div 
                                                key={idx} 
                                                style={{ width: `${(seg.durationMins / 1440) * 100}%` }} 
                                                className={`h-full transition-all ${seg.status === 'ACTIVE' ? 'bg-[#97CBFF] opacity-80' : 'bg-transparent'} ${idx < segments.length - 1 ? 'border-r border-[#3E3A4B]/50' : ''}`}
                                            ></div>
                                        ));
                                    })()}
                                </div>
                                
                                {/* Period Timestamps & % Markers */}
                                {(() => {
                                    const timeline = dashboardData.growthState.currentTimeline;
                                    return timeline.map((seg, idx) => {
                                        const [h, m] = seg.time.split(':').map(Number);
                                        const mins = h * 60 + m;
                                        const leftPercent = (mins / 1440) * 100;
                                        return (
                                            <React.Fragment key={idx}>
                                                {/* % Pin Above */}
                                                <div className="absolute top-[-2rem] flex flex-col items-center z-20" style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}>
                                                    <div className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono shadow-md ${seg.status === 'ACTIVE' ? 'bg-[#97CBFF]/20 text-[#97CBFF] border border-[#97CBFF]/30' : 'bg-[#1A1822] text-[#625D71] border border-[#2A2732]'}`}>
                                                        {seg.intensity}%
                                                    </div>
                                                    <div className="w-[1px] h-2.5 bg-[#3E3A4B] mt-0.5"></div>
                                                </div>

                                                {/* Timestamp Below */}
                                                <div className="absolute top-2 flex flex-col items-center z-20" style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}>
                                                    <div className="w-[1px] h-2.5 bg-[#3E3A4B] mb-1"></div>
                                                    <span className="text-[#9893A6] text-[11px] font-mono font-bold tracking-wider">{seg.time}</span>
                                                </div>
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}

                    {/* System Logs */}
                    <div className="bg-[#111] border border-[#222] rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white font-bold text-[11px] tracking-widest uppercase flex items-center gap-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBA6F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                System Logs
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse"></div>
                                    <span className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">Live</span>
                                </div>
                                <span className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase cursor-pointer hover:text-white transition-colors" onClick={() => setSystemLogs([])}>Clear</span>
                            </div>
                        </div>

                        <div className="flex flex-col space-y-3 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2A2732 transparent' }}>
                            {systemLogs.length === 0 ? (
                                <div className="text-[#625D71] text-xs font-mono text-center py-8 tracking-wider">Waiting for system events...</div>
                            ) : (
                                systemLogs.map((log, index) => (
                                    <div key={log.id} className={`flex items-start gap-3 text-xs font-mono border-b border-[#2A2732]/50 pb-3 ${index === systemLogs.length - 1 ? 'border-b-transparent' : ''}`}>
                                        <span className="text-[#625D71] shrink-0">[{log.time}]</span>
                                        <span className={`shrink-0 ${getLogStyle(log.type)}`}>{log.type}</span>
                                        <span className="text-gray-300 flex-1 break-words leading-relaxed">{log.message}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column (4) */}
                <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
                    {/* Growth State */}
                    <div className="bg-[#151515] border border-[#222] rounded-3xl p-6">
                        <h3 className="text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase mb-6">Growth State</h3>
                        <p className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase text-center mb-2">
                            {growthState.currentPhase && growthState.currentStepIndex > 0
                                ? `PHASE ${growthState.currentStepIndex} OF ${growthState.totalSteps}`
                                : "Current Protocol Phase"}
                        </p>
                        <h2 className="text-white text-3xl font-bold text-center tracking-widest uppercase mb-6">
                            {growthState.currentPhase ? growthState.currentPhase : "---"}
                        </h2>

                        <div className="flex gap-2 mb-6">
                            {Array.from({ length: growthState.totalSteps }).map((_, i) => (
                                <div key={i} className={`h-1 flex-1 ${i < growthState.currentStepIndex ? 'bg-[#34D399]' : 'bg-[#3E3A4B]'}`}></div>
                            ))}
                        </div>

                        {/* Leaf Count */}
                        <div className="flex justify-between border-t border-[#3E3A4B] pt-6">
                            <div className="flex flex-col items-center w-full">
                                <span className="text-[#625D71] text-[9px] font-bold tracking-widest uppercase mb-1">Leaf Count</span>
                                <span className={`text-xl font-mono font-bold ${growthState.leafCount != null ? 'text-[#97CBFF]' : 'text-[#625D71]'}`}>
                                    {growthState.leafCount != null ? growthState.leafCount : "--"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Spectrum */}
                    <div className="bg-[#151515] border border-[#222] rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-[#CBA6F7] font-bold text-[10px] tracking-widest uppercase">Spectrum (TSL2591)</h3>
                            <span className="text-[#34D399] font-bold text-[10px] tracking-widest uppercase">Stable-Optimized</span>
                        </div>

                        <div className="flex flex-col gap-4">
                            {spectrum.map((color, i) => (
                                <div key={i} className="grid grid-cols-3 items-center text-[10px] font-bold tracking-widest uppercase border-b border-[#2A2732] pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-6 rounded-full ${color.barColor}`}></div>
                                        <span className="text-gray-400">{color.name}</span>
                                    </div>
                                    <div className="text-center flex items-baseline justify-center gap-1">
                                        <span className={`text-lg font-mono tracking-tighter ${color.textColor}`}>{color.rawValue}</span>
                                        <span className="text-[#625D71] text-[9px]">PPFD</span>
                                    </div>
                                    <div className={`text-right ${color.statusColor}`}>
                                        {color.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="bg-[#151515] border border-[#222] rounded-3xl p-6 flex flex-col gap-6">
                        {/* PPFD */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#3E3A4B]/50 flex items-center justify-center shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#CBA6F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-1">PPFD</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-white text-2xl font-bold tracking-tight">{stats.ppfd.range}</span>
                                    <span className="text-gray-400 text-[10px]">{stats.ppfd.unit}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`font-bold text-[10px] ${stats.ppfd.stable ? 'text-[#34D399]' : 'text-[#EF4444]'}`}>{stats.ppfd.diff}</span>
                                <span className="text-[#625D71] text-[9px]">{stats.ppfd.diffSource}</span>
                            </div>
                        </div>
                    </div>

                    {/* Power Consumption (Red box) */}
                    {(() => {
                        const pwm = growthState.pwm;
                        let currentWatts;
                        let isLive = false;

                        if (pwm && pwm.blue !== null) {
                            // Use real PWM duty cycle from ESP32
                            currentWatts = Math.round(
                                MAX_WATTS_PER_CHANNEL.blue    * ((pwm.blue   || 0) / 100) +
                                MAX_WATTS_PER_CHANNEL.deepRed  * ((pwm.red    || 0) / 100) +
                                MAX_WATTS_PER_CHANNEL.farRed   * ((pwm.farRed || 0) / 100) +
                                MAX_WATTS_PER_CHANNEL.white    * ((pwm.white  || 0) / 100)
                            );
                            isLive = true;
                        } else {
                            // Fallback: estimate from recipe ratio × period intensity
                            const intensity = growthState.activePeriod?.intensity || 0;
                            const ratios = growthState.stageRatios || { blue: 25, red: 25, farRed: 25, white: 25 };
                            currentWatts = Math.round(
                                (MAX_WATTS_PER_CHANNEL.blue    * (ratios.blue   / 100) +
                                 MAX_WATTS_PER_CHANNEL.deepRed  * (ratios.red    / 100) +
                                 MAX_WATTS_PER_CHANNEL.farRed   * (ratios.farRed / 100) +
                                 MAX_WATTS_PER_CHANNEL.white    * (ratios.white  / 100))
                                * (intensity / 100)
                            );
                        }
                        const usagePct = Math.round((currentWatts / TOTAL_MAX_WATTS) * 100);
                        return (
                            <div className="bg-[#151515] border border-[#222] rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                                <div className="absolute left-0 top-6 bottom-6 w-1 bg-red-500 rounded-r"></div>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase pl-3">Power Consumption</h3>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                </div>
                                <div className="pl-3">
                                    <div className="flex items-baseline gap-2 mb-1 mt-4">
                                        <span className="text-white text-5xl font-bold tracking-tighter">{currentWatts}</span>
                                        <span className="text-gray-400 font-bold">W</span>
                                    </div>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[#625D71] text-[9px] font-bold tracking-widest">OF {Math.round(TOTAL_MAX_WATTS)}W MAX ({isLive ? 'LIVE' : 'EST.'})</span>
                                        <span className="text-[#625D71] text-[9px] font-bold tracking-widest">{usagePct}%</span>
                                    </div>
                                    <div className="h-1.5 bg-[#15121C] rounded-full overflow-hidden flex">
                                        <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${usagePct}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

            </div>
        </div>
    );
}

export default Dashboard;