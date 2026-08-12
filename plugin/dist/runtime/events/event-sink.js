export function runtimeSignal(type, mission_id, extra = {}) {
    return { type, mission_id, at: Date.now(), ...extra };
}
