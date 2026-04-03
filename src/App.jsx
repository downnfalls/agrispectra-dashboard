import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)


  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {/* ทดสอบ Card พร้อมเอฟเฟกต์ Glow ของ Tailwind v4 */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-3xl blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
        
        <div className="relative bg-slate-900 border border-white/10 px-8 py-10 rounded-3xl shadow-2xl text-center">
          <h1 className="text-5xl font-black bg-gradient-to-br from-white to-slate-500 bg-clip-text text-transparent mb-4">
            IT WORKS!
          </h1>
          <p className="text-emerald-400 font-mono tracking-widest uppercase text-sm">
            AgriSpectra Dashboard v4.0
          </p>
          
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <span className="block text-slate-500 text-xs uppercase">Status</span>
              <span className="text-white font-bold">Online</span>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <span className="block text-slate-500 text-xs uppercase">Version</span>
              <span className="text-white font-bold">React + Vite</span>
            </div>
          </div>

          <button className="mt-8 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all active:scale-95 cursor-pointer">
            START DASHBOARD
          </button>
        </div>
      </div>
    </div>
  )

}

export default App
