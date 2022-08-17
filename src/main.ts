/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import { generateFeaturesDocumentation } from './generateDocs';
import { ensureDevcontainerCliPresent, getGitHubMetadata } from './utils';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
    core.debug('Reading input parameters...');

    // Read inputs
    const shouldPublishFeatures = core.getInput('publish-features').toLowerCase() === 'true';
    const shouldGenerateDocumentation = core.getInput('generate-docs').toLowerCase() === 'true';

    const featuresBasePath = core.getInput('base-path-to-features');

    const sourceMetadata = getGitHubMetadata();

    const inputOciRegistry = core.getInput('oci-registry');
    const ociRegistry = inputOciRegistry && inputOciRegistry !== '' ? inputOciRegistry : 'ghcr.io';

    const inputNamespace = core.getInput('namespace');
    const namespace = inputNamespace && inputNamespace !== '' ? inputNamespace : `${sourceMetadata.owner}/${sourceMetadata.repo}`;

    const cliDebugMode = core.getInput('devcontainer-cli-debug-mode').toLowerCase() === 'true';

    // -- Publish

    if (shouldPublishFeatures) {
        core.info('Publishing features...');
        await publishFeatures(featuresBasePath, ociRegistry, namespace, cliDebugMode);
    }

    // -- Generate Documentation

    if (shouldGenerateDocumentation && featuresBasePath) {
        core.info('Generating documentation for features...');
        await generateFeaturesDocumentation(featuresBasePath, ociRegistry, namespace);
    }
}

async function publishFeatures(basePath: string, ociRegistry: string, namespace: string, cliDebugMode = false): Promise<boolean> {
    // Ensures we have the devcontainer CLI installed.
    if (!(await ensureDevcontainerCliPresent(cliDebugMode))) {
        core.setFailed('Failed to install devcontainer CLI');
        return false;
    }

    try {
        let cmd: string = 'devcontainer';
        let args: string[] = ['features', 'publish', '-r', ociRegistry, '-n', namespace, basePath];
        if (cliDebugMode) {
            cmd = 'npx';
            args = ['-y', './devcontainer.tgz', ...args];
        }

        const res = await exec.getExecOutput(cmd, args, {
            ignoreReturnCode: true
        });
        return res.exitCode === 0;
    } catch (err: any) {
        core.setFailed(err?.message);
        return false;
    }
}

run();
