import {Feature} from './features'

export interface SourceInformation {
  source: string // local, github, tarball
  owner?: string
  repo?: string
  tag?: string
  ref?: string
  sha?: string
}

export interface DevContainerCollectionMetadata {
  sourceInformation: SourceInformation
  features: Feature[]
  templates: []
}
