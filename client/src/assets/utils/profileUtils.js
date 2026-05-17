import { API_BASE_URL } from '../../config';

/**
 * Fetch the deployed profile from the server API.
 * Returns the full profile object (with stages as array) or null.
 */
export async function fetchDeployedProfile() {
    try {
        const token = sessionStorage.getItem('token');
        const [deployedRes, profilesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/deployed-profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_BASE_URL}/api/light-profiles`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        if (deployedRes.ok && profilesRes.ok) {
            const { deployed_profile_id } = await deployedRes.json();
            const profiles = await profilesRes.json();
            if (deployed_profile_id !== null && deployed_profile_id !== undefined) {
                const raw = profiles.find(p => p.profile_id === deployed_profile_id);
                if (raw) return normalizeProfile(raw);
            }
        }
    } catch (e) {
        console.warn("Could not fetch deployed profile:", e);
    }
    return null;
}

/**
 * Fetch just the deployed profile ID from the server.
 * Returns the profile_id number or null.
 */
export async function fetchDeployedProfileId() {
    try {
        const token = sessionStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/api/deployed-profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const { deployed_profile_id } = await res.json();
            return deployed_profile_id;
        }
    } catch (e) {
        console.warn("Could not fetch deployed profile ID:", e);
    }
    return null;
}

/**
 * Normalize an API profile (stages stored as JSON object) into the
 * frontend format (stages as an array).
 *
 * API format:
 *   { profile_id: 1, profile_name: "...", stages: { "stage-1": {...}, "stage-2": {...} } }
 *
 * Frontend format:
 *   { id: 1, name: "...", stages: [{ name, blue, red, farRed, white, lightIntensity, timeline, ... }, ...] }
 */
function normalizeProfile(apiProfile) {
    if (!apiProfile) return null;

    const profile = {
        id: apiProfile.profile_id,
        name: apiProfile.profile_name,
        stages: []
    };

    // Parse stages JSON if it's a string
    let stagesObj = apiProfile.stages;
    if (typeof stagesObj === 'string') {
        try { stagesObj = JSON.parse(stagesObj); } catch { stagesObj = {}; }
    }

    if (!stagesObj || typeof stagesObj !== 'object') {
        return profile;
    }

    // Collect stage entries and sort by key (stage-1, stage-2, ...)
    const stageEntries = Object.entries(stagesObj)
        .filter(([key]) => key.startsWith('stage-'))
        .sort(([a], [b]) => {
            const numA = parseInt(a.replace('stage-', ''));
            const numB = parseInt(b.replace('stage-', ''));
            return numA - numB;
        });

    profile.stages = stageEntries.map(([, stageData]) => {
        // Convert period object back to timeline array
        const timeline = [];
        if (stageData.period && typeof stageData.period === 'object') {
            Object.entries(stageData.period)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([time, intensity]) => {
                    timeline.push({
                        id: Date.now() + Math.random(),
                        time,
                        status: intensity > 0 ? 'ACTIVE' : 'OFF',
                        intensity: intensity || 0
                    });
                });
        }

        return {
            id: Date.now() + Math.random(),
            name: stageData.name || 'Unknown',
            blue: stageData.blue || 0,
            red: stageData.red || 0,
            farRed: stageData.farRed || 0,
            white: stageData.white || 0,
            lightIntensity: stageData.ppfd || 0,
            leafCount: stageData.leaf || null,
            timeline: timeline.length > 0 ? timeline : undefined
        };
    });

    return profile;
}
