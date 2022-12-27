/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';

import { generateFeaturesDocumentation, generateTemplateDocumentation } from './generateDocs';
import { ensureDevcontainerCliPresent, getGitHubMetadata, readdirLocal, validateFeatureSchema } from './utils';

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

    const disableSchemaValidationAsError = core.getInput('disable-schema-validation').toLowerCase() === 'true';
    const validateOnly = core.getInput('validate-only').toLowerCase() === 'true';

    // -- Publish

    if (shouldPublishFeatures && shouldPublishTemplates) {
        core.setFailed('(!) Features and Templates should be published from different repositories.');
        return;
    }

    if ((shouldPublishFeatures && validateOnly) || (shouldPublishTemplates && validateOnly)) {
        core.setFailed('(!) publishing steps and "validateOnly" are mutually exclusive.');
        return;
    }

    if (shouldGenerateDocumentation && featuresBasePath && templatesBasePath) {
        core.setFailed('(!) Features and Templates should exist in different repositories.');
        return;
    }

    if (shouldPublishFeatures || validateOnly) {
        core.info('Validating Feature metadata...');
        if (!(await prePublish('feature', featuresBasePath))) {

            if (disableSchemaValidationAsError) {
                core.warning('Failed to validate Feature metadata. NOTE: This warning will be a fatal error in future releases.')
            } else {
                core.setFailed('(!) Failed to validate Feature metadata.');
                return;
            }
        }
    }

    if (shouldPublishFeatures) {
        core.info('Publishing features...');
        if (!(await publish('feature', featuresBasePath, featuresOciRegistry, featuresNamespace, cliDebugMode))) {
            core.setFailed('(!) Failed to publish features.');
            return;
        }
    }

    if (shouldPublishTemplates) {
        core.info('Publishing templates...');
        if (!(await publish('template', templatesBasePath, templatesOciRegistry, templatesNamespace, cliDebugMode))) {
            core.setFailed('(!) Failed to publish templates.');
            return;
        }
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

async function prePublish(collectionType: 'feature' | 'template', basePath: string): Promise<boolean> {
    let hasFailed = false;

    // Iterate each (Feature|Template) in 'basePath'
    for (const folder of await readdirLocal(basePath)) {
        const pathToArtifact = path.join(basePath, folder);

        if (collectionType === 'feature') {
            if (!await validateFeatureSchema(pathToArtifact)) {
                hasFailed = true;
            }
        }

        // if (collectionType == 'template') { }
    }

    return !hasFailed;
}

async function publish(
    collectionType: 'feature' | 'template',
    basePath: string,
    ociRegistry: string,
    namespace: string,
    cliDebugMode = false
): Promise<boolean> {
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

        // Fails on non-zero exit code from the invoked process
        const res = await exec.getExecOutput(cmd, args, {});
        return res.exitCode === 0;
    } catch (err: any) {
        core.setFailed(err?.message);
        return false;
    }
}

run();
