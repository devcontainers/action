import { IOption } from './collection';

export interface Feature {
    id: string;
    name: string;
    description?: string;
    filename?: string;
    runApp?: string;
    runParams?: string;
    infoString?: string;
    tempLocalPath?: string;
    consecutiveId?: string;
    install?: Record<string, string>;
    documentationURL?: string;
    licenseURL?: string;
    options?: Record<string, IOption>;
    containerEnv?: Record<string, string>;
    mounts?: (Mount|string)[];
    init?: boolean;
    privileged?: boolean;
    capAdd?: string[];
    securityOpt?: string[];
    entrypoint?: string;
    include?: string[];
    exclude?: string[];
}

export interface Mount {
    type: 'bind' | 'volume';
    source: string;
    target: string;
    external?: boolean;
}
