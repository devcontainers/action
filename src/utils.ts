import * as github from '@actions/github'
import * as tar from 'tar'
import * as fs from 'fs'
import * as jsonc from 'jsonc-parser'
import * as core from '@actions/core'
import {Octokit} from '@octokit/core'
import {Api} from '@octokit/plugin-rest-endpoint-methods/dist-types/types'
import {promisify} from 'util'
import path from 'path'
import {FeaturesConfig, SourceInformation} from './contracts/feature'

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

export async function addMetadataToFeaturesJson(pathToFeatureDir: string) {
  const p = path.join(pathToFeatureDir, 'devcontainer-features.json')
  const featuresJson = (await (readLocalFile(p) ?? '')).toString()
  if (featuresJson === '') {
    core.setFailed('Could not parse devcontainer-features.json')
    return
  }

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

  // Read in features.json and append SourceInformation
  let parsed: FeaturesConfig = jsonc.parse(featuresJson)
  parsed = {...parsed, sourceInformation}

  // Write back to the file
  await writeLocalFile(p, JSON.stringify(parsed, undefined, 4))
}

// export async function setupTemplateOutputFolders(templateName: string) {
//   await mkdirLocal(`./temp-dir/manifest/${templateName}`, {
//     recursive: true
//   })
//   await mkdirLocal(`./temp-dir/containers/${templateName}`, {
//     recursive: true
//   })
//   await mkdirLocal(`./temp-dir/containers-readmes/${templateName}`, {
//     recursive: true
//   })
//   return './temp-dir'
// }

// export async function copyTemplateFiles(templateName: string) {
//   renameLocal(
//     `./definition-manifest.json`,
//     `./temp-dir/manifest/${templateName}/definition-manifest.json`
//   )
//   renameLocal(
//     `./.devcontainer/`,
//     `./temp-dir/containers/${templateName}/.devcontainer`
//   )
//   renameLocal(
//     `./README.md`,
//     `./temp-dir/containers-readmes/${templateName}/README.md`
//   )
// }

export async function getDefinitionsAndPackage(basePath: string) {
  let archives: string[] = []
  fs.readdir(basePath, (err, files) => {
    if (err) {
      core.error(err.message)
      core.setFailed(`failed to get list of definitions: ${err.message}`)
      return
    }

    files.forEach(file => {
      core.info(`definition ==> ${file}`)
      if (file !== '.' && file !== '..') {
        const archiveName = `devcontainer-definition-${file}.tgz`
        tarDirectory(`${basePath}/${file}`, archiveName)
        archives.push(archiveName)
      }
    })
  })

  return archives
}
