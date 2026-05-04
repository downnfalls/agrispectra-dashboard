import React, { useState, useEffect, useMemo } from 'react';
import UserProfile from '../components/UserProfile';
import { API_BASE_URL } from '../../config';

// --- Hardware LED Power Constants (from datasheet) ---
const HW_POWER = {
    white:   { vf: 2.75,  mA: 65,  count: 180 },  
    deepRed: { vf: 2.0,   mA: 700, count: 54 },   
    farRed:  { vf: 2.0,   mA: 350, count: 18 },   
    blue:    { vf: 2.975, mA: 350, count: 36 },   
};
const MAX_WATTS_PER_CHANNEL = {
    white:   (HW_POWER.white.vf   * HW_POWER.white.mA   / 1000) * HW_POWER.white.count,
    deepRed: (HW_POWER.deepRed.vf * HW_POWER.deepRed.mA / 1000) * HW_POWER.deepRed.count,
    farRed:  (HW_POWER.farRed.vf  * HW_POWER.farRed.mA  / 1000) * HW_POWER.farRed.count,
    blue:    (HW_POWER.blue.vf    * HW_POWER.blue.mA    / 1000) * HW_POWER.blue.count,
};

const TOTAL_MAX_WATTS = MAX_WATTS_PER_CHANNEL.white + MAX_WATTS_PER_CHANNEL.deepRed + MAX_WATTS_PER_CHANNEL.farRed + MAX_WATTS_PER_CHANNEL.blue;

function Energy() {
    const [isLoading, setIsLoading] = useState(true);
    const [hardwareStatus, setHardwareStatus] = useState('OFFLINE');
    const [liveData, setLiveData] = useState({
        currentWatts: 0,
        isLive: false,
        intensity: 0,
        ratios: { blue: 25, red: 25, farRed: 25, white: 25 }
    });

    const [recipeInfo, setRecipeInfo] = useState({
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
        recipeName: "Default Lettuce"
    });

    // --- Helper Logic (Same as Dashboard) ---
    const calculateActivePeriod = (timeline) => {
        if (!timeline || timeline.length === 0) return null;
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const sorted = [...timeline].sort((a, b) => {
            const [hA, mA] = a.time.split(':').map(Number);
            const [hB, mB] = b.time.split(':').map(Number);
            return (hA * 60 + mA) - (hB * 60 + mB);
        });
        let active = sorted[sorted.length - 1];
        for (let i = 0; i < sorted.length; i++) {
            const [h, m] = sorted[i].time.split(':').map(Number);
            if (currentMinutes >= (h * 60 + m)) active = sorted[i];
            else break;
        }
        return active;
    };

    useEffect(() => {
        let socket = null;
        const connectWS = () => {
            const wsUrl = API_BASE_URL.replace('http', 'ws') + '/hardware/ws';
            socket = new WebSocket(wsUrl);
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'connection_status') {
                        setHardwareStatus(data.status);
                        return;
                    }

                    // Process payload for power
                    const esp32Payload = data;
                    const savedDeployedProfileIdStr = localStorage.getItem('agrispectra_deployed_profile');
                    const savedProfilesStr = localStorage.getItem('agrispectra_profiles');
                    let currentProfile = null;
                    if (savedDeployedProfileIdStr && savedProfilesStr) {
                        const deployedProfileId = JSON.parse(savedDeployedProfileIdStr);
                        const profiles = JSON.parse(savedProfilesStr);
                        currentProfile = profiles.find(p => p.id === deployedProfileId);
                    }

                    // Calculation logic matching Dashboard.jsx
                    let stageRatios = { blue: 25, red: 25, farRed: 25, white: 25 };
                    let activeIntensity = 0;

                    if (currentProfile?.stages) {
                        setRecipeInfo(prev => ({ ...prev, recipeName: currentProfile.name }));
                        const sMatch = currentProfile.stages.find(s => s.name && s.name.split('\n')[0] === esp32Payload.stage) || currentProfile.stages[0];
                        if (sMatch) {
                            const total = (sMatch.blue || 0) + (sMatch.red || 0) + (sMatch.farRed || 0) + (sMatch.white || 0) || 1;
                            stageRatios = { blue: (sMatch.blue || 0)/total*100, red: (sMatch.red || 0)/total*100, farRed: (sMatch.farRed || 0)/total*100, white: (sMatch.white || 0)/total*100 };
                            const period = calculateActivePeriod(sMatch.timeline);
                            activeIntensity = period ? period.intensity : 0;
                        }
                    }

                    let calculatedWatts = 0;
                    let live = false;

                    // Correctly extract PWM values as numbers
                    const pwmBlue = esp32Payload.blue?.pwm;
                    const pwmRed = esp32Payload.red?.pwm;
                    const pwmFarRed = esp32Payload.farRed?.pwm;
                    const pwmWhite = esp32Payload.white?.pwm;

                    if (pwmBlue !== undefined && pwmBlue !== null) {
                        calculatedWatts = Math.round(
                            (MAX_WATTS_PER_CHANNEL.blue    * (pwmBlue / 100)) +
                            (MAX_WATTS_PER_CHANNEL.deepRed  * ((pwmRed || 0) / 100)) +
                            (MAX_WATTS_PER_CHANNEL.farRed   * ((pwmFarRed || 0) / 100)) +
                            (MAX_WATTS_PER_CHANNEL.white    * ((pwmWhite || 0) / 100))
                        );
                        live = true;
                    } else {
                        calculatedWatts = Math.round(
                            (MAX_WATTS_PER_CHANNEL.blue    * (stageRatios.blue   / 100) +
                             MAX_WATTS_PER_CHANNEL.deepRed  * (stageRatios.red    / 100) +
                             MAX_WATTS_PER_CHANNEL.farRed   * (stageRatios.farRed / 100) +
                             MAX_WATTS_PER_CHANNEL.white    * (stageRatios.white  / 100))
                            * (activeIntensity / 100)
                        );
                    }

                    setLiveData({
                        currentWatts: Number.isNaN(calculatedWatts) ? 0 : calculatedWatts,
                        isLive: live,
                        intensity: activeIntensity,
                        ratios: stageRatios
                    });
                    setIsLoading(false);
                } catch (e) {}
            };
            socket.onclose = () => setTimeout(connectWS, 3000);
            socket.onerror = () => socket.close();
        };
        connectWS();
        return () => { if (socket) socket.close(); };
    }, []);

    // Initial load fallback
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    // --- Mock History Data (Enhanced with live context) ---
    const dailyTotalKwh = useMemo(() => {
        const hoursPassed = new Date().getHours() + new Date().getMinutes() / 60;
        return (liveData.currentWatts * hoursPassed / 1000).toFixed(2);
    }, [liveData.currentWatts]);

    const hourlyConsumption = useMemo(() => {
        return Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            val: i <= new Date().getHours() ? (liveData.currentWatts / TOTAL_MAX_WATTS * 100) : 0
        }));
    }, [liveData.currentWatts]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A]">
                <div className="w-10 h-10 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Connecting to Energy Matrix...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#0A0A0A] min-h-screen flex flex-col p-8 lg:p-12 gap-8 text-white font-sans">
            
            {/* Header */}
            <header className="flex justify-between items-center">
                <div className="flex flex-col">
                    <h1 className="text-white text-3xl font-bold tracking-tight mb-1">Energy Intelligence</h1>
                    <p className="text-[#625D71] text-[10px] font-bold tracking-[0.2em] uppercase">Consumption Summary & Efficiency</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-[#151515] rounded-full px-4 py-2 flex items-center gap-3 border border-[#222]">
                        <div className={`w-2 h-2 rounded-full ${hardwareStatus === 'ONLINE' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-red-500'}`}></div>
                        <span className="text-[#E0E0E0] font-bold text-[10px] tracking-widest uppercase">System {hardwareStatus}</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Date Navigation */}
            <div className="flex items-center gap-3">
                <div className="bg-[#151515] border border-[#222] rounded-xl flex items-center h-12 px-2">
                    <button className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <div className="flex items-center gap-3 px-4">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-white font-bold text-[11px] tracking-[0.1em] uppercase">{recipeInfo.date}</span>
                    </div>
                    <button className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                <button className="bg-[#151515] border border-[#222] rounded-xl h-12 px-6 flex items-center gap-3 hover:bg-[#222] transition">
                    <span className="text-white font-bold text-[11px] tracking-[0.1em] uppercase">Snapshot: Today</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-8">
                
                {/* Power Consumption Chart */}
                <div className="col-span-12 xl:col-span-9 bg-[#111] border border-[#222] rounded-3xl p-10 flex flex-col h-[520px]">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-2">Usage Patterns (24H)</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-5xl font-bold tracking-tight">{liveData.currentWatts}</span>
                                <span className="font-bold text-[11px] tracking-widest uppercase text-[#3B82F6]">Watts Current</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-full px-5 py-2 border border-[#333]">
                            <div className={`w-2 h-2 rounded-full ${liveData.isLive ? 'bg-[#3B82F6] animate-pulse' : 'bg-orange-400'}`}></div>
                            <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">{liveData.isLive ? 'Real-time PWM Mode' : 'Estimated Mode'}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end">
                        <div className="flex items-end justify-between gap-[4px] h-64 border-b border-[#222]/50 pb-2">
                            {hourlyConsumption.map((d, i) => (
                                <div 
                                    key={i} 
                                    style={{ height: `${d.val || 1}%` }} 
                                    className={`flex-1 rounded-t-[4px] transition-all duration-500 hover:opacity-80 ${i <= new Date().getHours() ? 'bg-gradient-to-t from-[#1E40AF] to-[#3B82F6]' : 'bg-[#1A1A1A]'}`}
                                ></div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[#625D71] font-bold text-[10px] tracking-widest uppercase mt-6 px-1">
                            <span>00:00</span>
                            <span>04:00</span>
                            <span>08:00</span>
                            <span>12:00</span>
                            <span>16:00</span>
                            <span>20:00</span>
                            <span>23:59</span>
                        </div>
                    </div>
                </div>

                {/* Quick Summary Sidebar */}
                <div className="col-span-12 xl:col-span-3 flex flex-col gap-8">
                    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 flex flex-col flex-1 justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <div className="w-12 h-12 rounded-full bg-[#3B82F6]/10 flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                            </div>
                        </div>
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Current Draw</h3>
                        <span className="text-white text-6xl font-bold tracking-tighter mb-2">{liveData.currentWatts}W</span>
                        <p className={`text-[11px] font-bold tracking-wide ${liveData.currentWatts > 0 ? 'text-[#34D399]' : 'text-[#625D71]'}`}>
                            ● {liveData.currentWatts > 0 ? 'Active Load' : 'Standby Mode'}
                        </p>
                    </div>

                    <div className="bg-[#111] border border-[#222] rounded-3xl p-8 flex flex-col flex-1 justify-center">
                        <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Daily Total</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-white text-6xl font-bold tracking-tighter">{dailyTotalKwh}</span>
                            <span className="text-[#625D71] font-bold text-xl tracking-tight">kWh</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Row Metrics */}
                <div className="col-span-12 md:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-8">
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Max System Load</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-white text-4xl font-bold tracking-tight">{Math.round(TOTAL_MAX_WATTS)}</span>
                        <span className="text-[#625D71] font-bold text-sm uppercase">Watts</span>
                    </div>
                    <div className="w-full h-1 bg-[#222] rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-1000" style={{ width: `${(liveData.currentWatts / TOTAL_MAX_WATTS * 100)}%` }}></div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-8">
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Forecasted Monthly</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-white text-4xl font-bold tracking-tight">{(dailyTotalKwh * 30).toFixed(1)}</span>
                        <span className="text-[#625D71] font-bold text-sm uppercase">kWh</span>
                    </div>
                    <div className="w-full h-1 bg-[#222] rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-[#34D399] rounded-full" style={{ width: '45%' }}></div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-4 bg-[#111] border border-[#222] rounded-3xl p-8 flex flex-col justify-between">
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-4">Active Profile</h3>
                    <div className="flex justify-between items-center">
                        <span className="text-[#3B82F6] text-2xl font-bold tracking-tight truncate mr-2">{recipeInfo.recipeName}</span>
                        <div className="bg-[#3B82F6]/10 text-[#3B82F6] px-3 py-1 rounded-lg text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">Deployed</div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Energy;
