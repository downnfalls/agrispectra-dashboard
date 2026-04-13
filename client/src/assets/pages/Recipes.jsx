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

    const [deployedProfileId, setDeployedProfileId] = useState(() => {
        const saved = localStorage.getItem('agrispectra_deployed_profile');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse deployed profile', e); }
        }
        return null;
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

    useEffect(() => {
        if (deployedProfileId !== null && deployedProfileId !== undefined) {
            localStorage.setItem('agrispectra_deployed_profile', JSON.stringify(deployedProfileId));
        } else {
            localStorage.removeItem('agrispectra_deployed_profile');
        }
    }, [deployedProfileId]);

    const [profilesSnapshot, setProfilesSnapshot] = useState(null);

    const [isLoading, setIsLoading] = useState(false);

    // Fetch profiles from server on load
    useEffect(() => {
        const fetchProfiles = async () => {
            setIsLoading(true);
            try {
                // Adjust endpoint name to whatever the backend uses for getting profiles
                /* --- API CONNECTION COMMENTED OUT ---
                const response = await fetch('http://192.168.1.116:8080/recipes'); 
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) {
                        setProfiles(data);
                    } else if (data.profiles && Array.isArray(data.profiles)) {
                        setProfiles(data.profiles);
                    } else if (typeof data === 'object') {
                        // Fallback mapping if backend returns an object map format instead of list
                        const mappedProfiles = Object.keys(data).map((key, i) => ({
                            id: data[key].id || (i + 1),
                            name: data[key].name || key,
                            species: data[key].species || 'IMPORTED',
                            stages: data[key].stages || Object.values(data[key])
                        }));
                        if (mappedProfiles.length > 0) setProfiles(mappedProfiles);
                    }
                }
                ------------------------------------- */
            } catch (error) {
                console.warn('Could not fetch profiles from backend, falling back to local storage', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchProfiles();
    }, []);

    const handleAddProfile = () => {
        setProfilesSnapshot(JSON.stringify(profiles));
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

    const handleDiscardChanges = () => {
        if (profilesSnapshot) {
            const restored = JSON.parse(profilesSnapshot);
            setProfiles(restored);
            // Revert active profile safely
            if (!restored.some(p => p.id === activeProfileId)) {
                setActiveProfileId(restored.length > 0 ? restored[0].id : null);
            }
        }
        setIsEditingProfile(false);
        setProfilesSnapshot(null);
    };

    const handleSaveChanges = () => {
        if (activeProfile) {
            const payload = buildProfilePayload(activeProfile);
            console.log("Saved Recipe JSON:", JSON.stringify(payload, null, 2));
            alert("Recipe Saved! Check the browser console to see the JSON payload.");
        }
        setIsEditingProfile(false);
        setProfilesSnapshot(null);
    };

    const buildProfilePayload = (profile) => {
        if (!profile) return null;
        
        const payload = {
            profile_name: profile.name
        };
        
        profile.stages.forEach((stage, index) => {
            const stageKey = `stage-${index + 1}`;
            
            const period = {};
            const timeline = stage.timeline || [
                { id: 1, time: '00:00', status: 'OFF', intensity: 0 },
                { id: 2, time: '06:00', status: 'ACTIVE', intensity: 100 },
                { id: 3, time: '00:00', status: 'OFF', intensity: 0 }
            ];
            timeline.forEach(seg => {
                period[seg.time] = seg.status === 'ACTIVE' ? (parseInt(seg.intensity) || 0) : 0;
            });
            
            payload[stageKey] = {
                red: parseInt(stage.red) || 0,
                farRed: parseInt(stage.farRed) || 0,
                blue: parseInt(stage.blue) || 0,
                white: parseInt(stage.white) || 0,
                leaf: stage.useLeafCount !== false ? (parseInt(stage.leafCount) || null) : null,
                leaf_density: stage.useDiameter !== false ? (parseInt(stage.diameter) || 12) : null,
                ppfd: parseInt(stage.lightIntensity) || 0,
                period: period
            };
        });
        return payload;
    };

    // Print all profiles as JSON payloads on mount
    useEffect(() => {
        console.log("=== AGRI SPECTRA RECIPES DATA ===");
        if (profiles.length > 0) {
            const allPayloads = profiles.map(p => buildProfilePayload(p));
            console.log("Current Profiles JSON:", JSON.stringify(allPayloads, null, 2));
        } else {
            console.log("No profiles available.");
        }
    }, [profiles.length]); // Added dependency on profiles.length so it prints on changes like adding/removing profiles too.

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

    const [isDeploying, setIsDeploying] = useState(false);
    const handleDeployProfile = async () => {
        if (!activeProfile) return;
        
        setIsDeploying(true);
        try {
            const payload = buildProfilePayload(activeProfile);
            console.log("Sending recipe payload to server:", payload);
            
            /* --- API CONNECTION COMMENTED OUT ---
            const response = await fetch('http://192.168.1.116:8080/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                console.warn('Backend rejected the recipe payload. Ensure backend is running and endpoint matches.');
            } else {
                console.log('Recipe deployed successfully to hardware.');
            }
            ------------------------------------- */
            
            // Set as deployed once success alert finishes (mock)
            setTimeout(() => {
                setDeployedProfileId(activeProfile.id);
                alert('Mock: Recipe deployed successfully to hardware!\nPayload viewable in console.');
            }, 500);
            
        } catch (error) {
            console.error('Network error deploying profile to backend:', error);
        } finally {
            setIsDeploying(false);
        }
    };

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
                    onDiscard={handleDiscardChanges}
                    onSave={handleSaveChanges}
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
                                {deployedProfileId === profile.id ? (
                                    <div className="w-5 h-5 rounded-full bg-[#4F95FF] flex items-center justify-center shrink-0">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full border border-[#2A2732] flex items-center justify-center shrink-0 group-hover:border-[#4F95FF]/50 transition-colors">
                                    </div>
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

            {/* Floating Action Buttons */}
            {activeProfile && (
                <div className="fixed bottom-10 right-12 flex items-center gap-6 z-30">
                    <button 
                        onClick={() => { setProfilesSnapshot(JSON.stringify(profiles)); setIsEditingProfile(true); }} 
                        className="border border-[#2A2732] hover:bg-white/5 bg-[#15121C] text-white px-6 py-4 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-3 shadow-lg hover:-translate-y-0.5 duration-200"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Modify Configuration Details
                    </button>
                    <button 
                        onClick={handleDeployProfile}
                        disabled={isDeploying}
                        className={`bg-[#A485FF] hover:bg-[#8e6bea] text-[#15121B] px-8 py-4 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors flex items-center gap-3 shadow-[0_0_20px_rgba(164,133,255,0.3)] hover:-translate-y-0.5 duration-200 ${isDeploying ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isDeploying ? 'Deploying...' : 'Use Profile'}
                        {!isDeploying && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 10.5L21 3"></path><path d="M16 3h5v5"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path></svg>}
                    </button>
                </div>
            )}
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
        <div className="w-[360px] lg:w-[400px] shrink-0 border border-[#2A2732] rounded-[2rem] bg-[#15121C] overflow-hidden flex flex-col relative relative">
            
            {/* Background Image Header */}
            <div className="absolute top-0 left-0 w-full h-[280px] pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 20%, transparent 100%)' }}>
                <img src={stage.image || agriImage} alt="" className="w-full h-full object-cover grayscale mix-blend-luminosity opacity-40 object-center" />
            </div>

            <div className="p-8 relative z-10">
                <div className="inline-flex items-center bg-[#4F95FF]/20 text-[#97CBFF] border border-[#4F95FF]/30 px-4 py-1.5 rounded-full text-[9px] font-bold tracking-widest mb-6 backdrop-blur">
                    {stage.stageLabel}
                </div>
                <h3 className="text-3xl font-bold whitespace-pre-line leading-snug text-white mb-6">
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
                <div className="mb-4">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-[10px] text-[#625D71] font-bold tracking-[0.2em] uppercase">LIGHT INTENSITY (PPFD)</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold font-mono text-white tracking-tighter">{stage.lightIntensity}</span>
                            <span className="text-[8px] text-[#625D71] font-bold tracking-widest uppercase">µmol/<br/>m²/s</span>
                        </div>
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

function RecipeEditor({ profile, onDiscard, onSave, onAddStage, onUpdateStageName, onRemoveStage, onUpdateLogic }) {
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
            <div className="mt-8 mb-4 px-8 py-5 border border-[#2A2732] rounded-[2rem] flex justify-between items-center bg-[#15121C]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#97CBFF] shadow-[0_0_8px_#97CBFF]"></div>
                        <span className="text-[10px] font-bold tracking-widest uppercase text-white">Status: Drafting</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#625D71]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        <span className="text-[10px] tracking-wide inline-block mt-0.5">Autosaved 2m ago</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <button onClick={onDiscard} className="text-[10px] font-bold tracking-widest uppercase text-[#625D71] hover:text-white transition-colors border border-[#2A2732] hover:border-white/20 rounded-full px-6 py-3.5">
                        Discard Changes
                    </button>
                    <button onClick={onSave} className="bg-[#97CBFF] hover:bg-[#82bcf6] text-[#15121B] px-10 py-3.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors shadow-[0_0_20px_rgba(151,203,255,0.3)]">
                        Save Recipe
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

    // Timeline logic
    const defaultTimeline = [
        { id: 1, time: '00:00', status: 'OFF', intensity: 0 },
        { id: 2, time: '06:00', status: 'ACTIVE', intensity: 100 },
        { id: 3, time: '00:00', status: 'OFF', intensity: 0 }
    ];
    const timeline = stage.timeline || defaultTimeline;

    const handleAddSegment = () => {
        const newTimeline = [...timeline, { id: Date.now(), time: '00:00', status: 'OFF', intensity: 0 }];
        onUpdateLogic('timeline', newTimeline);
    };

    const handleUpdateSegment = (id, key, value) => {
        const newTimeline = timeline.map(seg => seg.id === id ? { ...seg, [key]: value } : seg);
        onUpdateLogic('timeline', newTimeline);
    };

    const handleRemoveSegment = (id) => {
        const newTimeline = timeline.filter(seg => seg.id !== id);
        onUpdateLogic('timeline', newTimeline);
    };

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
                    <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#625D71] mb-6">Photoperiod Timeline (24H)</h4>

                    <div className="bg-[#15121C] border border-[#2A2732] rounded-3xl pt-2 pb-6 px-4 shadow-inner">
                        {/* Headers */}
                        <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-2 pb-3 px-6 border-b border-transparent">
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71] text-center">Time Interval</span>
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71] text-center">Status</span>
                            <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#625D71] text-center">Intensity</span>
                            <span></span>
                        </div>
                        <div className="flex flex-col gap-1">
                            {timeline.map((seg, i) => (
                                <div key={seg.id} className={`grid grid-cols-[1fr_1fr_1fr_24px] gap-2 py-3 px-6 items-center group rounded-xl transition ${i % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
                                    {/* Time */}
                                    <div className="flex justify-center">
                                        <input 
                                            type="time" 
                                            value={seg.time}
                                            onChange={(e) => handleUpdateSegment(seg.id, 'time', e.target.value)}
                                            className="bg-transparent text-[#97CBFF] font-mono font-bold text-[15px] tracking-wider text-center outline-none w-24 hover:bg-[#2A2732]/50 rounded cursor-text"
                                        />
                                    </div>
                                    
                                    {/* Status */}
                                    <div className="flex justify-center">
                                        <button 
                                            onClick={() => handleUpdateSegment(seg.id, 'status', seg.status === 'ACTIVE' ? 'OFF' : 'ACTIVE')}
                                            className={`text-[9px] px-3 py-1 rounded-full font-bold tracking-wider transition-colors ${seg.status === 'ACTIVE' ? 'bg-[#4F95FF]/20 border border-[#4F95FF]/30 text-[#97CBFF]' : 'bg-[#2A2732] text-[#625D71] border border-transparent hover:border-[#625D71]'}`}
                                        >
                                            {seg.status}
                                        </button>
                                    </div>
                                    
                                    {/* Intensity */}
                                    <div className="flex justify-center items-center">
                                        <div className="flex items-center gap-1 border border-transparent hover:border-[#2A2732] hover:bg-[#15121C] rounded px-2 w-16 justify-center transition-colors">
                                            <input 
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={seg.intensity}
                                                onChange={(e) => handleUpdateSegment(seg.id, 'intensity', parseInt(e.target.value) || 0)}
                                                className="bg-transparent text-white font-bold text-center text-sm w-8 outline-none hide-arrows"
                                            />
                                            <span className="text-white font-bold text-sm">%</span>
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={() => handleRemoveSegment(seg.id)}
                                            className="text-[#625D71] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold"
                                            title="Delete Segment"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Dashed Add Segment Button */}
                        <div className="px-6 mt-4 relative">
                            {/* Define styling to hide the number input arrows and style time picker */}
                            <style dangerouslySetInnerHTML={{__html: `
                                input[type=number].hide-arrows::-webkit-inner-spin-button, 
                                input[type=number].hide-arrows::-webkit-outer-spin-button { 
                                    -webkit-appearance: none; 
                                    margin: 0; 
                                }
                                input[type=number].hide-arrows {
                                    -moz-appearance: textfield;
                                }
                                input[type=time]::-webkit-calendar-picker-indicator {
                                    filter: invert(1);
                                    cursor: pointer;
                                    opacity: 0.7;
                                }
                                input[type=time]::-webkit-calendar-picker-indicator:hover {
                                    opacity: 1;
                                }
                            `}} />
                            <button onClick={handleAddSegment} className="w-full flex items-center justify-center gap-2 text-[#97CBFF] text-[10px] font-bold tracking-widest uppercase hover:bg-white/5 transition border border-dashed border-[#625D71] rounded-[2rem] py-3">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                Add Segment
                            </button>
                        </div>
                    </div>
                </div>

                {/* Spectra */}
                <div className="col-span-12 xl:col-span-5">
                    <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#625D71] mb-8">Spectrum Ratio (B:R:FR:W)</h4>
                    
                    <div className="space-y-6">
                        <div className="pb-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[#4F95FF] text-xs font-bold tracking-wide">Deep Blue (450nm)</span>
                                <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.blue}%</span>
                            </div>
                            <div className="w-full bg-[#15121C] rounded-full h-1.5 border border-[#2A2732]"></div>
                        </div>
                        <div className="pb-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[#FF4A4A] text-xs font-bold tracking-wide">Deep Red (660nm)</span>
                                <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.red}%</span>
                            </div>
                            <div className="w-full bg-[#15121C] rounded-full h-1.5 border border-[#2A2732]"></div>
                        </div>
                        <div className="pb-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[#FF2A85] text-xs font-bold tracking-wide">Far Red (730nm)</span>
                                <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.farRed}%</span>
                            </div>
                            <div className="w-full bg-[#15121C] rounded-full h-1.5 border border-[#2A2732]"></div>
                        </div>
                        <div className="pb-1">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[#FFFFFF] text-xs font-bold tracking-wide">Full Spectrum White</span>
                                <span className="text-white text-xs font-bold font-mono text-right w-10">{stage.white}%</span>
                            </div>
                            <div className="w-full bg-[#15121C] rounded-full h-1.5 border border-[#2A2732]"></div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-12 pr-4 lg:pr-10">
                        <span className="text-[10px] text-[#625D71] font-bold tracking-[0.2em] leading-snug">LIGHT INTENSITY<br/>(PPFD)</span>
                        <div className="flex items-center gap-4">
                            <div className="bg-[#15121C] border border-[#2A2732] rounded-full px-6 py-2 w-28 flex justify-end items-center">
                                <input 
                                    className="bg-transparent text-[#97CBFF] font-mono font-bold text-lg w-full text-right outline-none placeholder-[#625D71]"
                                    value={stage.lightIntensity || ''}
                                    onChange={(e) => {}}
                                />
                            </div>
                            <span className="text-[#625D71] text-[8px] font-bold tracking-[0.1em] leading-none uppercase">µmol/<br/>m²/s<br/><span className="text-[#4F95FF] tracking-[0.2em] mt-1 inline-block">TARGET</span></span>
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
                    
                    <div className="border border-dashed border-[#2A2732] rounded-2xl py-6 flex items-center justify-center w-full lg:max-w-md bg-white/[0.01]">
                        <span className="text-[#625D71] text-[10px] tracking-widest font-bold uppercase">Configuration Active</span>
                    </div>
                </div>
            </div>
            
            <div className="relative z-10 xl:h-full flex items-center shrink-0 pr-4 gap-4">
                <button onClick={onExpand} className="flex items-center gap-3 text-[#97CBFF] font-bold text-[10px] tracking-widest uppercase hover:text-white transition py-4 px-6 rounded-full hover:bg-white/5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Modify Parameters
                </button>
            </div>
        </div>
    );
}
