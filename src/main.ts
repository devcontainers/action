/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import { generateFeaturesDocumentation, generateTemplateDocumentation } from './generateDocs';
import { ensureDevcontainerCliPresent, getGitHubMetadata } from './utils';
import * as exec from '@actions/exec';

async function run(): Promise<void> {
    core.debug('Reading input parameters...');

    // Read inputs
    const shouldGenerateDocumentation = core.getInput('generate-docs').toLowerCase() === 'true';
    const sourceMetadata = getGitHubMetadata();

    // Read inputs - Features
    const shouldPublishFeatures = core.getInput('publish-features').toLowerCase() === 'true';

    const featuresBasePath = core.getInput('base-path-to-features');

    const inputFeaturesOciRegistry = core.getInput('oci-registry');
    const featuresOciRegistry = !!inputFeaturesOciRegistry ? inputFeaturesOciRegistry : 'ghcr.io';

    const inputFeaturesNamespace = core.getInput('features-namespace');
    const featuresNamespace = !!inputFeaturesNamespace ? inputFeaturesNamespace : `${sourceMetadata.owner}/${sourceMetadata.repo}`;

    // Read inputs - Templates
    const shouldPublishTemplates = core.getInput('publish-templates').toLowerCase() === 'true';

    const templatesBasePath = core.getInput('base-path-to-templates');

    const inputTemplatesOciRegistry = core.getInput('oci-registry-for-templates');
    const templatesOciRegistry = !!inputTemplatesOciRegistry ? inputTemplatesOciRegistry : 'ghcr.io';

    const inputTemplateNamespace = core.getInput('templates-namespace');
    const templatesNamespace = !!inputTemplateNamespace ? inputTemplateNamespace : `${sourceMetadata.owner}/${sourceMetadata.repo}`;

    const cliDebugMode = core.getInput('devcontainer-cli-debug-mode').toLowerCase() === 'true';

    // -- Publish

    if (shouldPublishFeatures && shouldPublishTemplates) {
        core.setFailed('(!) Features and Templates should be published from different repositories.');
        return;
    }

    if (shouldGenerateDocumentation && featuresBasePath && templatesBasePath) {
        core.setFailed('(!) Features and Templates should exist in different repositories.');
        return;
    }

    if (shouldPublishFeatures) {
        core.info('Publishing features...');
        await publish('feature', featuresBasePath, featuresOciRegistry, featuresNamespace, cliDebugMode);
    }

    if (shouldPublishTemplates) {
        core.info('Publishing templates...');
        await publish('template', templatesBasePath, templatesOciRegistry, templatesNamespace, cliDebugMode);
    }

    // -- Generate Documentation

    if (shouldGenerateDocumentation && featuresBasePath) {
        core.info('Generating documentation for features...');
        await generateFeaturesDocumentation(featuresBasePath, featuresOciRegistry, featuresNamespace);
    }

    if (shouldGenerateDocumentation && templatesBasePath) {
        core.info('Generating documentation for templates...');
        await generateTemplateDocumentation(templatesBasePath);
    }
}

async function publish(collectionType: string, basePath: string, ociRegistry: string, namespace: string, cliDebugMode = false): Promise<boolean> {
    // Ensures we have the devcontainer CLI installed.
    if (!(await ensureDevcontainerCliPresent(cliDebugMode))) {
        core.setFailed('Failed to install devcontainer CLI');
        return false;
    }

    try {
        let cmd: string = 'devcontainer';
        let args: string[] = [`${collectionType}s`, 'publish', '-r', ociRegistry, '-n', namespace, basePath];
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
