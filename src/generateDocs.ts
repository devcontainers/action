import * as fs from 'fs';
import * as core from '@actions/core';
import * as path from 'path';
import { getGitHubMetadata } from './utils';

const FEATURES_README_TEMPLATE = `
# #{Name}

#{Description}

## Example Usage

\`\`\`json
"features": {
    "#{Registry}/#{Namespace}/#{Id}:#{Version}": {}
}
\`\`\`

#{OptionsTable}

#{Notes}

---

_Note: This file was auto-generated from the [devcontainer-feature.json](#{RepoUrl}).  Add additional notes to a \`NOTES.md\`._
`;

const TEMPLATE_README_TEMPLATE = `
# #{Name}

#{Description}

#{OptionsTable}

#{Notes}

---

_Note: This file was auto-generated from the [devcontainer-template.json](#{RepoUrl}).  Add additional notes to a \`NOTES.md\`._
`;

export async function generateFeaturesDocumentation(basePath: string, ociRegistry: string, namespace: string) {
    await _generateDocumentation(basePath, FEATURES_README_TEMPLATE, 'devcontainer-feature.json', ociRegistry, namespace);
}

export async function generateTemplateDocumentation(basePath: string) {
    await _generateDocumentation(basePath, TEMPLATE_README_TEMPLATE, 'devcontainer-template.json');
}

async function _generateDocumentation(basePath: string, readmeTemplate: string, metadataFile: string, ociRegistry: string = '', namespace: string = '') {
    const directories = fs.readdirSync(basePath);

    await Promise.all(
        directories.map(async (f: string) => {
            if (!f.startsWith('.')) {
                const readmePath = path.join(basePath, f, 'README.md');

                // Reads in feature.json
                const jsonPath = path.join(basePath, f, metadataFile);

                if (!fs.existsSync(jsonPath)) {
                    core.info(`(!) Warning: ${metadataFile} not found at path '${jsonPath}'. Skipping...`);
                    return;
                }

                let parsedJson: any | undefined = undefined;
                try {
                    parsedJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                } catch (err) {
                    core.error(`Failed to parse ${jsonPath}: ${err}`);
                    return;
                }

                if (!parsedJson || !parsedJson?.id) {
                    core.error(`${metadataFile} for '${f}' does not contain an 'id'`);
                    return;
                }

                const srcInfo = getGitHubMetadata();

                // Add version
                let version = 'latest';
                const parsedVersion: string = parsedJson?.version;
                if (parsedVersion) {
                    // example - 1.0.0
                    const splitVersion = parsedVersion.split('.');
                    version = splitVersion[0];
                }

                const generateOptionsMarkdown = () => {
                    const options = parsedJson?.options;
                    if (!options) {
                        return '';
                    }

                    const keys = Object.keys(options);
                    const contents = keys
                        .map(k => {
                            const val = options[k];

                            const desc = val.description || '-';
                            const type = val.type || '-';
                            const def = val.default !== '' ? val.default : '-';

                            return `| ${k} | ${desc} | ${type} | ${def} |`;
                        })
                        .join('\n');

                    return '## Options\n\n' + '| Options Id | Description | Type | Default Value |\n' + '|-----|-----|-----|-----|\n' + contents;
                };

                const generateNotesMarkdown = () => {
                    const notesPath = path.join(basePath, f, 'NOTES.md');
                    return fs.existsSync(notesPath) ? fs.readFileSync(path.join(notesPath), 'utf8') : '';
                };

                let urlToConfig = `${metadataFile}`;
                const basePathTrimmed = basePath.startsWith('./') ? basePath.substring(2) : basePath;
                if (srcInfo.owner && srcInfo.repo) {
                    urlToConfig = `https://github.com/${srcInfo.owner}/${srcInfo.repo}/blob/main/${basePathTrimmed}/${f}/${metadataFile}`;
                }

                let header;
                const isDeprecated = parsedJson?.deprecated;
                const hasLegacyIds = parsedJson?.legacyIds && parsedJson?.legacyIds.length > 0;

                if (isDeprecated || hasLegacyIds) {
                    header = '### **IMPORTANT NOTE**\n';

                    if (isDeprecated) {
                        header += `- **This Feature is deprecated, and will no longer receive any further updates/support.**\n`;
                    }

                    if (hasLegacyIds) {
                        const formattedLegacyIds = parsedJson.legacyIds.map((legacyId: string) => `'${legacyId}'`);
                        header += `- **Ids used to publish this Feature in the past - ${formattedLegacyIds.join(', ')}**\n`;
                    }
                }

                let newReadme = readmeTemplate
                    // Templates & Features
                    .replace('#{Id}', parsedJson.id)
                    .replace('#{Name}', parsedJson.name ? `${parsedJson.name} (${parsedJson.id})` : `${parsedJson.id}`)
                    .replace('#{Description}', parsedJson.description ?? '')
                    .replace('#{OptionsTable}', generateOptionsMarkdown())
                    .replace('#{Notes}', generateNotesMarkdown())
                    .replace('#{RepoUrl}', urlToConfig)
                    // Features Only
                    .replace('#{Registry}', ociRegistry)
                    .replace('#{Namespace}', namespace)
                    .replace('#{Version}', version);

                if (header) {
                    newReadme = header + newReadme;
                }

                // Remove previous readme
                if (fs.existsSync(readmePath)) {
                    fs.unlinkSync(readmePath);
                }

                // Write new readme
                fs.writeFileSync(readmePath, newReadme);
            }
        })
    );
}
