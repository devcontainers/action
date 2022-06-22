import { Feature } from './features';
import { Template } from './templates';

export interface SourceInformation {
    source: string; // local, github, tarball
    owner?: string;
    repo?: string;
    tag?: string;
    ref?: string;
    sha?: string;
}

export interface DevContainerCollectionMetadata {
    sourceInformation: SourceInformation;
    features: Feature[];
    templates: Template[];
}

export type IOption =
    | {
          type: 'boolean';
          default?: boolean;
          description?: string;
      }
    | {
          type: 'string';
          enum?: string[];
          default?: string;
          description?: string;
      }
    | {
          type: 'string';
          proposals?: string[];
          default?: string;
          description?: string;
      };
