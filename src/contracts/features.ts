export interface Feature {
  id: string
  name: string
  description?: string
  filename?: string
  runApp?: string
  runParams?: string
  infoString?: string
  tempLocalPath?: string
  consecutiveId?: string
  install?: Record<string, string>
  documentationURL?: string
  licenseURL?: string
  options?: Record<string, FeatureOption>
  containerEnv?: Record<string, string>
  mounts?: Mount[]
  init?: boolean
  privileged?: boolean
  capAdd?: string[]
  securityOpt?: string[]
  entrypoint?: string
  include?: string[]
  exclude?: string[]
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
  external?: boolean
}
