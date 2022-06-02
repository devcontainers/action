/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import * as github from '@actions/github'
import {
  addMetadataToFeaturesJson,
  tarDirectory,
  getDefinitionsAndPackage
} from './utils'

async function run(): Promise<void> {
  core.debug('Reading input parameters...')

  const shouldPublishFeatures = core.getInput('publish-features') === 'true'
  const shouldPublishTemplate = core.getInput('publish-definitions') === 'true'

  if (shouldPublishFeatures) {
    core.info('Publishing features...')
    const featuresPath = core.getInput('path-to-features')
    packageFeatures(featuresPath)
  }

  if (shouldPublishTemplate) {
    core.info('Publishing template...')
    const basePathToDefinitions = core.getInput('path-to-definitions')
    packageDefinitions(basePathToDefinitions)
  }

  // TODO: Programatically generate `devcontainer-index.json ?
}

async function packageFeatures(featuresPath: string): Promise<void> {
  try {
    core.info('Inserting metadata onto devcontainer-features.json')
    await addMetadataToFeaturesJson(featuresPath)

    core.info('Starting to tar')
    await tarDirectory(featuresPath, 'devcontainer-features.tgz')

    core.info('Package features has finished.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function packageDefinitions(basePath: string): Promise<void> {
  try {
    // core.info('Asking vscdc to package template...')
    // const package = require('./vscdc/src/package').package;

    core.info(`Archiving all definitions in ${basePath}`)
    const definitionArchives = await getDefinitionsAndPackage(basePath)

    core.info('Package definition has finished.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

// Kick off execution
run()
