import { Link, Outlet, useLocation } from 'react-router-dom';

const DashboardLayout = () => {
    const location = useLocation();

    return (
        <div className="bg-[#0A0A0A] min-h-screen text-slate-200 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-[#222] flex flex-col justify-between py-8 px-4 flex-shrink-0">
                <div>
                    {/* Header */}
                    <div className="mb-12 px-4">
                        <h1 className="text-[#97CBFF] font-bold text-lg leading-tight">AgriSpectra</h1>
                        <p className="text-[#625D71] text-[10px] font-bold tracking-widest uppercase mt-1">V0.0.0-Stable</p>
                    </div>

                    {/* Nav Links */}
                    <nav className="flex flex-col gap-2">
                        <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-r-full font-bold text-xs tracking-widest uppercase transition-colors ${location.pathname === '/' ? 'text-[#97CBFF] bg-[#97CBFF]/10 border-l-2 border-[#97CBFF]' : 'text-[#625D71] hover:bg-white/5 border-l-2 border-transparent'}`}>
                            {/* SVG Icon Overview */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            Overview
                        </Link>
                        <Link to="/energy" className={`flex items-center gap-3 px-4 py-3 rounded-r-full font-bold text-xs tracking-widest uppercase transition-colors ${location.pathname === '/energy' ? 'text-[#97CBFF] bg-[#97CBFF]/10 border-l-2 border-[#97CBFF]' : 'text-[#625D71] hover:bg-white/5 border-l-2 border-transparent'}`}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Energy
                        </Link>
                        <Link to="/recipes" className={`flex items-center gap-3 px-4 py-3 rounded-r-full font-bold text-xs tracking-widest uppercase transition-colors ${location.pathname === '/recipes' ? 'text-[#97CBFF] bg-[#97CBFF]/10 border-l-2 border-[#97CBFF]' : 'text-[#625D71] hover:bg-white/5 border-l-2 border-transparent'}`}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Recipes
                        </Link>
                    </nav>
                </div>

                <div className="px-4 flex flex-col gap-2">
                    <button 
                        onClick={async () => {
                            if (window.confirm("🚨 ARE YOU SURE? This will immediately SHUT DOWN all hardware systems!")) {
                                try {
                                    const token = sessionStorage.getItem('token');
                                    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/hardware/stop`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });
                                    if (response.ok) {
                                        alert("🛑 Emergency Stop command sequence initiated.");
                                    } else {
                                        alert("❌ Failed to initiate Emergency Stop. Please check connection.");
                                    }
                                } catch (err) {
                                    console.error("Emergency Stop Error:", err);
                                    alert("❌ System Error during Emergency Stop.");
                                }
                            }
                        }}
                        className="w-full border border-red-900/50 hover:bg-red-900/20 text-red-500 font-bold text-[10px] tracking-widest uppercase py-4 rounded-xl transition-colors"
                    >
                        Emergency Stop
                    </button>
                    <button 
                        onClick={async () => {
                            if (window.confirm("🔄 ยืนยันการ Reset ระบบ?")) {
                                try {
                                    const token = sessionStorage.getItem('token');
                                    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/hardware/reset`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });
                                    if (response.ok) {
                                        alert("🔄 Reset command sent successfully.");
                                    } else {
                                        alert("❌ Failed to send Reset command. Please check connection.");
                                    }
                                } catch (err) {
                                    console.error("Reset Error:", err);
                                    alert("❌ System Error during Reset.");
                                }
                            }
                        }}
                        className="w-full border border-amber-900/50 hover:bg-amber-900/20 text-amber-500 font-bold text-[10px] tracking-widest uppercase py-4 rounded-xl transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-[#0A0A0A] h-screen overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;