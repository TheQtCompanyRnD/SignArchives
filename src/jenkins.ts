export interface Job {
  _class: string
  actions: Action[]
  artifacts: Artifact[]
  building: boolean
  description: string
  displayName: string
  duration: number
  estimatedDuration: number
  executor?: string
  fullDisplayName: string
  id: string
  inProgress: boolean
  keepLog: boolean
  number: number
  queueId: number
  result: string
  timestamp: number
  url: string
  builtOn: string
  changeSet: ChangeSet
  runs: Run[]
}

export interface Artifact {
  displayPath: string
  fileName: string
  relativePath: string
}

export interface Action {
  _class?: string
  parameters?: Parameter[]
}

export interface Parameter {
  _class: string
  name: string
  value?: string
}

export interface ChangeSet {
  _class: string
}

export interface Run {
  number: number
  url: string
}

export interface MatrixRun {
  _class: string
  actions: Action[]
  artifacts: Artifact[]
  building: boolean
  description: string
  displayName: string
  duration: number
  estimatedDuration: number
  executor: string
  fullDisplayName: string
  id: string
  inProgress: boolean
  keepLog: boolean
  number: number
  queueId: number
  result: string
  timestamp: number
  url: string
  builtOn: string
  changeSet: ChangeSet
}

export interface Action {
  _class?: string
  parameters?: Parameter[]
}

export interface Parameter {
  _class: string
  name: string
  value?: string
}

export interface Artifact {
  displayPath: string
  fileName: string
  relativePath: string
}

export interface ChangeSet {
  _class: string
}
