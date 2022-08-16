/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import { Feature } from './contracts/features';
import { Template } from './contracts/templates';
import { generateFeaturesDocumentation, generateTemplateDocumentation } from './generateDocs';
import { fetchDevcontainerCli as ensureDevcontainerCliPresent, getGitHubMetadata } from './utils';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
    core.debug('Reading input parameters...');

    // Read inputs
    const shouldPublishFeatures = core.getInput('publish-features').toLowerCase() === 'true';
    const shouldGenerateDocumentation = core.getInput('generate-docs').toLowerCase() === 'true';

    const featuresBasePath = core.getInput('base-path-to-features');

    const ociRegistry = core.getInput('oci-registry');
    const namespace = core.getInput('features-namespace');

    if (shouldPublishFeatures) {
        core.info('Publishing features...');
        await publishFeatures(featuresBasePath);
    }

    // -- Generate Documentation

    if (shouldGenerateDocumentation && featuresBasePath) {
        core.info('Generating documentation for features...');
        await generateFeaturesDocumentation(featuresBasePath, ociRegistry, namespace);
    }
}

async function publishFeatures(basePath: string): Promise<boolean> {
    // Ensures we have the devcontainer CLI installed.
    if (!(await ensureDevcontainerCliPresent())) {
        core.setFailed('Failed to install devcontainer CLI');
        return false;
    }

    const sourceMetadata = getGitHubMetadata();

    try {
        core.info('Fetching the latest @devcontainer/cli...');
        const cmd: string = 'devcontainer';
        const args: string[] = ['features', 'publish', '-r', 'ghcr.io', '-n', `${sourceMetadata.owner}/${sourceMetadata.repo}`, basePath];

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
