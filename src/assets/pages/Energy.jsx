import React, { useState, useEffect } from 'react';
import UserProfile from '../components/UserProfile';

function Energy() {
    // --------------------------------------------------------
    // MOCK DATA PREPARATION (Ready for Backend Integration)
    // --------------------------------------------------------
    const [energyData, setEnergyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // จำลองการดึงข้อมูลจาก Backend API (ใช้ setTimeout แทน axios.get)
        const fetchEnergyData = async () => {
            setIsLoading(true);
            try {
                // สมมติว่านี่คือ Response จาก API หรือฐานข้อมูลของคุณ
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

                // หน่วงเวลา 0.6 วิเพื่อแสดง Effect โหลดข้อมูล (สมจริง)
                setTimeout(() => {
                    setEnergyData(mockApiResponse);
                    setIsLoading(false);
                }, 600);

            } catch (error) {
                console.error("Failed to fetch energy data", error);
                setIsLoading(false);
            }
        };

        fetchEnergyData();
    }, []);

    // Loader ป้องกันหน้าพังขณะรอ Context จาก Backend
    if (isLoading || !energyData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-xs uppercase">Connecting to Database...</div>
            </div>
        );
    }

    // ดึงค่ามาใช้จาก State
    const { overview, pricing, hourlyConsumption } = energyData;

    return (
        <div className="p-8 lg:p-12 xl:p-16 max-w-[1700px] mx-auto flex flex-col gap-6">
            
            {/* Top Bar Navigation */}
            <header className="flex justify-between items-center mb-2">
                <h1 className="text-[#CBA6F7] text-3xl font-bold tracking-wide border-b border-transparent">JANGKOPF</h1>
                <div className="flex items-center gap-4">
                    <div className="bg-[#15121C] rounded-full px-4 py-2 flex items-center gap-3 border border-[#2A2732]">
                        <div className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]"></div>
                        <span className="text-white font-bold text-[10px] tracking-widest uppercase">ESP32 CAM ONLINE</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Date Filters */}
            <div className="flex items-center gap-4 border-b border-[#2A2732] pb-6 mb-2">
                <div className="flex items-center bg-[#15121C] border border-[#2A2732] rounded-full px-2 py-1">
                    <button className="p-2 text-[#625D71] hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <div className="flex items-center gap-3 px-4">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#97CBFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-white font-bold text-[11px] tracking-widest uppercase">{energyData.metadata.date}</span>
                    </div>
                    <button className="p-2 text-[#625D71] hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                <div className="flex items-center bg-[#15121C] border border-[#2A2732] rounded-full px-6 py-2.5 gap-3 cursor-pointer hover:bg-[#2A2732]/50 transition-colors">
                    <span className="text-[#625D71] font-bold text-[11px] tracking-widest uppercase">Today</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#625D71" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
            </div>

            {/* Layout หลัก: Graph + Cost Breakdown */}
            <div className="grid grid-cols-12 gap-8">
                
                {/* 1. Bar Chart: Power Consumption */}
                <div className="col-span-12 xl:col-span-8 bg-[#15121C] border border-[#2A2732] rounded-3xl p-10 flex flex-col min-h-[460px]">
                    <div className="flex justify-between items-start mb-12">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-3">Power Consumption (24H)</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-5xl font-bold tracking-tight">{overview.avgKw}</span>
                                <span className="text-[#625D71] border border-[#2A2732] px-2 py-0.5 rounded text-[10px] uppercase font-bold">kW Avg</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex items-center gap-2 border border-[#2A2732] rounded-full px-4 py-1.5 bg-[#1A151E]">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6]"></div>
                                <span className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">OFF-PEAK</span>
                            </div>
                            <div className="flex items-center gap-2 border border-[#2A2732] rounded-full px-4 py-1.5 bg-[#1A151E]">
                                <div className="w-2 h-2 rounded-full bg-[#F43F5E]"></div>
                                <span className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">ON-PEAK</span>
                            </div>
                        </div>
                    </div>

                    {/* กล่องจัดวางกราฟแท่งแบบไดนามิก รองรับ Data จาก State Array */}
                    <div className="flex-1 flex flex-col justify-end">
                        <div className="w-full flex items-end justify-between gap-[2px] h-56 border-b border-[#2A2732] pb-1">
                            {hourlyConsumption.map((data, i) => (
                                <div 
                                    key={i} 
                                    className={`flex-1 w-full transition-all duration-300 rounded-t-[2px] opacity-90 hover:opacity-100 cursor-pointer 
                                    ${data.peak ? 'bg-[#F43F5E]' : 'bg-[#3B82F6]'}
                                    `} 
                                    style={{ height: `${data.val}%` }}
                                ></div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[#625D71] font-bold text-[10px] tracking-widest uppercase mt-5 px-1">
                            <span>00:00</span>
                            <span>06:00</span>
                            <span>12:00</span>
                            <span>18:00</span>
                            <span>23:59</span>
                        </div>
                    </div>
                </div>

                {/* 2. Side Panel: Cost Breakdown */}
                <div className="col-span-12 xl:col-span-4 bg-[#15121C] border border-[#2A2732] rounded-3xl p-10 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Cost Breakdown</h3>
                        
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between border border-[#2A2732] rounded-[1.25rem] p-6 bg-[#1A151E]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border border-[#F43F5E]/20 bg-[#F43F5E]/10 flex items-center justify-center">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">ON-PEAK RATE</p>
                                    </div>
                                </div>
                                <span className="text-white text-sm font-mono tracking-wider">{pricing.onPeakRate.toFixed(2)}/unit</span>
                            </div>
                            
                            <div className="flex items-center justify-between border border-[#2A2732] rounded-[1.25rem] p-6 bg-[#1A151E]">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 flex items-center justify-center">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">OFF-PEAK RATE</p>
                                    </div>
                                </div>
                                <span className="text-white text-sm font-mono tracking-wider">{pricing.offPeakRate.toFixed(2)}/unit</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-[#2A2732]">
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-4">Today's Estimated Cost</h3>
                        <div className="flex items-end justify-between w-full">
                            <span className="text-[#3B82F6] text-6xl font-bold tracking-tighter">{pricing.todayEstimate.toFixed(2)}</span>
                            <LineChartIcon />
                        </div>
                        <p className="text-[#625D71] text-[11px] font-medium font-serif italic mt-4">+{pricing.vsSeasonalPct}% from seasonal baseline</p>
                    </div>
                </div>
            </div>

            {/* Layout แถวล่าง: 4 Metrics Cards */}
            <div className="grid grid-cols-12 gap-8 pb-32">
                
                {/* 3.1 CURRENT DRAW */}
                <div className="col-span-12 md:col-span-6 xl:col-span-3 bg-[#1A151E] border border-[#2A2732] rounded-3xl p-8 flex flex-col relative overflow-hidden">
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6 z-10">Current Draw</h3>
                    <div className="flex-1 flex flex-col items-center justify-center relative my-2 z-10 w-full">
                        {/* แก้ไข viewBox และปรับ svg ให้ขยายได้ถูกต้อง 100% ตรงตามดีไซน์ล่าสุด */}
                        <div className="relative flex items-center justify-center w-36 h-36">
                            <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" viewBox="0 0 128 128" preserveAspectRatio="xMidYMid meet">
                                {/* Base track */}
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#2A2732" strokeWidth="8" />
                                {/* Red active track (จำลองใช้ Dasharray) */}
                                <circle cx="64" cy="64" r="56" fill="transparent" stroke="#F43F5E" strokeWidth="8" strokeLinecap="round" strokeDasharray="351.8" strokeDashoffset="140" />
                            </svg>
                            <div className="flex flex-col items-center justify-center translate-y-1">
                                <span className="text-white text-4xl font-bold tracking-tight">{overview.currentDrawWatts}</span>
                                <span className="text-[#F43F5E] font-bold text-[9px] tracking-widest uppercase mt-1">WATTS</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between w-full text-[#625D71] font-bold text-[9px] tracking-widest mt-6 z-10">
                        <span>0W</span>
                        <span>1000W</span>
                    </div>
                </div>

                {/* 3.2 DAILY TOTAL */}
                <div className="col-span-12 md:col-span-6 xl:col-span-3 bg-[#1A151E] border border-[#2A2732] rounded-3xl p-8 flex flex-col justify-between">
                    <div>
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-8">Daily Total</h3>
                        <div className="flex items-center gap-6 mb-8 mt-4">
                            <div className="w-14 h-14 rounded-full bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            </div>
                            <div>
                                <div className="text-white text-4xl font-bold mb-1 tracking-tight">{overview.dailyKwh}</div>
                                <div className="text-[#625D71] font-bold text-[8px] tracking-[0.1em] uppercase">KWH CONSUMED</div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 mt-10">
                        <div className="h-1.5 bg-[#2A2732] rounded-full overflow-hidden">
                            <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${100 - overview.dailyQuotaRemainingPct}%` }}></div>
                        </div>
                        <p className="text-[#625D71] text-[10px] font-medium tracking-wide">{overview.dailyQuotaRemainingPct}% of daily quota remaining</p>
                    </div>
                </div>

                {/* 3.3 DLI EFFICIENCY */}
                <div className="col-span-12 md:col-span-6 xl:col-span-3 bg-[#1A151E] border border-[#2A2732] rounded-3xl p-8 relative flex flex-col justify-between">
                    <svg className="absolute top-8 right-8 opacity-20" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">DLI Efficiency</h3>
                    
                    <div className="mt-4">
                        <div className="text-[#3B82F6] text-5xl font-mono tracking-tighter mb-3 drop-shadow-[0_0_12px_rgba(59,130,246,0.2)]">{overview.dliRatio}</div>
                        <div className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase">LIGHT : COST RATIO</div>
                    </div>

                    <div className="flex items-center gap-4 mt-8">
                        <span className="bg-[#3B82F6] text-white px-4 py-2 rounded-full font-bold text-[9px] tracking-wider uppercase drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">
                            {overview.dliStatus}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[#625D71] text-[9px] uppercase tracking-widest mb-1">Recipe:</span>
                            <span className="text-white text-[11px] font-bold leading-none">{energyData.metadata.recipe}</span>
                        </div>
                    </div>
                </div>

                {/* 3.4 MONTHLY FORECAST */}
                <div className="col-span-12 md:col-span-6 xl:col-span-3 rounded-3xl p-8 flex flex-col justify-between bg-gradient-to-br from-[#818CF8] to-[#4F46E5] relative overflow-hidden shadow-[0_10px_30px_rgba(79,70,229,0.2)]">
                    <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-[#1A151E]/20 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <div className="relative z-10 w-full h-full flex flex-col">
                        <h3 className="text-white/80 font-bold text-[10px] tracking-widest uppercase mb-8">Monthly Forecast</h3>
                        <div className="flex flex-col flex-1 justify-center mt-2">
                            <div className="text-white text-[3.5rem] leading-[1] font-mono tracking-tighter mb-5">{overview.monthlyForecastThb.toFixed(2)}</div>
                            <div className="text-white/80 font-bold text-[9px] tracking-widest uppercase mt-auto">BASED ON RECIPE RUNTIME</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ปุ่ม Export ฏ้านขวาล่าง */}
            <div className="fixed bottom-10 right-14 z-50">
                <button className="bg-[#2A2732] hover:bg-[#3E3A4B] border border-[#3E3A4B] text-white px-6 py-4 rounded-xl flex items-center gap-3 font-bold text-[10px] tracking-widest uppercase transition-all shadow-2xl hover:scale-105 active:scale-95">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export Report
                </button>
            </div>
        </div>
    );
}

// คอมโพเนนต์ลูก: ไอค่อนเส้นกราฟ 
const LineChartIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_6px_rgba(59,130,246,0.6)]">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
        <polyline points="16 7 22 7 22 13"></polyline>
    </svg>
)

export default Energy;
