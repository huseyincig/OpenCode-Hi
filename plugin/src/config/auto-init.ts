// Compatibility wrappers for explicit Hi child-role model preferences.
// Canonical project routing mutation lives in project-settings.ts so runtime
// settings transactions share one atomic read/validate/merge/persist owner.

import {type ModelRoutedChildRole} from "./schema.js"
import {applyProjectSettings} from "./project-settings.js"

export function setProjectRoleModels(projectRoot:string,role:ModelRoutedChildRole,models:string[]):{path:string;roleModels:Record<string,string[]>}{
  const result=applyProjectSettings(projectRoot,{roleModels:{[role]:models.length?models:null}})
  return{path:result.path,roleModels:result.roleModels}
}
