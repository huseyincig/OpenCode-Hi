import { buildMissionRuntimeProjection } from '../context/mission-runtime-projection.js';
import { projectControlDecision } from '../completion/control-projection.js';
/** Bounded user-facing mission projection. It owns no lifecycle or UI cache state. */
export function autonomousMissionUxView(mission, projectRoot) {
    const runtime = buildMissionRuntimeProjection(mission, undefined, projectRoot), control = projectControlDecision(mission, projectRoot);
    return {
        mission_id: mission.identity.mission_id, status: mission.identity.status, objective: runtime.objective,
        action: control.action, completion_ready: control.completion_ready, next_action: runtime.next_action,
        blockers: [...runtime.blockers], open_obligations: control.open_obligations.map(item => ({ ...item })),
        active_work: runtime.task_worker, verification: runtime.verification, authority: runtime.authority,
        user_controls: { settings_owner: 'hi_settings', decision_owner: 'HumanDecisionContract', completion_owner: 'MissionStore/evaluateCompletion' },
        claim_boundary: 'derived-from-canonical-runtime',
    };
}
