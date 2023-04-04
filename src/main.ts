/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';

import { PublishResult } from './contracts/collection';
import { generateFeaturesDocumentation, generateTemplateDocumentation } from './generateDocs';
import { addRepoTagForPublishedTag, ensureDevcontainerCliPresent, getGitHubMetadata, readdirLocal, validateFeatureSchema } from './utils';

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

    const disableRepoTagging = core.getInput('disable-repo-tagging').toLowerCase() === 'true';

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
        core.info('Publishing Features...');
        const publishedFeatures = await publish('feature', featuresBasePath, featuresOciRegistry, featuresNamespace, cliDebugMode);
        if (!publishedFeatures) {
            core.setFailed('(!) Failed to publish Features.');
            return;
        }

        // Add repo tag for newly published Feature(s) at the current commit.
        if (!disableRepoTagging) {
            const authToken = process.env.GITHUB_TOKEN;
            if (!authToken) {
                core.warning(`Repo tagging will be skipped because a 'GITHUB_TOKEN' is not set on this action.`);
            } else {
                // Add the repo tags
                for (const featureId in publishedFeatures) {
                    const version = publishedFeatures[featureId]?.version;
                    if (!version) {
                        core.debug(`No version available for '${featureId}', so no repo tag was added for Feature`);
                        continue;
                    }

                    await addRepoTagForPublishedTag('feature', featureId, version, authToken);
                }
            }
        }
    }

    if (shouldPublishTemplates) {
        core.info('Publishing Templates...');
        const publishedTemplates = await publish('template', templatesBasePath, templatesOciRegistry, templatesNamespace, cliDebugMode);
        if (!publishedTemplates) {
            core.setFailed('(!) Failed to publish Templates.');
            return;
        }

        // Add repo tag for newly published Template(s) at the current commit.
        if (!disableRepoTagging) {
            const authToken = process.env.GITHUB_TOKEN;
            if (!authToken) {
                core.warning(`Repo tagging will be skipped because a 'GITHUB_TOKEN' is not set on this action.`);
            } else {
                // Add the repo tags
                for (const templateId in publishedTemplates) {
                    const version = publishedTemplates[templateId]?.version;
                    if (!version) {
                        core.debug(`No version available for '${templateId}', so no repo tag was added for Feature`);
                        continue;
                    }

                    await addRepoTagForPublishedTag('template', templateId, version, authToken);
                }
            }
        }
    }

    // -- Generate Documentation

    if (shouldGenerateDocumentation && featuresBasePath) {
        core.info('Generating documentation for Features...');
        await generateFeaturesDocumentation(featuresBasePath, featuresOciRegistry, featuresNamespace);
    }

    if (shouldGenerateDocumentation && templatesBasePath) {
        core.info('Generating documentation for Templates...');
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
): Promise<{ [featureId: string]: PublishResult } | undefined> {
    // Ensures we have the devcontainer CLI installed.
    if (!(await ensureDevcontainerCliPresent(cliDebugMode))) {
        core.setFailed('Failed to install devcontainer CLI');
        return;
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
        const result: { [featureId: string]: PublishResult } = JSON.parse(res.stdout);
        return result;
    } catch (err: any) {
        core.setFailed(err?.message);
        return;
    }
}

run();
