import agriImage from './resources/Agriculture.png';
import iconSvg from './resources/icon.svg';

function LoginPage() {

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
            <div className="flex-1">
                
            </div>
        </div>
    )
}

export default LoginPage