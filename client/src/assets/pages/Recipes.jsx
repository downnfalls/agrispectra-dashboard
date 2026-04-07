import React, { useState, useEffect } from 'react';
import UserProfile from '../components/UserProfile';
import agriImage from './login/resources/Agriculture.png';

const initialProfiles = [
    {
        id: 1,
        name: 'Default Lettuce',
        species: 'LACTUCA SATIVA L.',
        stages: [
            {
                id: 11,
                stageLabel: 'STAGE I',
                name: 'Leaf Development',
                blue: 20, red: 60, farRed: 10, white: 10,
                lightIntensity: 65,
                image: 'https://images.unsplash.com/photo-1622383563227-04401ab4e7ea?q=80&w=400&auto=format&fit=crop'
            },
            {
                id: 12,
                stageLabel: 'STAGE II',
                name: 'Vegetative Stage',
                blue: 10, red: 70, farRed: 0, white: 20,
                lightIntensity: 85,
                image: 'https://images.unsplash.com/photo-1622383563227-04401ab4e7ea?q=80&w=400&auto=format&fit=crop'
            }
        ]
    },
    {
        id: 2,
        name: 'Compact Growth',
        species: 'LACTUCA SATIVA L.',
        stages: [
            {
                id: 21,
                stageLabel: 'STAGE I',
                name: 'Seedling\n(BBCH00-09)',
                blue: 30, red: 50, farRed: 5, white: 15,
                lightIntensity: 50,
                image: 'https://images.unsplash.com/photo-1622383563227-04401ab4e7ea?q=80&w=400&auto=format&fit=crop'
            }
        ]
    },
    {
        id: 3,
        name: 'Experimental Recipe',
        species: 'LACTUCA SATIVA L.',
        stages: []
    }
];

// Helper to calculate total ratio correctly
const normalizeRatios = (b, r, fr, w) => {
    return { b, r, fr, w }; // Returning raw values, adjusting them separately in logic if needed
};

export default function Recipes() {
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [profiles, setProfiles] = useState(() => {
        const saved = localStorage.getItem('agrispectra_profiles');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse profiles', e); }
        }
        return initialProfiles;
    });

    const [activeProfileId, setActiveProfileId] = useState(() => {
        const saved = localStorage.getItem('agrispectra_active_profile');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse active profile', e); }
        }
        return initialProfiles[0].id;
    });

    useEffect(() => {
        localStorage.setItem('agrispectra_profiles', JSON.stringify(profiles));
    }, [profiles]);

    useEffect(() => {
        if (activeProfileId !== null && activeProfileId !== undefined) {
            localStorage.setItem('agrispectra_active_profile', JSON.stringify(activeProfileId));
        } else {
            localStorage.removeItem('agrispectra_active_profile');
        }
    }, [activeProfileId]);

    const handleAddProfile = () => {
        const newId = Date.now();
        setProfiles([...profiles, {
            id: newId,
            name: `New Profile ${profiles.length + 1}`,
            species: 'UNKNOWN SPECIES',
            stages: []
        }]);
        setActiveProfileId(newId);
        setIsEditingProfile(true);
    };

    const handleRemoveProfile = (id, e) => {
        e.stopPropagation();
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        if (activeProfileId === id && updated.length > 0) {
            setActiveProfileId(updated[0].id);
        } else if (updated.length === 0) {
            setActiveProfileId(null);
        }
    };

    const updateStageLight = (profileId, stageId, color, value) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            return {
                ...p,
                stages: p.stages.map(s => {
                    if (s.id !== stageId) return s;
                    return { ...s, [color]: parseInt(value) };
                })
            };
        }));
    };

    const handleAddStage = (profileId) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            
            // Generate roman numeral for stage label
            const num = p.stages.length + 1;
            const romanLabel = num === 1 ? 'I' : num === 2 ? 'II' : num === 3 ? 'III' : num === 4 ? 'IV' : 'V';
            
            const newStage = {
                id: Date.now(),
                stageLabel: `STAGE ${romanLabel}`,
                name: `Phase ${num}`,
                blue: 20, red: 50, farRed: 10, white: 20,
                lightIntensity: 60,
                image: 'https://images.unsplash.com/photo-1622383563227-04401ab4e7ea?q=80&w=400&auto=format&fit=crop'
            };
            
            return {
                ...p,
                stages: [...p.stages, newStage]
            };
        }));
    };

    const handleRemoveStage = (profileId, stageId) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            return {
                ...p,
                stages: p.stages.filter(s => s.id !== stageId)
            };
        }));
    };

    const handleUpdateStageName = (profileId, stageId, newName) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            return {
                ...p,
                stages: p.stages.map(s => {
                    if (s.id !== stageId) return s;
                    return { ...s, name: newName };
                })
            };
        }));
    };

    const handleUpdateStageLogic = (profileId, stageId, key, value) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            return {
                ...p,
                stages: p.stages.map(s => {
                    if (s.id !== stageId) return s;
                    return { ...s, [key]: value };
                })
            };
        }));
    };

    const handleUpdateProfileName = (profileId, newName) => {
        setProfiles(profiles.map(p => {
            if (p.id !== profileId) return p;
            return { ...p, name: newName };
        }));
    };

    const activeProfile = profiles.find(p => p.id === activeProfileId);

    return (
        <div className="flex flex-col h-full bg-[#15121B] text-white overflow-y-auto">
            
            {/* Header */}
            <header className="px-8 lg:px-12 pt-8 pb-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-8">
                    <h1 className="text-[#CBA6F7] text-3xl font-bold tracking-wide">JANGKOPF</h1>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-[#15121C] rounded-full px-4 py-2 flex items-center gap-3 border border-[#2A2732]">
                        <div className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_8px_#34D399]"></div>
                        <span className="text-white font-bold text-[10px] tracking-widest uppercase">ESP32 CAM ONLINE</span>
                    </div>
                    <UserProfile />
                </div>
            </header>

            {/* Editor vs View Conditional */}
            {isEditingProfile && activeProfile ? (
                <RecipeEditor 
                    profile={activeProfile} 
                    onClose={() => setIsEditingProfile(false)} 
                    onAddStage={() => handleAddStage(activeProfile.id)}
                    onUpdateStageName={(stageId, newName) => handleUpdateStageName(activeProfile.id, stageId, newName)}
                    onRemoveStage={(stageId) => handleRemoveStage(activeProfile.id, stageId)}
                    onUpdateLogic={(stageId, key, value) => handleUpdateStageLogic(activeProfile.id, stageId, key, value)}
                />
            ) : (
                <>
            {/* Profile Selection Pills */}
            <div className="px-8 lg:px-12 pb-6 flex flex-wrap gap-4 shrink-0">
                {profiles.map(profile => {
                    const isActive = activeProfileId === profile.id;
                    return (
                        <div 
                            key={profile.id}
                            onClick={() => setActiveProfileId(profile.id)}
                            className={`group relative flex flex-col justify-center px-5 py-3 rounded-2xl border cursor-pointer transition-all duration-200 min-w-[180px] h-20 ${
                                isActive 
                                ? 'border-[#4F95FF] bg-gradient-to-br from-[#4F95FF]/10 to-transparent shadow-[0_0_15px_rgba(79,149,255,0.15)]' 
                                : 'border-[#2A2732] hover:border-[#4F95FF]/50 bg-[#1A1820]'
                            }`}
                        >
                            {/* Delete button (shows on hover) */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveProfile(profile.id, e); }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Remove Profile"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <div className="flex items-center justify-between mb-1">
                                {isActive ? (
                                    <div className="w-5 h-5 rounded-full bg-[#4F95FF] flex items-center justify-center shrink-0">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full border border-[#625D71] shrink-0"></div>
                                )}
                                {isActive && <span className="text-[9px] font-bold tracking-widest text-[#4F95FF] uppercase bg-[#4F95FF]/20 px-2 py-0.5 rounded-full">ACTIVE</span>}
                            </div>
                            
                            {isActive ? (
                                <input 
                                    type="text" 
                                    value={profile.name}
                                    onChange={(e) => handleUpdateProfileName(profile.id, e.target.value)}
                                    className="bg-transparent border-none outline-none focus:ring-0 p-0 m-0 text-sm font-bold text-white placeholder-white/50 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <h3 className="text-sm font-bold text-white truncate w-full">{profile.name}</h3>
                            )}
                            
                            <p className="text-[10px] text-[#625D71] font-bold tracking-widest truncate w-full">{profile.species}</p>
                        </div>
                    );
                })}

                {/* Add New Profile Button */}
                <div 
                    onClick={handleAddProfile}
                    className="flex flex-col items-center justify-center px-5 py-3 rounded-2xl border border-dashed border-[#625D71] hover:border-slate-300 hover:bg-white/5 cursor-pointer transition-all duration-200 min-w-[180px] h-20 text-[#625D71] hover:text-slate-300"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span className="text-[10px] font-bold tracking-widest uppercase">New Profile</span>
                </div>
            </div>

            <hr className="border-[#2A2732] mx-8 lg:mx-12 mb-8" />

            {/* Stages Grid */}
            <div className="grow px-8 lg:px-12 pb-32 flex gap-8 overflow-x-auto items-start">
                {activeProfile ? (
                    activeProfile.stages.length > 0 ? (
                        activeProfile.stages.map((stage, idx) => (
                            <StageCard 
                                key={stage.id} 
                                stage={stage} 
                                onUpdate={(color, val) => updateStageLight(activeProfile.id, stage.id, color, val)}
                                onModify={() => setIsEditingProfile(true)}
                            />
                        ))
                    ) : (
                        <div className="text-[#625D71] text-sm italic w-full text-center py-20">No stages defined for this profile.</div>
                    )
                ) : (
                    <div className="text-[#625D71] text-sm italic w-full text-center py-20">Select a profile to view its recipes.</div>
                )}
            </div>

            <div className="mt-auto px-8 lg:px-12 py-5 border-t border-[#2A2732] flex justify-between items-center bg-[#15121B]/90 backdrop-blur shrink-0 sticky bottom-0 z-20">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={(e) => activeProfileId && handleRemoveProfile(activeProfileId, e)}
                        disabled={!activeProfileId}
                        className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 transition-colors ${activeProfileId ? 'text-red-500 hover:text-red-400' : 'text-[#625D71] cursor-not-allowed'}`}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Delete Profile
                    </button>
                    <div className="w-px h-4 bg-[#2A2732]"></div>
                    <button className="text-[10px] font-bold tracking-widest uppercase text-[#625D71] hover:text-white transition-colors">
                        Discard Changes
                    </button>
                </div>
                <button onClick={() => setIsEditingProfile(true)} className="bg-[#97CBFF] hover:bg-[#82bcf6] text-[#15121B] px-6 py-3 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modify Configuration Details
                </button>
            </div>
            </>
            )}
            
            {/* Embedded styles for sliders to look correct without extra plugins */}
            <style jsx="true">{`
                input[type=range] {
                    -webkit-appearance: none; 
                    background: transparent; 
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                }
                
                /* Custom Thumb Classes */
                .thumb-blue::-webkit-slider-thumb { background: #4F95FF; height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 0 10px rgba(79,149,255,0.5); cursor: pointer; margin-top:-6px; }
                .thumb-red::-webkit-slider-thumb { background: #FF4A4A; height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 0 10px rgba(255,74,74,0.5); cursor: pointer; margin-top:-6px; }
                .thumb-pink::-webkit-slider-thumb { background: #FF2A85; height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 0 10px rgba(255,42,133,0.5); cursor: pointer; margin-top:-6px; }
                .thumb-white::-webkit-slider-thumb { background: #FFFFFF; height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 0 10px rgba(255,255,255,0.5); cursor: pointer; margin-top:-6px; }
                .thumb-purple::-webkit-slider-thumb { background: #A485FF; height: 16px; width: 16px; border-radius: 50%; box-shadow: 0 0 10px rgba(164,133,255,0.5); cursor: pointer; margin-top:-6px; }

                /* Custom Track Placeholder */
                input[type=range]::-webkit-slider-runnable-track {
                    height: 4px;
                    border-radius: 2px;
                }
            `}</style>
        </div>
    );
}

function StageCard({ stage, onUpdate, onModify }) {
    
    // We treat values simply as numbers
    const total = stage.blue + stage.red + stage.farRed + stage.white || 1;

    return (
        <div className="w-[360px] shrink-0 border border-[#2A2732] rounded-2xl bg-[#1A1820] overflow-hidden flex flex-col relative">
            
            {/* Background Image Header */}
            <div className="absolute top-0 left-0 w-full h-40 opacity-20 pointer-events-none">
                <img src={agriImage} alt="" className="w-full h-full object-cover grayscale mix-blend-screen" />
            </div>

            <div className="p-6 relative z-10">
                <div className="inline-block bg-[#4F95FF]/20 text-[#4F95FF] border border-[#4F95FF]/30 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest mb-4">
                    {stage.stageLabel}
                </div>
                <h3 className="text-2xl font-bold whitespace-pre-line leading-tight text-white mb-6">
                    {stage.name}
                </h3>

                {/* Big Ratio Display */}
                <div className="flex items-baseline gap-1 mb-2 font-bold font-mono">
                    <span className="text-4xl text-[#4F95FF]">{stage.blue}</span>
                    <span className="text-2xl text-[#625D71]"> : </span>
                    <span className="text-4xl text-[#FF4A4A]">{stage.red}</span>
                    <span className="text-2xl text-[#625D71]"> : </span>
                    <span className="text-4xl text-[#FF2A85]">{stage.farRed}</span>
                    <span className="text-2xl text-[#625D71]"> : </span>
                    <span className="text-4xl text-[#FFFFFF]">{stage.white}</span>
                </div>
                <p className="text-[9px] text-[#625D71] font-bold tracking-[0.2em] mb-8">SPECTRUM RATIO (B:R:FR:W)</p>

                {/* Sliders Container */}
                <div className="space-y-6 mb-8 border-b border-[#2A2732] pb-8">
                    <SliderRow 
                        label="BLUE" 
                        value={stage.blue} 
                        color="#4F95FF" 
                        thumbClass="thumb-blue" 
                        onChange={(e) => onUpdate('blue', e.target.value)} 
                    />
                    <SliderRow 
                        label="RED" 
                        value={stage.red} 
                        color="#FF4A4A" 
                        thumbClass="thumb-red" 
                        onChange={(e) => onUpdate('red', e.target.value)} 
                    />
                    <SliderRow 
                        label="FAR-RED" 
                        value={stage.farRed} 
                        color="#FF2A85" 
                        thumbClass="thumb-pink" 
                        onChange={(e) => onUpdate('farRed', e.target.value)} 
                    />
                    <SliderRow 
                        label="WHITE" 
                        value={stage.white} 
                        color="#FFFFFF" 
                        thumbClass="thumb-white" 
                        onChange={(e) => onUpdate('white', e.target.value)} 
                    />
                </div>

                {/* Light Intensity Container */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-[10px] text-[#625D71] font-bold tracking-[0.2em]">LIGHT INTENSITY (PPFD)</span>
                        <span className="text-2xl font-bold font-mono text-white">{stage.lightIntensity}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="100" 
                        value={stage.lightIntensity} 
                        onChange={(e) => onUpdate('lightIntensity', e.target.value)}
                        className={`w-full thumb-purple bg-transparent`}
                        style={{
                            background: `linear-gradient(to right, #A485FF ${stage.lightIntensity}%, #2A2732 ${stage.lightIntensity}%)`
                        }}
                    />
                </div>

                {/* Cycle Intensity Container */}
                <div className="p-5 border border-[#2A2732] rounded-2xl bg-[#1A1820]">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] text-[#625D71] font-bold tracking-[0.2em]">CYCLE INTENSITY (%)</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#18C3B1]"></div>
                            <span className="text-[9px] text-[#625D71] font-bold tracking-[0.2em]">{stage.id === 11 ? '12 DAYS' : '14 DAYS'}</span>
                        </div>
                    </div>

                    {/* Mock Bar Chart */}
                    <div className="flex items-end gap-1 h-20 mb-2">
                        {/* Fake bars for mock visualization mimicking the design */}
                        {stage.id === 11 ? (
                            <>
                                <div className="w-1/6 bg-[#FF4A4A] h-[90%]"></div>
                                <div className="w-1/6 bg-[#FF4A4A] h-[90%]"></div>
                                <div className="w-1/6 bg-[#FF4A4A] h-[90%]"></div>
                                <div className="w-1/6 bg-[#18C3B1] h-[20%]"></div>
                                <div className="w-1/6 bg-[#18C3B1] h-[20%]"></div>
                                <div className="w-1/6 bg-[#4F95FF] h-[5%]"></div>
                            </>
                        ) : (
                            <>
                                <div className="w-1/6 bg-[#FF4A4A] h-[95%]"></div>
                                <div className="w-1/6 bg-[#FF4A4A] h-[95%]"></div>
                                <div className="w-1/6 bg-[#FF4A4A] h-[95%]"></div>
                                <div className="w-1/6 bg-[#FF4A4A] h-[95%]"></div>
                                <div className="w-1/6 bg-[#18C3B1] h-[30%]"></div>
                                <div className="w-1/6 bg-[#18C3B1] h-[30%]"></div>
                                <div className="w-1/6 bg-[#4F95FF] h-[10%]"></div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-between text-[8px] text-[#625D71] font-mono tracking-wider border-t border-[#2A2732] pt-2">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>24:00</span>
                    </div>
                </div>
                
            </div>

        </div>
    );
}

function SliderRow({ label, value, color, onChange, thumbClass }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color: color }}>
                    {label}
                </span>
                <span className="text-sm font-bold font-mono text-white text-right w-10">{value}%</span>
            </div>
            <input 
                type="range" min="0" max="100" 
                value={value} 
                onChange={onChange}
                className={`w-full ${thumbClass} bg-transparent h-1`}
                style={{
                    background: `linear-gradient(to right, ${color} ${value}%, #2A2732 ${value}%)`,
                }}
            />
        </div>
    );
}

// --- NEW EDITOR COMPONENTS ---

function RecipeEditor({ profile, onClose, onAddStage, onUpdateStageName, onRemoveStage, onUpdateLogic }) {
    // If the profile has stages, expand the first one, otherwise null
    const [expandedStageId, setExpandedStageId] = useState(profile.stages.length > 0 ? profile.stages[0].id : null);

    return (
        <>
            <div className="px-8 lg:px-12 pb-6 flex-1 overflow-y-auto shrink-0 space-y-6">
                {profile.stages.length > 0 ? (
                    profile.stages.map((stage, idx) => (
                        expandedStageId === stage.id ? (
                            <ExpandedStageEditor 
                                key={stage.id} 
                                stage={stage} 
                                index={idx} 
                                onUpdateName={(name) => onUpdateStageName(stage.id, name)} 
                                onRemove={() => onRemoveStage(stage.id)}
                                onUpdateLogic={(key, value) => onUpdateLogic(stage.id, key, value)}
                            />
                        ) : (
                            <CollapsedStageCard 
                                key={stage.id} 
                                stage={stage} 
                                index={idx} 
                                onExpand={() => setExpandedStageId(stage.id)} 
                                onRemove={() => onRemoveStage(stage.id)}
                            />
                        )
                    ))
                ) : (
                    <div className="text-center py-20 text-[#625D71] text-xs italic tracking-wide">No stages configured yet.</div>
                )}

                <button 
                    onClick={onAddStage}
                    className="w-full py-12 border-2 border-dashed border-[#2A2732] hover:border-[#97CBFF]/50 hover:bg-[#97CBFF]/5 rounded-[2rem] transition-colors flex flex-col items-center justify-center gap-4 mt-6"
                >
                    <div className="w-12 h-12 rounded-full bg-[#2A2732] flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97CBFF" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span className="text-[#97CBFF] font-bold tracking-[0.2em] text-xs uppercase">Add New Growth Stage</span>
                </button>
            </div>

            {/* Bottom Bar for Editor */}
            <div className="mt-auto px-8 lg:px-12 py-5 border-t border-[#2A2732] flex justify-between items-center bg-[#15121B]/90 backdrop-blur shrink-0 sticky bottom-0 z-20">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-bold tracking-widest uppercase text-white">Status: Drafting</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#625D71]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span className="text-[10px] tracking-wide inline-block mt-0.5">Autosaved 2m ago</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <button onClick={onClose} className="text-[10px] font-bold tracking-widest uppercase text-[#625D71] hover:text-white transition-colors border border-[#2A2732] hover:border-white/20 rounded-full px-6 py-3">
                        Discard Changes
                    </button>
                    <button onClick={onClose} className="bg-[#97CBFF] hover:bg-[#82bcf6] text-[#15121B] px-8 py-3 rounded-full text-xs font-bold tracking-widest uppercase transition-colors flex items-center gap-2">
                        Save & Deploy Recipe
                    </button>
                </div>
            </div>
        </>
    );
}

function ExpandedStageEditor({ stage, index, onUpdateName, onRemove, onUpdateLogic }) {
    // Handle mock values default initializations
    const useLeafCount = stage.useLeafCount !== false; 
    const leafCount = stage.leafCount || 8;
    const useDiameter = stage.useDiameter !== false;
    const diameter = stage.diameter || 12;
    const logicOperator = stage.logicOperator || 'AND';

    return (
        <div className="bg-[#1D1A24] border border-[#2A2732] rounded-[2rem] p-8 lg:p-10 flex flex-col relative overflow-hidden">
            {/* Top info */}
            <div className="flex items-center justify-between mb-12 w-full">
                <div className="flex items-center gap-6 w-full">
                    <div className="w-16 h-16 rounded-[1rem] bg-[#2A2732] shrink-0 flex items-center justify-center text-2xl font-bold text-[#97CBFF]">
                        {index + 1}
                    </div>
                    <div className="w-full max-w-sm">
                        <input 
                            type="text" 
                            value={stage.name.split('\n')[0]} 
                            onChange={(e) => onUpdateName(e.target.value)}
                            className="text-2xl font-bold text-white mb-1 bg-transparent border border-transparent hover:border-[#2A2732] focus:border-[#4F95FF] focus:bg-[#15121C] px-2 py-1 -ml-2 rounded-lg outline-none transition-colors w-full"
                            placeholder="Phase Name"
                        />
                        <p className="text-[#625D71] text-xs font-medium pl-1">Target: Strong root development & initial shoot emergence</p>
                    </div>
                </div>
                
                <button onClick={onRemove} className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors" title="Delete Stage">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>

            <div className="grid grid-cols-12 gap-12 lg:gap-16 mb-12">
                {/* Timeline */}
                <div className="col-span-12 xl:col-span-7">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#625D71]">Photoperiod Timeline (24H)</h4>
                        <button className="flex items-center gap-2 text-[#97CBFF] text-[10px] font-bold tracking-widest uppercase hover:text-white transition">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Segment
                        </button>
                    </div>

                    <div className="bg-[#15121C] rounded-2xl py-3 divide-y divide-[#2A2732]">
                        {/* Headers */}
                        <div className="grid grid-cols-3 pb-3 px-6">
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71]">Time Interval</span>
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71] text-center">Status</span>
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71] text-right">Intensity</span>
                        </div>
                        {/* Row 1 */}
                        <div className="grid grid-cols-3 py-5 px-6 items-center">
                            <span className="text-[#97CBFF] font-mono text-sm tracking-wider">00:00 — 06:00</span>
                            <div className="flex justify-center">
                                <span className="bg-[#2A2732] text-[#625D71] text-[9px] px-3 py-1 rounded-full font-bold tracking-wider">OFF</span>
                            </div>
                            <span className="text-white font-bold text-right text-sm">0%</span>
                        </div>
                        {/* Row 2 */}
                        <div className="grid grid-cols-3 py-5 px-6 items-center bg-white/[0.02]">
                            <span className="text-[#97CBFF] font-mono text-sm tracking-wider">06:00 — 18:00</span>
                            <div className="flex justify-center">
                                <span className="bg-[#4F95FF]/20 border border-[#4F95FF]/30 text-[#97CBFF] text-[9px] px-3 py-1 rounded-full font-bold tracking-wider">ACTIVE</span>
                            </div>
                            <span className="text-[#97CBFF] font-bold text-right text-sm">100%</span>
                        </div>
                        {/* Row 3 */}
                        <div className="grid grid-cols-3 py-5 px-6 items-center">
                            <span className="text-[#97CBFF] font-mono text-sm tracking-wider">18:00 — 00:00</span>
                            <div className="flex justify-center">
                                <span className="bg-[#2A2732] text-[#625D71] text-[9px] px-3 py-1 rounded-full font-bold tracking-wider">OFF</span>
                            </div>
                            <span className="text-white font-bold text-right text-sm">0%</span>
                        </div>
                    </div>
                </div>

                {/* Spectra */}
                <div className="col-span-12 xl:col-span-5">
                    <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#625D71] mb-8">Spectrum Ratio (B:R:FR:W)</h4>
                    
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b border-[#2A2732] pb-5">
                            <span className="text-[#4F95FF] text-xs font-bold tracking-wide">Deep Blue (450nm)</span>
                            <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.blue}%</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#2A2732] pb-5">
                            <span className="text-[#FF4A4A] text-xs font-bold tracking-wide">Deep Red (660nm)</span>
                            <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.red}%</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#2A2732] pb-5">
                            <span className="text-[#FF2A85] text-xs font-bold tracking-wide">Far Red (730nm)</span>
                            <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.farRed}%</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-[#2A2732] pb-5">
                            <span className="text-[#FFFFFF] text-xs font-bold tracking-wide">Full Spectrum White</span>
                            <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.white}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom logic bar */}
            <div>
                <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#625D71] mb-6">Advance to next stage when:</h4>
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div 
                            onClick={() => onUpdateLogic('useLeafCount', !useLeafCount)}
                            className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center cursor-pointer border transition-colors ${useLeafCount ? 'bg-[#97CBFF] border-[#97CBFF]' : 'bg-transparent border-[#625D71]'}`}
                        >
                            {useLeafCount && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15121B" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span className="text-white font-bold text-xs tracking-wide">Leaf Count</span>
                        <input 
                            type="number"
                            value={leafCount}
                            onChange={(e) => onUpdateLogic('leafCount', e.target.value)}
                            disabled={!useLeafCount}
                            className={`bg-[#15121C] border border-[#2A2732] rounded-lg px-2 py-2 w-16 text-center font-bold text-xs focus:border-[#97CBFF] outline-none transition-colors ${useLeafCount ? 'text-[#97CBFF]' : 'text-[#625D71] opacity-50'}`}
                        />
                    </div>
                    
                    <div className="bg-[#15121C] border border-[#2A2732] rounded-full flex p-1">
                        <button 
                            onClick={() => onUpdateLogic('logicOperator', 'AND')}
                            className={`text-[9px] font-bold tracking-widest px-4 py-1.5 rounded-full transition-colors outline-none ${logicOperator === 'AND' ? 'bg-[#97CBFF] text-[#15121B]' : 'text-[#625D71] hover:text-white'}`}
                        >
                            AND
                        </button>
                        <button 
                            onClick={() => onUpdateLogic('logicOperator', 'OR')}
                            className={`text-[9px] font-bold tracking-widest px-4 py-1.5 rounded-full transition-colors outline-none ${logicOperator === 'OR' ? 'bg-[#97CBFF] text-[#15121B]' : 'text-[#625D71] hover:text-white'}`}
                        >
                            OR
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div 
                            onClick={() => onUpdateLogic('useDiameter', !useDiameter)}
                            className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center cursor-pointer border transition-colors ${useDiameter ? 'bg-[#97CBFF] border-[#97CBFF]' : 'bg-transparent border-[#625D71]'}`}
                        >
                            {useDiameter && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15121B" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span className="text-white font-bold text-xs tracking-wide">Diameter</span>
                        <input 
                            type="number"
                            value={diameter}
                            onChange={(e) => onUpdateLogic('diameter', e.target.value)}
                            disabled={!useDiameter}
                            className={`bg-[#15121C] border border-[#2A2732] rounded-lg px-2 py-2 w-16 text-center font-bold text-xs focus:border-[#97CBFF] outline-none transition-colors ${useDiameter ? 'text-[#97CBFF]' : 'text-[#625D71] opacity-50'}`}
                        />
                        <span className={`font-bold text-[10px] tracking-widest transition-opacity ${useDiameter ? 'text-[#625D71]' : 'text-[#625D71] opacity-40'}`}>CM</span>
                    </div>

                    <button className="flex items-center gap-3 text-[#625D71] text-[10px] font-bold tracking-widest uppercase hover:text-white transition ml-auto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        Add Logic
                    </button>
                </div>
            </div>
        </div>
    );
}

function CollapsedStageCard({ stage, index, onExpand, onRemove }) {
    return (
        <div className="bg-[#15121C] border border-[#2A2732] rounded-[2rem] p-8 pb-10 relative overflow-hidden flex flex-col xl:flex-row justify-between items-center group transition">
            <div className="flex items-start gap-8 relative z-10 w-full xl:w-2/3 mb-6 xl:mb-0">
                <div className="w-16 h-16 rounded-[1rem] bg-[#2A2732] shrink-0 flex items-center justify-center text-2xl font-bold text-[#625D71]">
                    {index + 1}
                </div>
                <div className="w-full">
                    <h3 className="text-2xl font-bold text-[#625D71] mb-2">{stage.name.split('\n')[0] || 'Vegetative Stage'}</h3>
                    <p className="text-[#625D71]/60 text-xs font-medium mb-10">Expansion of true leaves and biomass accumulation</p>
                    
                    <div className="border border-dashed border-[#2A2732] rounded-2xl py-6 flex items-center justify-center w-full lg:max-w-md">
                        <span className="text-[#625D71] text-[10px] tracking-widest font-bold uppercase">Configuration Active</span>
                    </div>
                </div>
            </div>
            
            <div className="relative z-10 xl:h-full flex items-center shrink-0 pr-4 gap-4">
                <button onClick={onExpand} className="flex items-center gap-3 text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase hover:text-white transition py-4 px-6 rounded-full border border-[#97CBFF]/20 hover:bg-[#97CBFF]/10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modify Parameters
                </button>
                <button onClick={onRemove} className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors" title="Delete Stage">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        </div>
    );
}
