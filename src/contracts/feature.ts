export interface Feature {
  id: string
  name: string
  options?: Record<string, FeatureOption>
  buildArg?: string // old properties for temporary compatibility
  containerEnv?: Record<string, string>
  mounts?: Mount[]
  extensions?: string[]
  settings?: object
  init?: boolean
  privileged?: boolean
  capAdd?: string[]
  securityOpt?: string[]
  entrypoint?: string
  include?: string[]
  exclude?: string[]
  value: boolean | string | Record<string, boolean | string | undefined> // set programmatically
  included: boolean // set programmatically
  featureSetSrcHash?: string // set programatically
}

export type FeatureOption =
  | {
      type: 'boolean'
      default?: boolean
      description?: string
    }
  | {
      type: 'string'
      enum?: string[]
      default?: string
      description?: string
    }
  | {
      type: 'string'
      proposals?: string[]
      default?: string
      description?: string
    }

export interface Mount {
  type: 'bind' | 'volume'
  source: string
  target: string
}

export interface SourceInformation {
  source: string // local, github, tarball
  owner?: string
  repo?: string
  tag?: string
  ref?: string
  sha?: string
}

export interface FeaturesConfig {
  features: Feature[]
  dstFolder: string // set programatically
  featureSetFolderHashes: Set<string> // set programatically
  sourceInformation?: SourceInformation // set at feature packaging (GitHub Action)
}
