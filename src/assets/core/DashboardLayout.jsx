import { Link, Outlet } from 'react-router-dom';

const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Navbar ที่จะโผล่ในทุกหน้าของ Dashboard */}
      <nav className="p-4 bg-slate-800 flex items-center justify-between border-b border-slate-700">
        <div className="flex gap-6 items-center">
          <span className="font-bold text-emerald-400 mr-4">AgriSpectra</span>
          <Link to="/" className="hover:text-emerald-400 transition">Dashboard</Link>
          <Link to="/settings" className="hover:text-emerald-400 transition">Settings</Link>
        </div>
      </nav>

      {/* เนื้อหาของแต่ละหน้าจะมาโผล่ตรงนี้ */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;