import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import agriImage from './resources/Agriculture.png';
import iconSvg from './resources/icon.svg';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setIsLoading(true);

        // Simulate API call delay
        setTimeout(async () => {
            if (username === 'admin' && password === '1234') {
                // Set the mocked user context
                await login({ id: 1, username: 'admin', role: 'admin' });
                // Navigate to dashboard
                navigate('/');
            } else {
                setErrorMsg('Invalid username or password (hint: admin / 1234)');
            }
            setIsLoading(false);
        }, 1500);
    };

    return (
        <div className="bg-[#1D1A24] min-h-screen w-full flex flex-row">
            <div className="bg-[#15121C] relative w-150 overflow-hidden">
                <div 
                    className="absolute w-full h-full bg-linear-to-br 
                        from-[#97CBFF33] 
                        via-[#97CBFF00] 
                        to-[#9BCBFB1A]"
                    >
                </div>
                <img 
                    src={agriImage}
                    className="absolute w-full h-full object-cover mix-blend-overlay opacity-100"
                    alt="Agriculture"
                />
                <div className="absolute p-10 flex flex-col justify-between h-full w-full">
                    <div className='flex flex-row gap-6'>
                        <img src={iconSvg} />
                        <p className='text-[#97CBFF] font-bold text-xl'>AGRISPECTRA PFAL</p>
                    </div>
                    <div className='flex flex-col gap-10'>
                        <div className='flex flex-col gap-6 pr-12'>
                            <h1 className='text-white text-5xl font-semibold leading-tight'>Yielding More <span className='text-[#97CBFF]'>15%</span> with AI-Driven Light Spectrum</h1>
                            <p className='text-[#CBC2DC] text-lg font-light'>A highly precise environmental control system (PCEA) that uses AI to analyze growth stages and optimize light spectrum can increase yield by over 15% and reduce energy costs by up to 30%.</p>
                        </div>
                        <div className='flex flex-row gap-10'>
                            <div className='flex flex-col'>
                                <p className='text-white font-semibold text-3xl'>+15%</p>
                                <p className='text-[#97CBFF] text-sm'>YIELD</p>
                            </div>
                            <div className="w-px h-full bg-slate-700"></div>
                            <div className='flex flex-col'>
                                <p className='text-white font-semibold text-3xl'>-30%</p>
                                <p className='text-[#97CBFF] text-sm'>ENERGY</p>
                            </div>
                        </div>
                    </div>
                    <p className='text-[#625D71] font-medium text-xs'>© 2026 JANGKOPF TEAM. ALL RIGHTS RESERVED.</p>
                </div>
            </div>
            <div className="flex-1 relative flex flex-col justify-center px-16 lg:px-32 xl:px-48">
                <div className="max-w-md w-full">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2A2732] border border-[#3E3A4B] mb-8">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#97CBFF]"></div>
                        <span className="text-[#F472B6] text-[10px] font-bold tracking-widest uppercase">New Personnel Enrollment</span>
                    </div>

                    <h2 className="text-white text-4xl font-semibold mb-2">AgriSpectraSystem Access</h2>
                    <p className="text-[#CBC2DC] text-base mb-12">Step 1 of 3: Identity & Authorization</p>

                    <form className="flex flex-col" onSubmit={handleLogin}>
                        {errorMsg && (
                            <div className="mb-4 bg-red-500/20 border border-red-500 text-red-200 text-sm p-3 rounded-xl">
                                {errorMsg}
                            </div>
                        )}
                        <div className="mb-6">
                            <label className="block text-[#CBC2DC] text-xs font-bold tracking-widest uppercase mb-3 text-left">Username</label>
                            <input 
                                type="text" 
                                placeholder="USERNAME" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-[#2A2732] text-white placeholder-[#625D71] rounded-xl px-5 py-4 outline-none border border-transparent focus:border-[#97CBFF] transition-colors"
                                required
                            />
                        </div>
                        
                        <div className="mb-10">
                            <label className="block text-[#CBC2DC] text-xs font-bold tracking-widest uppercase mb-3 text-left">Password</label>
                            <div className="relative flex items-center">
                                <div className="absolute left-5">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="#625D71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#625D71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <input 
                                    type="password" 
                                    placeholder="••••••••••••" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#2A2732] text-white placeholder-[#625D71] rounded-xl pl-12 pr-5 py-4 outline-none border border-transparent focus:border-[#97CBFF] transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-[#97CBFF] hover:bg-[#86b5e5] text-[#15121C] font-semibold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Authenticating...' : 'Initialize Enrollment'}
                            {!isLoading && (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M12 5L19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            )}
                        </button>
                    </form>
                </div>

                <div className="absolute bottom-10 right-10">
                    <p className="text-[#625D71] text-[10px] font-bold tracking-widest uppercase">Agrispectra V0.0.0</p>
                </div>
            </div>
        </div>
    )
}

export default LoginPage