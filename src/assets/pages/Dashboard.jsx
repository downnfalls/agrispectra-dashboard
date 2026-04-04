import React, { useState, useEffect } from 'react';
import agriImage from './login/resources/Agriculture.png';
import UserProfile from '../components/UserProfile';

function Dashboard() {
    // --------------------------------------------------------
    // MOCK DATA PREPARATION (Ready for Backend Integration)
    // --------------------------------------------------------
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // จำลองการเรียก API ข้อมูล Dashboard แดชบอร์ด
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // จำลอง Response จาก Backend
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
                        currentStepIndex: 2, // ขั้นที่ 1 และ 2 เสร็จแล้ว
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

                setTimeout(() => {
                    setDashboardData(mockApiResponse);
                    setIsLoading(false);
                }, 750); // delay จำลองเน็ต
            } catch (err) {
                console.error("Failed to fetch dashboard overview", err);
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    // Helper สำหรับสร้างสไตล์สีของก้อน Log
    const getLogStyle = (type) => {
        let textBase = type === 'CALIBRATION' ? 'text-[#97CBFF]' : 
                       type === 'SYSTEM ACTION' ? 'text-[#F1C40F]' :
                       type === 'AI VISION' ? 'text-[#CBA6F7]' : 'text-[#F472B6]';
        
        return `${textBase} bg-[#2A2732]/50 px-2 py-0.5 rounded text-[9px] border ${textBase.replace('text-', 'border-')}/30 font-sans tracking-wider font-bold`;
    };

    if (isLoading || !dashboardData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-[#CBA6F7]/30 border-t-[#CBA6F7] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Fetching Dashboard Data...</div>
            </div>
        );
    }

    const { metadata, visionInfo, systemLogs, growthState, spectrum, stats } = dashboardData;

    return (
        <div className="p-8 lg:p-12 max-w-[1600px] mx-auto flex flex-col gap-8">
            
            {/* Top Bar */}
            <header className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-8">
                    <h1 className="text-[#CBA6F7] text-3xl font-bold tracking-wide">JANGKOPF</h1>
                    <div className="flex items-center gap-6">
                        <div className="border-b-2 border-[#97CBFF] pb-1">
                            <span className="text-white font-bold text-xs tracking-widest uppercase">Batch ID: {metadata.batchId}</span>
                        </div>
                        <span className="text-[#625D71] font-bold text-xs tracking-widest uppercase">Cycle: {metadata.cycleProgress}%</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-[#15121C] rounded-full px-4 py-2 flex items-center gap-3 border border-[#2A2732]">
                        <div className={`w-2 h-2 rounded-full ${metadata.cameraStatus === 'ONLINE' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-red-500'}`}></div>
                        <span className="text-white font-bold text-[10px] tracking-widest uppercase">ESP32 CAM {metadata.cameraStatus}</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Main Grid */}
            <div className="grid grid-cols-12 gap-6">
                
                {/* Left Column (8) */}
                <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
                    
                    {/* Big Image Container (Camera View) */}
                    <div className="bg-[#2A2732] rounded-3xl overflow-hidden relative border border-[#3E3A4B] h-[480px] p-1 flex flex-col">
                        <div className="relative flex-1 rounded-[1.4rem] overflow-hidden bg-[#1D1A24]">
                            <img src={agriImage} alt="Canopy" className="w-full h-full object-cover absolute inset-0 opacity-80" />
                            
                            {/* Coverage Widget */}
                            <div className="absolute top-4 right-4 bg-[#15121C]/80 backdrop-blur-md border border-[#3E3A4B] p-4 rounded-xl">
                                <p className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-1">Canopy Coverage</p>
                                <p className="text-[#97CBFF] text-4xl font-bold text-right">{visionInfo.canopyCoverage}%</p>
                            </div>

                            {/* Bounding Boxes rendering from state */}
                            {visionInfo.plants.map((plant, index) => {
                                // แปลงค่า x, y เป็น CSS style เพื่อจัดตำแหน่ง
                                const positioning = {
                                    top: plant.position.top != null ? `${plant.position.top}%` : undefined,
                                    bottom: plant.position.bottom != null ? `${plant.position.bottom}%` : undefined,
                                    left: plant.position.left != null ? `${plant.position.left}%` : undefined,
                                    right: plant.position.right != null ? `${plant.position.right}%` : undefined,
                                };
                                return (
                                    <div key={index} className="absolute border border-[#34D399] bg-[#34D399]/10" 
                                         style={{ 
                                            ...positioning, 
                                            width: `${plant.size.width}px`, 
                                            height: `${plant.size.height}px` 
                                         }}>
                                        <span className="absolute -top-5 left-0 bg-[#34D399]/20 text-[#34D399] text-[9px] px-2 py-0.5 border border-[#34D399] font-mono whitespace-nowrap">
                                            {plant.id} [{plant.confidence}%]
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Capture Controls Bar */}
                        <div className="flex justify-between items-center p-4 bg-[#15121C]">
                            <div className="flex-1"></div>
                            <div className="flex flex-col items-end gap-3">
                                <span className="text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase">Last Capture: {metadata.lastCapture}</span>
                                <button className="border border-[#97CBFF]/50 text-[#97CBFF] px-6 py-2 rounded-lg font-bold text-[10px] tracking-widest uppercase hover:bg-[#97CBFF]/10 transition">
                                    Force Re-Scan
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* System Intelligence Logs */}
                    <div className="bg-[#15121C] border border-[#2A2732] rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white font-bold text-[11px] tracking-widest uppercase flex items-center gap-2">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBA6F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                System Intelligence Logs
                            </h3>
                            <div className="flex gap-4">
                                <span className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase cursor-pointer hover:text-white transition-colors">Filter: All</span>
                                <span className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase cursor-pointer hover:text-white transition-colors">Export CSV</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col space-y-4">
                            {systemLogs.map((log, index) => (
                                <div key={index} className={`flex items-center gap-4 text-xs font-mono border-b border-[#2A2732] pb-3 ${index === systemLogs.length - 1 ? 'border-b-transparent' : ''}`}>
                                    <span className="text-[#625D71]">[{log.time}]</span>
                                    <span className={getLogStyle(log.type)}>{log.type}</span>
                                    <span className="text-gray-300 flex-1">{log.message}</span>
                                    <span className="text-[#625D71]">{log.processTime}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Right Column (4) */}
                <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
                    
                    {/* Growth State */}
                    <div className="bg-[#2A2732] border border-[#3E3A4B] rounded-3xl p-6">
                        <h3 className="text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase mb-6">Growth State</h3>
                        <p className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase text-center mb-2">Current Protocol Phase</p>
                        <h2 className="text-white text-3xl font-bold text-center tracking-widest uppercase mb-6">{growthState.currentPhase}</h2>
                        
                        <div className="flex gap-2">
                            {Array.from({ length: growthState.totalSteps }).map((_, i) => (
                                <div key={i} className={`h-1 flex-1 ${i < growthState.currentStepIndex ? 'bg-[#34D399]' : 'bg-[#3E3A4B]'}`}></div>
                            ))}
                        </div>
                    </div>

                    {/* Spectrum */}
                    <div className="bg-[#2A2732] border border-[#3E3A4B] rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-[#CBA6F7] font-bold text-[10px] tracking-widest uppercase">Spectrum (TSL2591)</h3>
                            <span className="text-[#34D399] font-bold text-[10px] tracking-widest uppercase">Stable-Optimized</span>
                        </div>
                        
                        <div className="flex flex-col gap-6">
                            {spectrum.map((color, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-2">
                                        <span className="text-gray-400">{color.name}</span>
                                        <span className={color.statusColor}>{color.status}</span>
                                    </div>
                                    <div className="h-1.5 bg-[#15121C] rounded-full overflow-hidden flex">
                                        <div className={`h-full ${color.barColor}`} style={{ width: `${color.percentage}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="bg-[#2A2732] border border-[#3E3A4B] rounded-3xl p-6 flex flex-col gap-6">
                        
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

                        {/* Latency */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#3E3A4B]/50 flex items-center justify-center shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#97CBFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-1">Latency</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-white text-2xl font-bold tracking-tight">{stats.latency.value}</span>
                                    <span className="text-gray-400 text-[10px]">{stats.latency.unit}</span>
                                </div>
                            </div>
                            <div>
                                <span className="border border-[#34D399]/50 text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">
                                    {stats.latency.status}
                                </span>
                            </div>
                        </div>

                        {/* Harvest */}
                        <div className="flex items-center gap-4 border-t border-[#3E3A4B] pt-6 flex-wrap">
                            <div className="w-12 h-12 rounded-full bg-[#3E3A4B]/50 flex items-center justify-center shrink-0">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-1">Harvest Estimate</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-white text-2xl font-bold tracking-tight">{stats.harvest.estimateDays}</span>
                                    <span className="text-gray-400 text-[10px]">{stats.harvest.unit}</span>
                                </div>
                            </div>
                            <span className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mt-4 sm:mt-0">
                                {stats.harvest.dateStr}
                            </span>
                        </div>
                    </div>

                    {/* Power Consumption (Red box) */}
                    <div className="bg-[#2A2732] border border-[#3E3A4B] rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[140px] flex-1">
                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-red-500 rounded-r"></div>
                        <div className="flex justify-between items-start">
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase pl-3">Power Consumption</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                        </div>
                        <div className="pl-3">
                            <div className="flex items-baseline gap-2 mb-3 mt-4">
                                <span className="text-white text-5xl font-bold tracking-tighter">{stats.power.watts}</span>
                                <span className="text-gray-400 font-bold">{stats.power.unit}</span>
                            </div>
                            <div className="h-1.5 bg-[#15121C] rounded-full overflow-hidden flex mt-2">
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${stats.power.usagePercentage}%` }}></div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Dashboard;