import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { logout } = useAuth();
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div 
                className={`w-10 h-10 rounded-full bg-[#f9dbd6] overflow-hidden border-2 cursor-pointer transition-all hover:border-[#3B82F6] hover:shadow-[0_0_10px_rgba(59,130,246,0.5)] ${isOpen ? 'border-[#3B82F6] shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-[#2A2732]'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Jangkopf&backgroundColor=f9dbd6" alt="User Profile" className="w-full h-full object-cover"/>
            </div>

            {isOpen && (
                <div className="absolute right-0 top-14 w-[300px] bg-[#15121C] border-2 border-[#3B82F6] shadow-[0_10px_40px_rgba(59,130,246,0.15)] rounded-3xl p-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-[#f9dbd6] border border-[#2A2732] overflow-hidden shrink-0">
                            <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Jangkopf&backgroundColor=f9dbd6" alt="User" className="w-full h-full object-cover"/>
                        </div>
                        <div className="flex flex-col justify-center">
                            <div className="text-white font-bold text-xs tracking-widest mt-1">SOM MAIDAINON</div>
                            <div className="text-[#34D399] font-bold text-[9px] uppercase tracking-[0.2em] mt-1">CEO OF LETTUCE</div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 border-t border-[#2A2732] pt-4">
                        <button className="flex items-center gap-4 text-[#CBC2DC] hover:text-white hover:bg-[#1A151E] px-4 py-3 rounded-xl transition-colors w-full text-left">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span className="font-bold text-[9px] uppercase tracking-widest mt-0.5">Activity Log</span>
                        </button>
                        <button 
                            className="flex items-center gap-4 text-[#F43F5E] hover:text-red-400 hover:bg-red-500/10 px-4 py-3 rounded-xl transition-colors w-full text-left"
                            onClick={handleLogout}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            <span className="font-bold text-[9px] uppercase tracking-widest mt-0.5">Logout System</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;
