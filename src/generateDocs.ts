import * as fs from 'fs'
import * as github from '@actions/github'
import * as core from '@actions/core'
import * as path from 'path'
import {Feature} from './contracts/features'

export async function generateFeaturesDocumentation(basePath: string) {
  fs.readdir(basePath, (err, files) => {
    if (err) {
      core.error(err.message)
      core.setFailed(
        `failed to generate 'features' documentation ${err.message}`
      )
      return
    }

    files.forEach(f => {
      core.info(`Generating docs for feature '${f}'`)
      if (f !== '.' && f !== '..') {
        const readmePath = path.join(basePath, f, 'src', 'README.md')

        // Reads in feature.json
        const featureJsonPath = path.join(
          basePath,
          f,
          'src',
          'devcontainer-feature.json'
        )
        if (!fs.existsSync(featureJsonPath)) {
          core.error(
            `devcontainer-feature.json not found at path '${featureJsonPath}'`
          )
          return
        }
        const featureJson: Feature = JSON.parse(
          fs.readFileSync(featureJsonPath, 'utf8')
        )

        if (!featureJson.id) {
          core.error(
            `devconatiner-feature.json for feature '${f}' does not contain an 'id'`
          )
          return
        }

        const ref = github.context.ref
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        // Add tag if parseable
        let versionTag = 'latest'
        if (ref.includes('refs/tags/')) {
          versionTag = ref.replace('refs/tags/', '')
        }

        const generateOptionsMarkdown = () => {
          const options = featureJson.options
          if (!options) {
            return ''
          }

          const keys = Object.keys(options)
          const contents = keys
            .map(k => {
              const val = options[k]
              return `| ${k} | ${val.description || '-'} | ${
                val.type || '-'
              } | ${val.default || '-'} |`
            })
            .join('\n')

          return (
            '| Options Id | Description | Type | Default Value |' +
            '\n' +
            contents
          )
        }

        const newReadme = README_TEMPLATE.replace('#{nwo}', `${owner}/${repo}`)
          .replace('#{versionTag}', versionTag)
          .replace('#{featureId}', featureJson.id)
          .replace(
            '#{featureName}',
            featureJson.name
              ? `${featureJson.name} (${featureJson.id})`
              : `${featureJson.id}`
          )
          .replace(
            '#{featureDescription}',
            featureJson.description ? featureJson.description : ''
          )
          .replace('#{optionsTable}', generateOptionsMarkdown())

        // Remove previous readme
        if (fs.existsSync(readmePath)) {
          fs.unlinkSync(readmePath)
        }

        // Write new readme
        fs.writeFileSync(readmePath, newReadme)
      }
    })
  })
}

const README_TEMPLATE = `
# #{featureName}

#{featureDescription}

## Example Usage

\`\`\`json
"features: [
    "#{featureName}": {
        "id": "#{nwo}/#{featureId}@#{versionTag}",
        "options": {
            "version": "latest"
        }
    }
]
\`\`\`

## Options

#{optionsTable}

---

_Note: This is an auto-generated file. Please do not directly edit._
`
