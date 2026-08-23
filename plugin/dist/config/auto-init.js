// Compatibility wrappers for explicit Hi child-role model preferences.
// Canonical project routing mutation lives in project-settings.ts so runtime
// settings transactions share one atomic read/validate/merge/persist owner.
import { applyProjectSettings } from "./project-settings.js";
export function setProjectRoleModels(projectRoot, role, models) {
    const result = applyProjectSettings(projectRoot, { roleModels: { [role]: models.length ? models : null } });
    return { path: result.path, roleModels: result.roleModels };
}
