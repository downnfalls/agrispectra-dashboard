import { Link, Outlet, useLocation } from 'react-router-dom';

const DashboardLayout = () => {
    const location = useLocation();

    return (
        <div className="bg-[#100E14] min-h-screen text-slate-200 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-[#2A2732] flex flex-col justify-between py-8 px-4 flex-shrink-0">
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
                        <Link to="/recipes" className="flex items-center gap-3 px-4 py-3 font-bold text-xs tracking-widest uppercase text-[#625D71] hover:bg-white/5 border-l-2 border-transparent transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Recipes
                        </Link>
                        <Link to="/logs" className="flex items-center gap-3 px-4 py-3 font-bold text-xs tracking-widest uppercase text-[#625D71] hover:bg-white/5 border-l-2 border-transparent transition-colors">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                            Logs
                        </Link>
                    </nav>
                </div>

                <div className="px-4">
                    <button className="w-full border border-red-900/50 hover:bg-red-900/20 text-red-500 font-bold text-[10px] tracking-widest uppercase py-4 rounded-xl transition-colors">
                        Emergency Stop
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 bg-[#15121B] h-screen overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;