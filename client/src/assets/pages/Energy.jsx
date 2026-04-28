import React, { useState, useEffect } from 'react';
import UserProfile from '../components/UserProfile';

function Energy() {
    // --------------------------------------------------------
    // MOCK DATA PREPARATION (Ready for Backend Integration)
    // --------------------------------------------------------
    const [energyData, setEnergyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- WebSocket Hardware Status ---
    const [hardwareStatus, setHardwareStatus] = useState('OFFLINE');
    useEffect(() => {
        let socket = null;
        const connectWS = () => {
            const wsUrl = 'ws://localhost:8080/hardware/ws'; // Adjust if using API_BASE_URL
            socket = new WebSocket(wsUrl);
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'connection_status') {
                        setHardwareStatus(data.status);
                    }
                } catch (e) {}
            };
            socket.onclose = () => setTimeout(connectWS, 3000);
            socket.onerror = () => socket.close();
        };
        connectWS();
        return () => { if (socket) socket.close(); };
    }, []);

    useEffect(() => {
        // จำลองการดึงข้อมูลจาก Backend API
        const fetchEnergyData = async () => {
            setIsLoading(true);
            try {
                // ข้อมูล Mock ให้ตรงตาม Screenshot ที่ลูกค้าส่งมา
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
                    // ข้อมูลกราฟ 24 ชั่วโมง (ความสูง % และสถานะ Peak/Off-peak)
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
                    setEnergyData(mockApiResponse);
                    setIsLoading(false);
                }, 500);

            } catch (error) {
                console.error("Failed to fetch energy data", error);
                setIsLoading(false);
            }
        };

        fetchEnergyData();
    }, []);

    if (isLoading || !energyData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A]">
                <div className="w-10 h-10 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Loading Energy Matrix...</div>
            </div>
        );
    }

    const { overview, pricing, hourlyConsumption, metadata } = energyData;

    return (
        <div className="bg-[#0A0A0A] min-h-screen flex flex-col p-8 lg:p-12 gap-8 text-white font-sans">
            
            {/* 1. Header (JANGKOPF + Status) */}
            <header className="flex justify-between items-center">
                <h1 className="text-[#CBA6F7] text-3xl font-bold tracking-tight">JANGKOPF</h1>
                <div className="flex items-center gap-4">
                    <div className="bg-[#151515] rounded-full px-4 py-2 flex items-center gap-3 border border-[#222]">
                        <div className={`w-2 h-2 rounded-full ${hardwareStatus === 'ONLINE' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-red-500'}`}></div>
                        <span className="text-[#E0E0E0] font-bold text-[10px] tracking-widest uppercase">ESP32 CAM {hardwareStatus}</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* 2. Date Navigation */}
            <div className="flex items-center gap-3">
                <div className="bg-[#151515] border border-[#222] rounded-xl flex items-center h-12 px-2">
                    <button className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <div className="flex items-center gap-3 px-4">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-white font-bold text-[11px] tracking-[0.1em] uppercase">{metadata.date}</span>
                    </div>
                    <button className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                <button className="bg-[#151515] border border-[#222] rounded-xl h-12 px-6 flex items-center gap-3 hover:bg-[#222] transition">
                    <span className="text-white font-bold text-[11px] tracking-[0.1em] uppercase">Today</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#625D71" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
            </div>

            {/* 3. Main Content Grid */}
            <div className="grid grid-cols-12 gap-8">
                
                {/* 3.1 Power Consumption Chart (Column 8) */}
                <div className="col-span-12 xl:col-span-8 bg-[#111] border border-[#222] rounded-3xl p-10 flex flex-col h-[520px]">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-2">Power Consumption (24H)</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-5xl font-bold tracking-tight">{overview.avgKw}</span>
                                <span className="text-[#3B82F6] font-bold text-[11px] tracking-widest uppercase">kW Avg</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-full px-4 py-1.5 border border-[#333]">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6]"></div>
                                <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">OFF-PEAK</span>
                            </div>
                            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-full px-4 py-1.5 border border-[#333]">
                                <div className="w-2 h-2 rounded-full bg-[#F43F5E]"></div>
                                <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">ON-PEAK</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end">
                        <div className="flex items-end justify-between gap-[2px] h-64 border-b border-[#222]/50 pb-2">
                            {hourlyConsumption.map((d, i) => (
                                <div 
                                    key={i} 
                                    style={{ height: `${d.val}%` }} 
                                    className={`flex-1 rounded-t-[3px] transition-all duration-500 hover:opacity-80 
                                    ${d.peak ? 'bg-gradient-to-t from-[#F43F5E] to-[#FB7185]' : 'bg-gradient-to-t from-[#3B82F6] to-[#60A5FA]'}`}
                                ></div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[#625D71] font-bold text-[10px] tracking-widest uppercase mt-6">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:59</span>
                        </div>
                    </div>
                </div>

                {/* 3.2 Cost Breakdown Panel (Column 4) */}
                <div className="col-span-12 xl:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-10 flex flex-col justify-between h-[520px]">
                    <div>
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-10">Cost Breakdown</h3>
                        <div className="space-y-6">
                            <div className="bg-[#1A1A1A] border border-[#222] rounded-[1.2rem] p-6 flex justify-between items-center transition hover:border-[#F43F5E]/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border border-[#F43F5E]/20 bg-[#F43F5E]/10 flex items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <span className="text-[#E0E0E0] font-bold text-[10px] tracking-widest uppercase">ON-PEAK RATE</span>
                                </div>
                                <span className="text-white text-lg font-mono tracking-tight font-bold">{pricing.onPeakRate.toFixed(2)}/unit</span>
                            </div>
                            <div className="bg-[#1A1A1A] border border-[#222] rounded-[1.2rem] p-6 flex justify-between items-center transition hover:border-[#3B82F6]/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 flex items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                    </div>
                                    <span className="text-[#E0E0E0] font-bold text-[10px] tracking-widest uppercase">OFF-PEAK RATE</span>
                                </div>
                                <span className="text-white text-lg font-mono tracking-tight font-bold">{pricing.offPeakRate.toFixed(2)}/unit</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-[#333]">
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-4">Today's Estimated Cost</h3>
                        <div className="flex justify-between items-end">
                            <span className="text-[#3B82F6] text-7xl font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]">{pricing.todayEstimate.toFixed(2)}</span>
                            <div className="mb-4">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_8px_#3B82F6]">
                                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                                    <polyline points="16 7 22 7 22 13"></polyline>
                                </svg>
                            </div>
                        </div>
                        <p className="text-[#625D71] text-[11px] font-medium tracking-tight mt-4 italic font-serif">+{pricing.vsSeasonalPct}% from seasonal baseline</p>
                    </div>
                </div>

                {/* 3.3 Bottom metrics cards */}
                {/* CURRENT DRAW */}
                <div className="col-span-12 md:col-span-6 xl:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-8 flex flex-col items-center">
                    <h3 className="w-full text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-8">Current Draw</h3>
                    <div className="relative w-48 h-48 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]" viewBox="0 0 128 128">
                            <circle cx="64" cy="64" r="56" fill="transparent" stroke="#222" strokeWidth="8" />
                            <circle 
                                cx="64" cy="64" r="56" fill="transparent" stroke="#3B82F6" strokeWidth="8" 
                                strokeLinecap="round" strokeDasharray="351.8" 
                                strokeDashoffset={351.8 * (1 - overview.currentDrawWatts / 1000)} 
                            />
                        </svg>
                        <div className="flex flex-col items-center">
                            <span className="text-white text-5xl font-bold tracking-tighter">{overview.currentDrawWatts}W</span>
                        </div>
                    </div>
                    <div className="w-full flex justify-between text-[#625D71] font-bold text-[10px] tracking-widest mt-8">
                        <span>0W</span>
                        <span>1000W</span>
                    </div>
                </div>

                {/* DAILY TOTAL */}
                <div className="col-span-12 md:col-span-6 xl:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-10 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-8">Daily Total</h3>
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            </div>
                            <div>
                                <span className="text-white text-4xl font-bold tracking-tight">{overview.dailyKwh}</span>
                                <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">KWH CONSUMED</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-12">
                        <div className="h-2 bg-[#222] rounded-full overflow-hidden mb-4">
                            <div className="h-full bg-[#3B82F6] rounded-full shadow-[0_0_10px_#3B82F6]" style={{ width: `${100 - overview.dailyQuotaRemainingPct}%` }}></div>
                        </div>
                        <p className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase">{overview.dailyQuotaRemainingPct}% OF DAILY QUOTA REMAINING</p>
                    </div>
                </div>

                {/* DLI EFFICIENCY */}
                <div className="col-span-12 md:col-span-12 xl:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-10 flex flex-col justify-between relative overflow-hidden">
                    <svg className="absolute top-10 right-10 opacity-10" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-8">DLI Efficiency</h3>
                    
                    <div>
                        <span className="text-[#3B82F6] text-6xl font-mono font-bold tracking-tighter drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">{overview.dliRatio}</span>
                        <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mt-4">LIGHT : COST RATIO</p>
                    </div>

                    <div className="flex items-center gap-4 mt-10">
                        <span className="bg-[#3B82F6] text-white px-5 py-2 rounded-full font-bold text-[10px] tracking-widest uppercase shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                            {overview.dliStatus}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[#625D71] text-[9px] tracking-widest uppercase mb-1">Recipe:</span>
                            <span className="text-white text-xs font-bold uppercase tracking-tight">{metadata.recipe}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* 4. Footer Export Button */}
            <div className="flex justify-end mt-4 pb-12">
                <button className="bg-[#1A1A1A] border border-[#333] hover:bg-[#222] text-white px-8 py-5 rounded-2xl flex items-center gap-4 font-bold text-[11px] tracking-[0.2em] uppercase transition-all shadow-xl hover:scale-[1.02] active:scale-95">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export Report
                </button>
            </div>

        </div>
    );
}

export default Energy;
