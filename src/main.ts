/*--------------------------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
 *-------------------------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'
import {
  addCollectionsMetadataFile,
  getFeaturesAndPackage,
  getTemplatesAndPackage
} from './utils'

async function run(): Promise<void> {
  core.debug('Reading input parameters...')

  const shouldPublishFeatures =
    core.getInput('publish-features').toLowerCase() === 'true'
  const shouldPublishTemplate =
    core.getInput('publish-templates').toLowerCase() === 'true'

  if (shouldPublishFeatures) {
    core.info('Publishing features...')
    const featuresBasePath = core.getInput('base-path-to-features')
    await packageFeatures(featuresBasePath)
  }

  if (shouldPublishTemplate) {
    core.info('Publishing template...')
    const basePathToDefinitions = core.getInput('base-path-to-templates')
    await packageTemplates(basePathToDefinitions)
  }

  // TODO: Programatically add feature/template fino with relevant metadata for UX clients.
  core.info('Generation metadata file: devcontainer-collection.json')
  await addCollectionsMetadataFile()
}

async function packageFeatures(basePath: string): Promise<void> {
  try {
    core.info(`Archiving all features in ${basePath}`)
    await getFeaturesAndPackage(basePath)

    core.info('Packaging features has finished.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function packageTemplates(basePath: string): Promise<void> {
  try {
    core.info(`Archiving all templated in ${basePath}`)
    await getTemplatesAndPackage(basePath)

    core.info('Packaging templates has finished.')
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

// Kick off execution
run()
