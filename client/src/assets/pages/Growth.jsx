import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import UserProfile from '../components/UserProfile';
import { API_BASE_URL } from '../../config';

// Helper: today string YYYY-MM-DD
const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Helper: format date string to short display
const formatDateShort = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};

function Growth() {
    const [isLoading, setIsLoading] = useState(true);
    const [growthData, setGrowthData] = useState([]);
    const [latestScan, setLatestScan] = useState(null);
    const [dateRange, setDateRange] = useState(30); // จำนวนวันที่จะแสดง
    const [hoveredPoint, setHoveredPoint] = useState(null);
    const [activeChart, setActiveChart] = useState(null); // 'leaf' or 'harvest'
    const leafChartRef = useRef(null);
    const harvestChartRef = useRef(null);

    // --- Fetch growth data ---
    const fetchGrowthData = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            const end = getTodayStr();
            const d = new Date();
            d.setDate(d.getDate() - dateRange);
            const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const res = await fetch(`${API_BASE_URL}/api/growth/daily?start=${start}&end=${end}&_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const result = await res.json();
                setGrowthData(result.data || []);
            }
        } catch (e) {
            console.warn('Failed to fetch growth data:', e);
        }
    }, [dateRange]);

    const fetchLatestScan = useCallback(async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/growth/latest?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLatestScan(data);
            }
        } catch (e) {
            console.warn('Failed to fetch latest scan:', e);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchGrowthData(), fetchLatestScan()]).then(() => setIsLoading(false));
    }, [fetchGrowthData, fetchLatestScan]);

    // Auto-refresh every 2 minutes
    useEffect(() => {
        const interval = setInterval(() => {
            fetchGrowthData();
            fetchLatestScan();
        }, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchGrowthData, fetchLatestScan]);

    // --- Computed values ---
    const maxLeafCount = useMemo(() => {
        if (!growthData.length) return 10;
        const max = Math.max(...growthData.map(d => d.avg_leaf_per_plant || 0));
        return max > 0 ? Math.ceil(max * 1.2) : 10;
    }, [growthData]);

    const avgLeafOverall = useMemo(() => {
        if (!growthData.length) return 0;
        const sum = growthData.reduce((acc, d) => acc + (d.avg_leaf_per_plant || 0), 0);
        return (sum / growthData.length).toFixed(1);
    }, [growthData]);

    const avgHarvestOverall = useMemo(() => {
        if (!growthData.length) return 0;
        const sum = growthData.reduce((acc, d) => acc + (d.avg_harvest_readiness || 0), 0);
        return (sum / growthData.length).toFixed(1);
    }, [growthData]);

    const totalScans = useMemo(() => {
        if (!growthData.length) return 0;
        return growthData.reduce((acc, d) => acc + (d.scan_count || 0), 0);
    }, [growthData]);

    // --- SVG Chart rendering ---
    const renderLineChart = useCallback((data, dataKey, color, gradientId, maxVal, unit, chartType) => {
        if (!data.length) {
            return (
                <div className="flex-1 flex items-center justify-center text-[#625D71] text-sm">
                    <div className="text-center">
                        <svg className="mx-auto mb-3 opacity-40" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                        </svg>
                        <p className="font-bold text-[10px] tracking-widest uppercase">No growth data yet</p>
                        <p className="text-[9px] mt-1 opacity-60">Upload images to start tracking</p>
                    </div>
                </div>
            );
        }

        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = 800;
        const height = 280;
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const points = data.map((d, i) => ({
            x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
            y: padding.top + chartH - ((d[dataKey] || 0) / maxVal) * chartH,
            value: d[dataKey] || 0,
            date: d.date,
            scans: d.scan_count || 0,
        }));

        const pathD = points.map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`;
            const prev = points[i - 1];
            const cpx1 = prev.x + (p.x - prev.x) * 0.4;
            const cpx2 = p.x - (p.x - prev.x) * 0.4;
            return `C ${cpx1} ${prev.y}, ${cpx2} ${p.y}, ${p.x} ${p.y}`;
        }).join(' ');

        const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

        // Y-axis gridlines
        const yGridCount = 5;
        const yGridLines = Array.from({ length: yGridCount + 1 }, (_, i) => {
            const val = (maxVal / yGridCount) * i;
            const y = padding.top + chartH - (val / maxVal) * chartH;
            return { val, y };
        });

        return (
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
                onMouseLeave={() => setHoveredPoint(null)}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                    <filter id={`glow-${gradientId}`}>
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Y-axis gridlines */}
                {yGridLines.map((g, i) => (
                    <g key={i}>
                        <line x1={padding.left} y1={g.y} x2={width - padding.right} y2={g.y} stroke="#222" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "4 4"} />
                        <text x={padding.left - 8} y={g.y + 4} textAnchor="end" fill="#625D71" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            {unit === '%' ? `${g.val.toFixed(0)}%` : g.val.toFixed(1)}
                        </text>
                    </g>
                ))}

                {/* Area fill */}
                <path d={areaD} fill={`url(#${gradientId})`} />

                {/* Main line */}
                <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#glow-${gradientId})`} />

                {/* Data points & X-axis labels */}
                {points.map((p, i) => (
                    <g key={i}>
                        {/* X-axis label (show every nth to avoid overlap) */}
                        {(data.length <= 15 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) && (
                            <text x={p.x} y={height - 8} textAnchor="middle" fill="#625D71" fontSize="9" fontFamily="monospace" fontWeight="bold" style={{textTransform: 'uppercase'}}>
                                {formatDateShort(p.date)}
                            </text>
                        )}

                        {/* Hover area */}
                        <rect
                            x={p.x - chartW / data.length / 2}
                            y={padding.top}
                            width={chartW / data.length}
                            height={chartH}
                            fill="transparent"
                            onMouseEnter={() => setHoveredPoint({ ...p, chartType })}
                            className="cursor-crosshair"
                        />

                        {/* Point dot */}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={hoveredPoint?.date === p.date && hoveredPoint?.chartType === chartType ? 6 : 3.5}
                            fill={color}
                            stroke="#0A0A0A"
                            strokeWidth="2"
                            className="transition-all duration-200"
                            style={{ filter: hoveredPoint?.date === p.date && hoveredPoint?.chartType === chartType ? `drop-shadow(0 0 8px ${color})` : 'none' }}
                        />

                        {/* Hover tooltip */}
                        {hoveredPoint?.date === p.date && hoveredPoint?.chartType === chartType && (
                            <g>
                                <line x1={p.x} y1={padding.top} x2={p.x} y2={padding.top + chartH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                                <rect x={p.x - 55} y={p.y - 42} width="110" height="34" rx="8" fill="#1A1A1A" stroke="#333" strokeWidth="1" />
                                <text x={p.x} y={p.y - 25} textAnchor="middle" fill="white" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="bold">
                                    {unit === '%' ? `${p.value.toFixed(1)}%` : p.value.toFixed(1)} {unit !== '%' ? unit : ''}
                                </text>
                                <text x={p.x} y={p.y - 14} textAnchor="middle" fill="#625D71" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                    {p.scans} scan{p.scans !== 1 ? 's' : ''}
                                </text>
                            </g>
                        )}
                    </g>
                ))}
            </svg>
        );
    }, [hoveredPoint]);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A]">
                <div className="w-10 h-10 border-4 border-[#34D399]/30 border-t-[#34D399] rounded-full animate-spin mb-4"></div>
                <div className="text-[#625D71] font-mono tracking-widest text-[10px] uppercase">Loading Growth Data...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#0A0A0A] min-h-screen flex flex-col p-4 md:p-8 lg:p-12 gap-4 md:gap-8 text-white font-sans">

            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex flex-col">
                    <h1 className="text-white text-xl sm:text-3xl font-bold tracking-tight mb-1">Growth Tracking</h1>
                    <p className="text-[#625D71] text-[10px] font-bold tracking-[0.2em] uppercase">Plant Growth Analysis & Harvest Readiness</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                    {/* Date range selector */}
                    <div className="bg-[#151515] rounded-full px-1 py-1 flex items-center gap-1 border border-[#222]">
                        {[7, 14, 30].map(days => (
                            <button
                                key={days}
                                onClick={() => setDateRange(days)}
                                className={`px-3 sm:px-4 py-1.5 rounded-full font-bold text-[9px] sm:text-[10px] tracking-widest uppercase transition-all ${dateRange === days
                                    ? 'bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30'
                                    : 'text-[#625D71] hover:text-white border border-transparent'
                                    }`}
                            >
                                {days}D
                            </button>
                        ))}
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Avg Leaf Count */}
                <div className="bg-[#111] border border-[#222] rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-[#10B981]/20 transition-colors">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#10B981]/5 to-transparent rounded-bl-full"></div>
                    <h3 className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-3">Avg Leaf Count</h3>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-white text-3xl md:text-4xl font-bold tracking-tighter">{avgLeafOverall}</span>
                        <span className="text-[#625D71] font-bold text-xs">leaves</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><path d="M7 17l5-5 5 5"/><path d="M7 7l5 5 5-5"/></svg>
                        <span className="text-[#10B981] font-bold text-[9px] tracking-wider uppercase">Per Day Average</span>
                    </div>
                </div>

                {/* Avg Harvest Readiness */}
                <div className="bg-[#111] border border-[#222] rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-[#F59E0B]/20 transition-colors">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#F59E0B]/5 to-transparent rounded-bl-full"></div>
                    <h3 className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-3">Harvest Ready</h3>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-white text-3xl md:text-4xl font-bold tracking-tighter">{avgHarvestOverall}</span>
                        <span className="text-[#625D71] font-bold text-xs">%</span>
                    </div>
                    <div className="mt-3">
                        <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000"
                                style={{
                                    width: `${Math.min(100, avgHarvestOverall)}%`,
                                    background: `linear-gradient(90deg, #F59E0B, ${avgHarvestOverall >= 80 ? '#34D399' : '#F59E0B'})`
                                }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Total Scans */}
                <div className="bg-[#111] border border-[#222] rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-[#3B82F6]/20 transition-colors">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#3B82F6]/5 to-transparent rounded-bl-full"></div>
                    <h3 className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-3">Total Scans</h3>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-white text-3xl md:text-4xl font-bold tracking-tighter">{totalScans}</span>
                        <span className="text-[#625D71] font-bold text-xs">scans</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        <span className="text-[#3B82F6] font-bold text-[9px] tracking-wider uppercase">Last {dateRange} Days</span>
                    </div>
                </div>

                {/* Latest Scan */}
                <div className="bg-[#111] border border-[#222] rounded-2xl p-5 md:p-6 relative overflow-hidden group hover:border-[#8B5CF6]/20 transition-colors">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#8B5CF6]/5 to-transparent rounded-bl-full"></div>
                    <h3 className="text-[#625D71] font-bold text-[9px] tracking-widest uppercase mb-3">Latest Scan</h3>
                    {latestScan ? (
                        <>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-white text-3xl md:text-4xl font-bold tracking-tighter">{latestScan.leaf_count}</span>
                                <span className="text-[#625D71] font-bold text-xs">leaves</span>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse"></div>
                                <span className="text-[#8B5CF6] font-bold text-[9px] tracking-wider uppercase">{latestScan.date}</span>
                            </div>
                        </>
                    ) : (
                        <span className="text-[#625D71] text-sm">No data</span>
                    )}
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">

                {/* Leaf Count Chart */}
                <div className="bg-[#111] border border-[#222] rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col h-[340px] md:h-[420px] hover:border-[#10B981]/15 transition-colors">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-2">Leaf Count Per Day</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-4xl font-bold tracking-tight">
                                    {growthData.length > 0 ? (growthData[growthData.length - 1].avg_leaf_per_plant || 0).toFixed(1) : '—'}
                                </span>
                                <span className="font-bold text-[11px] tracking-widest uppercase text-[#10B981]">Latest Avg</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-full px-4 py-2 border border-[#333]">
                            <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                            <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">Leaves</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {renderLineChart(growthData, 'avg_leaf_per_plant', '#10B981', 'leafGrad', maxLeafCount, 'leaves', 'leaf')}
                    </div>
                </div>

                {/* Harvest Readiness Chart */}
                <div className="bg-[#111] border border-[#222] rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col h-[340px] md:h-[420px] hover:border-[#F59E0B]/15 transition-colors">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-2">Harvest Readiness</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-white text-4xl font-bold tracking-tight">
                                    {growthData.length > 0 ? (growthData[growthData.length - 1].avg_harvest_readiness || 0).toFixed(1) : '—'}
                                </span>
                                <span className="font-bold text-[11px] tracking-widest uppercase text-[#F59E0B]">% Ready</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-full px-4 py-2 border border-[#333]">
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <span className="text-[#E0E0E0] font-bold text-[9px] tracking-widest uppercase">Readiness</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        {renderLineChart(growthData, 'avg_harvest_readiness', '#F59E0B', 'harvestGrad', 100, '%', 'harvest')}
                    </div>
                </div>
            </div>

            {/* Recent Scans Table */}
            {growthData.length > 0 && (
                <div className="bg-[#111] border border-[#222] rounded-2xl md:rounded-3xl p-4 md:p-8">
                    <h3 className="text-[#625D71] font-bold text-[10px] tracking-widest uppercase mb-6">Daily Growth Log</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#222]">
                                    <th className="text-left text-[#625D71] font-bold text-[9px] tracking-widest uppercase py-3 pr-4">Date</th>
                                    <th className="text-right text-[#625D71] font-bold text-[9px] tracking-widest uppercase py-3 px-4">Avg Leaves</th>
                                    <th className="text-right text-[#625D71] font-bold text-[9px] tracking-widest uppercase py-3 px-4">Harvest %</th>
                                    <th className="text-right text-[#625D71] font-bold text-[9px] tracking-widest uppercase py-3 px-4">Scans</th>
                                    <th className="text-right text-[#625D71] font-bold text-[9px] tracking-widest uppercase py-3 pl-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...growthData].reverse().map((row, i) => {
                                    const readiness = row.avg_harvest_readiness || 0;
                                    let statusColor = '#F59E0B';
                                    let statusText = 'Growing';
                                    if (readiness >= 80) { statusColor = '#34D399'; statusText = 'Ready'; }
                                    else if (readiness >= 50) { statusColor = '#10B981'; statusText = 'Maturing'; }
                                    else if (readiness < 20) { statusColor = '#EF4444'; statusText = 'Seedling'; }

                                    return (
                                        <tr key={row.date} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50 transition-colors">
                                            <td className="py-3 pr-4">
                                                <span className="text-white font-bold text-[11px] tracking-wider">
                                                    {new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                <span className="text-[#10B981] font-bold text-sm font-mono">{(row.avg_leaf_per_plant || 0).toFixed(1)}</span>
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden hidden sm:block">
                                                        <div className="h-full rounded-full transition-all duration-700" style={{
                                                            width: `${readiness}%`,
                                                            background: `linear-gradient(90deg, #F59E0B, ${readiness >= 80 ? '#34D399' : '#F59E0B'})`
                                                        }}></div>
                                                    </div>
                                                    <span className="text-[#F59E0B] font-bold text-sm font-mono">{readiness.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            <td className="text-right py-3 px-4">
                                                <span className="text-[#3B82F6] font-bold text-sm font-mono">{row.scan_count || 0}</span>
                                            </td>
                                            <td className="text-right py-3 pl-4">
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[8px] tracking-widest uppercase"
                                                    style={{ color: statusColor, background: `${statusColor}15`, border: `1px solid ${statusColor}25` }}
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }}></span>
                                                    {statusText}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Growth;
