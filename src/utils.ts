import * as github from '@actions/github'
import * as tar from 'tar'
import * as fs from 'fs'
import * as core from '@actions/core'
import {promisify} from 'util'
import path from 'path'
import {
  DevContainerCollectionMetadata,
  SourceInformation
} from './contracts/collection'
import {Feature} from './contracts/features'

export const readLocalFile = promisify(fs.readFile)
export const writeLocalFile = promisify(fs.writeFile)
export const mkdirLocal = promisify(fs.mkdir)
export const renameLocal = promisify(fs.rename)

// Filter what gets included in the tar.c
const filter = (file: string, _: tar.FileStat) => {
  // Don't include the archive itself.
  if (file === './devcontainer-features.tgz') {
    return false
  }
  return true
}

export async function tarDirectory(path: string, tgzName: string) {
  return tar.create({file: tgzName, C: path, filter}, ['.']).then(_ => {
    core.info(`Compressed ${path} directory to file ${tgzName}`)
  })
}

export async function addCollectionsMetadataFile(
  featuresMetadata: Feature[] | undefined,
  templatesMetadata: undefined
) {
  const p = path.join('.', 'devcontainer-collection.json')

  // Insert github repo metadata
  const ref = github.context.ref
  let sourceInformation: SourceInformation = {
    source: 'github',
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    ref,
    sha: github.context.sha
  }

  // Add tag if parseable
  if (ref.includes('refs/tags/')) {
    const tag = ref.replace('refs/tags/', '')
    sourceInformation = {...sourceInformation, tag}
  }

  const metadata: DevContainerCollectionMetadata = {
    sourceInformation,
    features: featuresMetadata || [],
    templates: templatesMetadata || []
  }

  // Write to the file
  await writeLocalFile(p, JSON.stringify(metadata, undefined, 4))
}

export async function getFeaturesAndPackage(
  basePath: string
): Promise<Feature[] | undefined> {
  const featureDirs = fs.readdirSync(basePath)
  let metadatas: Feature[] = []

  await Promise.all(
    featureDirs.map(async (f: string) => {
      core.info(`feature ==> ${f}`)
      if (f !== '.' && f !== '..') {
        const featureFolder = path.join(basePath, f)
        const archiveName = `${f}.tgz`

        await tarDirectory(`${basePath}/${f}`, archiveName)

        const featureJsonPath = path.join(
          featureFolder,
          'devcontainer-feature.json'
        )

        if (!fs.existsSync(featureJsonPath)) {
          core.error(`Feature ${f} is missing a devcontainer-feature.json`)
          core.setFailed('All features must have a devcontainer-feature.json')
          return
        }

        const featureMetadata: Feature = JSON.parse(
          fs.readFileSync(featureJsonPath, 'utf8')
        )
        metadatas.push(featureMetadata)
      }
    })
  )

  if (metadatas.length === 0) {
    core.setFailed('No features found')
    return
  }

  return metadatas
}

export async function getTemplatesAndPackage(basePath: string) {
  let archives: string[] = []
  fs.readdir(basePath, (err, files) => {
    if (err) {
      core.error(err.message)
      core.setFailed(`failed to get list of templates: ${err.message}`)
      return
    }

    files.forEach(file => {
      core.info(`template ==> ${file}`)
      if (file !== '.' && file !== '..') {
        const archiveName = `devcontainer-definition-${file}.tgz`
        tarDirectory(`${basePath}/${file}`, archiveName)
        archives.push(archiveName)
      }
    })
  })

  return archives
}
