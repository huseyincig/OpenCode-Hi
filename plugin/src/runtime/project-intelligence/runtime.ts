import { ProjectMethodologyLearningStore } from './methodology-learning.js'
import { ProjectTaskOutcomeMemoryStore } from './task-outcome-memory.js'
import { ProjectMemoryRuntime } from './project-memory.js'
import type {ProjectMemoryProvider} from '../../contracts/project-memory.js'

/**
 * Application-composition facade for Project Intelligence.
 *
 * The facade owns composition only. Each derived data class keeps its
 * existing storage owner and contract; this must not become a generic
 * project-memory store or a second Mission/Evidence/Context truth source.
 * Optional broad memory stays behind ProjectMemoryRuntime as a provider-owned,
 * advisory projection and is disabled when no provider is supplied.
 */
export class ProjectIntelligenceRuntime {
  readonly methodologyLearning:ProjectMethodologyLearningStore
  readonly taskOutcomeMemory:ProjectTaskOutcomeMemoryStore
  readonly projectMemory:ProjectMemoryRuntime

  constructor(readonly projectRoot:string,projectMemoryProvider?:ProjectMemoryProvider){
    this.methodologyLearning=new ProjectMethodologyLearningStore(projectRoot)
    this.taskOutcomeMemory=new ProjectTaskOutcomeMemoryStore(projectRoot)
    this.projectMemory=new ProjectMemoryRuntime(projectRoot,projectMemoryProvider)
  }
}
