import type { SemanticContextSymbol } from '../../contracts/semantic-context.js'

export interface SemanticContextResult {
  symbols:SemanticContextSymbol[]
  text:string
  sourceChars:number
  contextChars:number
}

export interface SemanticContextAdapterInput {
  source:string
  file:string
  names?:string[]
  maxChars:number
}

export interface SemanticContextAdapter {
  languageIds():string[]
  supports(file:string):boolean
  extract(input:SemanticContextAdapterInput):SemanticContextResult
}
