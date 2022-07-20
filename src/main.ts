/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core';
import { Feature } from './contracts/features';
import { Template } from './contracts/templates';
import { generateFeaturesDocumentation, generateTemplateDocumentation } from './generateDocs';
import { addCollectionsMetadataFile, getFeaturesAndPackage, getTemplatesAndPackage } from './utils';

export interface PackagingOptions {
    shouldTagIndividualFeatures: boolean;
    shouldPublishToNPM: boolean;
    shouldPublishReleaseArtifacts: boolean;
}

async function run(): Promise<void> {
    core.debug('Reading input parameters...');

    // Read inputs
    const shouldPublishFeatures = core.getInput('publish-features').toLowerCase() === 'true';
    const shouldPublishTemplates = core.getInput('publish-templates').toLowerCase() === 'true';
    const shouldGenerateDocumentation = core.getInput('generate-docs').toLowerCase() === 'true';

    // Experimental
    const shouldTagIndividualFeatures = core.getInput('tag-individual-features').toLowerCase() === 'true';
    const shouldPublishToNPM = core.getInput('publish-to-npm').toLowerCase() === 'true';
    const shouldPublishReleaseArtifacts = core.getInput('publish-release-artifacts').toLowerCase() === 'true';

    const opts: PackagingOptions = {
        shouldTagIndividualFeatures,
        shouldPublishToNPM,
        shouldPublishReleaseArtifacts
    };

    const featuresBasePath = core.getInput('base-path-to-features');
    const templatesBasePath = core.getInput('base-path-to-templates');

    let featuresMetadata: Feature[] | undefined = undefined;
    let templatesMetadata: Template[] | undefined = undefined;

    // -- Package Release Artifacts

    if (shouldPublishFeatures) {
        core.info('Publishing features...');
        featuresMetadata = await packageFeatures(featuresBasePath, opts);
    }

    if (shouldPublishTemplates) {
        core.info('Publishing template...');
        templatesMetadata = await packageTemplates(templatesBasePath);
    }

    // -- Generate Documentation

    if (shouldGenerateDocumentation && featuresBasePath) {
        core.info('Generating documentation for features...');
        await generateFeaturesDocumentation(featuresBasePath);
    }

    if (shouldGenerateDocumentation && templatesBasePath) {
        core.info('Generating documentation for templates...');
        await generateTemplateDocumentation(templatesBasePath);
    }

    // -- Programatically add feature/template metadata to collections file.

    core.info('Generating metadata file: devcontainer-collection.json');
    await addCollectionsMetadataFile(featuresMetadata, templatesMetadata);
}

async function packageFeatures(basePath: string, opts: PackagingOptions): Promise<Feature[] | undefined> {
    try {
        core.info(`Archiving all features in ${basePath}`);
        const metadata = await getFeaturesAndPackage(basePath, opts);
        core.info('Packaging features has finished.');
        return metadata;
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }

    return;
}

async function packageTemplates(basePath: string): Promise<Template[] | undefined> {
    try {
        core.info(`Archiving all templates in ${basePath}`);
        const metadata = await getTemplatesAndPackage(basePath);
        core.info('Packaging templates has finished.');
        return metadata;
    } catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
    }

    return;
}

run();
