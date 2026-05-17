import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import UserProfile from '../components/UserProfile';
import { API_BASE_URL } from '../../config';
import { fetchDeployedProfile } from '../utils/profileUtils';

// --- Hardware LED Power Constants (from datasheet) ---
const HW_POWER = {
    white: { vf: 2.75, mA: 65, count: 180 },
    deepRed: { vf: 2.0, mA: 700, count: 54 },
    farRed: { vf: 2.0, mA: 350, count: 18 },
    blue: { vf: 2.975, mA: 350, count: 36 },
};
const MAX_WATTS_PER_CHANNEL = {
    white: (HW_POWER.white.vf * HW_POWER.white.mA / 1000) * HW_POWER.white.count,
    deepRed: (HW_POWER.deepRed.vf * HW_POWER.deepRed.mA / 1000) * HW_POWER.deepRed.count,
    farRed: (HW_POWER.farRed.vf * HW_POWER.farRed.mA / 1000) * HW_POWER.farRed.count,
    blue: (HW_POWER.blue.vf * HW_POWER.blue.mA / 1000) * HW_POWER.blue.count,
};

const TOTAL_MAX_WATTS = MAX_WATTS_PER_CHANNEL.white + MAX_WATTS_PER_CHANNEL.deepRed + MAX_WATTS_PER_CHANNEL.farRed + MAX_WATTS_PER_CHANNEL.blue;

// Helper: get today's date string YYYY-MM-DD
const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function Energy() {
    const [isLoading, setIsLoading] = useState(true);
    const [hardwareStatus, setHardwareStatus] = useState('OFFLINE');
    const dateInputRef = useRef(null);

    // --- Date Navigation ---
    const [selectedDate, setSelectedDate] = useState(getTodayStr);

    const handlePrevDay = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };
    const handleNextDay = () => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };

    const isToday = selectedDate === getTodayStr();

    // --- Live data from WebSocket ---
    const [liveData, setLiveData] = useState({
        currentWatts: 0,
        isLive: false,
        intensity: 0,
        ratios: { blue: 25, red: 25, farRed: 25, white: 25 }
    });

    const [recipeInfo, setRecipeInfo] = useState({
        recipeName: "Default Lettuce"
    });

    // --- DB-sourced data ---
    const [dbHourlyData, setDbHourlyData] = useState(null); // array of 24 { hour, kwh }
    const [dbDailyTotal, setDbDailyTotal] = useState(0);
    const [dbMonthlyTotal, setDbMonthlyTotal] = useState(0);

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

    // --- Fetch daily data from DB ---
    const fetchDailyData = useCallback(async (date) => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/energy/daily?date=${date}&_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDbHourlyData(data.hours);
                setDbDailyTotal(data.dailyTotal);
            }
        } catch (e) {
            console.warn('Failed to fetch daily energy:', e);
        }
    }, []);

    // --- Fetch monthly total from DB ---
    const fetchMonthlyTotal = useCallback(async (date) => {
        const month = date.substring(0, 7); // "2026-05"
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/energy/monthly?month=${month}&_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDbMonthlyTotal(data.monthlyTotal);
            }
        } catch (e) {
            console.warn('Failed to fetch monthly energy:', e);
        }
    }, []);

    // --- Fetch data when date changes ---
    useEffect(() => {
        fetchDailyData(selectedDate);
        fetchMonthlyTotal(selectedDate);
    }, [selectedDate, fetchDailyData, fetchMonthlyTotal]);

    // --- Auto-refresh data from DB every 5 minutes (backend records automatically) ---
    useEffect(() => {
        if (!isToday) return;
        const interval = setInterval(() => {
            fetchDailyData(selectedDate);
            fetchMonthlyTotal(selectedDate);
        }, 5 * 60 * 1000); // every 5 minutes
        return () => clearInterval(interval);
    }, [isToday, selectedDate, fetchDailyData, fetchMonthlyTotal]);

    // --- WebSocket for live power data (no dependency on recording) ---
    useEffect(() => {
        let socket = null;
        let isMounted = true;
        let cachedProfile = null;

        // Fetch deployed profile from server
        const loadDeployedProfile = async () => {
            cachedProfile = await fetchDeployedProfile();
        };

        // Refresh deployed profile every 30 seconds
        const profileInterval = setInterval(loadDeployedProfile, 30000);

        const connectWS = async () => {
            await loadDeployedProfile();
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

                    // Use cached deployed profile (fetched at connect time)
                    let currentProfile = cachedProfile;

                    // Calculation logic matching Dashboard.jsx
                    let stageRatios = { blue: 25, red: 25, farRed: 25, white: 25 };
                    let activeIntensity = 0;

                    if (currentProfile?.stages) {
                        setRecipeInfo(prev => ({ ...prev, recipeName: currentProfile.name }));
                        const sMatch = currentProfile.stages.find(s => s.name && s.name.split('\n')[0] === esp32Payload.stage) || currentProfile.stages[0];
                        if (sMatch) {
                            const total = (sMatch.blue || 0) + (sMatch.red || 0) + (sMatch.farRed || 0) + (sMatch.white || 0) || 1;
                            stageRatios = { blue: (sMatch.blue || 0) / total * 100, red: (sMatch.red || 0) / total * 100, farRed: (sMatch.farRed || 0) / total * 100, white: (sMatch.white || 0) / total * 100 };
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
                            (MAX_WATTS_PER_CHANNEL.blue * (pwmBlue / 100)) +
                            (MAX_WATTS_PER_CHANNEL.deepRed * ((pwmRed || 0) / 100)) +
                            (MAX_WATTS_PER_CHANNEL.farRed * ((pwmFarRed || 0) / 100)) +
                            (MAX_WATTS_PER_CHANNEL.white * ((pwmWhite || 0) / 100))
                        );
                        live = true;
                    } else {
                        calculatedWatts = Math.round(
                            (MAX_WATTS_PER_CHANNEL.blue * (stageRatios.blue / 100) +
                                MAX_WATTS_PER_CHANNEL.deepRed * (stageRatios.red / 100) +
                                MAX_WATTS_PER_CHANNEL.farRed * (stageRatios.farRed / 100) +
                                MAX_WATTS_PER_CHANNEL.white * (stageRatios.white / 100))
                            * (activeIntensity / 100)
                        );
                    }

                    const finalWatts = Number.isNaN(calculatedWatts) ? 0 : calculatedWatts;

                    // Update ref for recording (kept for display)
                    // liveWattsRef removed — backend records energy now

                    setLiveData({
                        currentWatts: finalWatts,
                        isLive: live,
                        intensity: activeIntensity,
                        ratios: stageRatios
                    });
                    setIsLoading(false);
                } catch (e) { }
            };
            socket.onclose = () => {
                if (isMounted) setTimeout(connectWS, 3000);
            };
            socket.onerror = () => socket.close();
        };
        connectWS();
        return () => {
            isMounted = false;
            clearInterval(profileInterval);
            if (socket) socket.close();
        };
    }, []); // No dependencies — WebSocket connects once

    // Initial load fallback
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    // --- Compute display data ---
    // Always use DB-recorded values. Past hours keep their recorded values.
    // Current hour shows DB accumulated value (updated every 5 min).
    const hourlyKwh = useMemo(() => {
        if (dbHourlyData) {
            // Use DB data as-is for all hours (past hours won't change)
            return dbHourlyData.map((entry, i) => ({ hour: i, kwh: entry.kwh }));
        }
        // Fallback when no DB data yet: empty chart
        return Array.from({ length: 24 }, (_, i) => ({ hour: i, kwh: 0 }));
    }, [dbHourlyData]);

    const dailyTotalKwh = useMemo(() => {
        if (dbDailyTotal > 0) return dbDailyTotal.toFixed(4);
        return hourlyKwh.reduce((sum, h) => sum + h.kwh, 0).toFixed(4);
    }, [dbDailyTotal, hourlyKwh]);

    const maxHourlyKwh = useMemo(() => {
        const max = Math.max(...hourlyKwh.map(h => h.kwh));
        return max > 0 ? max : 1;
    }, [hourlyKwh]);

    const monthlyTotalKwh = useMemo(() => {
        return dbMonthlyTotal > 0 ? dbMonthlyTotal.toFixed(4) : '0.0000';
    }, [dbMonthlyTotal]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A]">
                <div className="w-10 h-10 border-4 border-[#3B82F6]/30 border-t-[#3B82F6] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Connecting to Energy Matrix...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#0A0A0A] min-h-screen flex flex-col p-4 md:p-8 lg:p-12 gap-4 md:gap-8 text-white font-sans">

            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex flex-col">
                    <h1 className="text-white text-xl sm:text-3xl font-bold tracking-tight mb-1">Energy Intelligence</h1>
                    <p className="text-[#625D71] text-[10px] font-bold tracking-[0.2em] uppercase">Consumption Summary & Efficiency</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="bg-[#151515] rounded-full px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 border border-[#222]">
                        <div className={`w-2 h-2 rounded-full ${hardwareStatus === 'ONLINE' ? 'bg-[#34D399] shadow-[0_0_8px_#34D399]' : 'bg-red-500'}`}></div>
                        <span className="text-[#E0E0E0] font-bold text-[10px] tracking-widest uppercase">System {hardwareStatus}</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Date Navigation */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="bg-[#151515] border border-[#222] rounded-xl flex items-center h-12 px-2">
                    <button onClick={handlePrevDay} className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button
                        onClick={() => dateInputRef.current?.showPicker()}
                        className="flex items-center gap-3 px-4 cursor-pointer hover:bg-[#222] rounded-lg transition py-1"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span className="text-white font-bold text-[11px] tracking-[0.1em] uppercase">
                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
                        </span>
                    </button>
                    <input
                        ref={dateInputRef}
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    />
                    <button onClick={handleNextDay} className="p-2 text-[#625D71] hover:text-white transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>
                {!isToday && (
                    <button
                        onClick={() => setSelectedDate(getTodayStr())}
                        className="bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-xl h-12 px-6 flex items-center gap-2 hover:bg-[#3B82F6]/20 transition"
                    >
                        <span className="text-[#3B82F6] font-bold text-[11px] tracking-[0.1em] uppercase">← Back to Today</span>
                    </button>
                )}
                {isToday && (
                    <div className="flex items-center gap-4 h-12 px-4 bg-[#111] border border-[#222] rounded-xl">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse"></div>
                            <span className="text-[#34D399] font-bold text-[10px] tracking-widest uppercase">Server Auto-Recording</span>
                        </div>
                        <div className="w-px h-6 bg-[#333]"></div>
                        <div className="flex flex-col">
                            <span className="text-[#625D71] text-[8px] font-bold uppercase tracking-widest">Interval</span>
                            <span className="text-white text-[10px] font-mono">Every 5 min</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-12 gap-4 md:gap-8">

                {/* Power Consumption Chart */}
                <div className="col-span-12 xl:col-span-9 bg-[#111] border border-[#222] rounded-2xl md:rounded-3xl p-4 md:p-10 flex flex-col h-[300px] md:h-[400px] xl:h-[520px]">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-2">Hourly Consumption (kWh per Hour)</h3>
                            <div className="flex items-baseline gap-2">
                                {isToday ? (
                                    <>
                                        <span className="text-white text-5xl font-bold tracking-tight">{liveData.currentWatts}</span>
                                        <span className="font-bold text-[11px] tracking-widest uppercase text-[#3B82F6]">Watts Current</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-white text-5xl font-bold tracking-tight">{dailyTotalKwh}</span>
                                        <span className="font-bold text-[11px] tracking-widest uppercase text-[#3B82F6]">kWh Total</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-[#1A1A1A] rounded-full px-5 py-2 border border-[#333]">
                            <div className={`w-2 h-2 rounded-full ${isToday && liveData.isLive ? 'bg-[#3B82F6] animate-pulse' : isToday ? 'bg-orange-400' : 'bg-[#625D71]'}`}></div>
                            <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">
                                {isToday ? (liveData.isLive ? 'Real-time PWM Mode' : 'Estimated Mode') : 'Historical Data'}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end overflow-x-auto">
                        <div className="flex items-end gap-[2px] sm:gap-[3px] lg:gap-[4px] h-64 border-b border-[#222]/50 pb-1 min-w-0">
                            {hourlyKwh.map((d, i) => {
                                const barPct = maxHourlyKwh > 0 ? (d.kwh / maxHourlyKwh) * 100 : 0;
                                return (
                                    <div
                                        key={i}
                                        className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0"
                                    >
                                        {/* Tooltip on hover */}
                                        <div className="absolute -top-8 bg-[#222] text-white text-[8px] sm:text-[9px] font-mono px-1.5 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                            {d.kwh.toFixed(4)} kWh
                                        </div>
                                        {/* Bar */}
                                        <div
                                            style={{ height: `${barPct || 1}%` }}
                                            className={`w-full rounded-t-[3px] transition-all duration-500 group-hover:opacity-80 ${d.kwh > 0 ? 'bg-gradient-to-t from-[#1E40AF] to-[#3B82F6]' : 'bg-[#1A1A1A]'}`}
                                        ></div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Hour labels — one per bar */}
                        <div className="flex gap-[2px] sm:gap-[3px] lg:gap-[4px] mt-2">
                            {hourlyKwh.map((_, i) => (
                                <div key={i} className="flex-1 text-center text-[#625D71] font-bold text-[7px] sm:text-[8px] md:text-[9px] lg:text-[10px] font-mono leading-tight min-w-0 truncate">
                                    {String(i).padStart(2, '0')}
                                </div>
                            ))}
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
                        <span className="text-white text-6xl font-bold tracking-tighter mb-2">{isToday ? `${liveData.currentWatts}W` : '--'}</span>
                        <p className={`text-[11px] font-bold tracking-wide ${isToday && liveData.currentWatts > 0 ? 'text-[#34D399]' : 'text-[#625D71]'}`}>
                            ● {isToday ? (liveData.currentWatts > 0 ? 'Active Load' : 'Standby Mode') : 'Viewing History'}
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
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Monthly Total</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-white text-4xl font-bold tracking-tight">{monthlyTotalKwh}</span>
                        <span className="text-[#625D71] font-bold text-sm uppercase">kWh</span>
                    </div>
                    <div className="w-full h-1 bg-[#222] rounded-full mt-6 overflow-hidden">
                        <div className="h-full bg-[#34D399] rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (parseFloat(monthlyTotalKwh) / (parseFloat(dailyTotalKwh) * 30 || 1)) * 100)}%` }}></div>
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
