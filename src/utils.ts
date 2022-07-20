import * as github from '@actions/github';
// import * as tar from 'tar';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as child_process from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { DevContainerCollectionMetadata, GitHubMetadata } from './contracts/collection';
import { Feature } from './contracts/features';
import { Template } from './contracts/templates';

export const readLocalFile = promisify(fs.readFile);
export const writeLocalFile = promisify(fs.writeFile);
export const mkdirLocal = promisify(fs.mkdir);
export const renameLocal = promisify(fs.rename);

// Filter what gets included in the tar.c
// const filter = (file: string, _: tar.FileStat) => {
//     // Don't include the archive itself.
//     if (file === './devcontainer-features.tgz') {
//         return false;
//     }
//     return true;
// };

// export async function tarDirectory(path: string, tgzName: string) {
//     return tar.create({ file: tgzName, C: path, filter }, ['.']).then(_ => {
//         core.info(`Compressed ${path} directory to file ${tgzName}`);
//     });
// }

function getGitHubMetadata() {
    // Insert github repo metadata
    const ref = github.context.ref;
    let sourceInformation: GitHubMetadata = {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        ref,
        sha: github.context.sha
    };

    // Add tag if parseable
    if (ref.includes('refs/tags/')) {
        const tag = ref.replace('refs/tags/', '');
        sourceInformation = { ...sourceInformation, tag };
    }

    return sourceInformation;
}

export async function addCollectionsMetadataFile(featuresMetadata: Feature[] | undefined, templatesMetadata: Template[] | undefined) {
    const p = path.join('.', 'devcontainer-collection.json');

    const sourceInformation = getGitHubMetadata();

    const metadata: DevContainerCollectionMetadata = {
        sourceInformation,
        features: featuresMetadata || [],
        templates: templatesMetadata || []
    };

    // Write to the file
    await writeLocalFile(p, JSON.stringify(metadata, undefined, 4));
}

export async function getFeaturesAndPackage(basePath: string, publishToNPM = false): Promise<Feature[] | undefined> {
    const featureDirs = fs.readdirSync(basePath);
    let metadatas: Feature[] = [];
    const exec = promisify(child_process.exec);

    await Promise.all(
        featureDirs.map(async (f: string) => {
            core.info(`feature ==> ${f}`);
            if (!f.startsWith('.')) {
                const featureFolder = path.join(basePath, f);

                const featureJsonPath = path.join(featureFolder, 'devcontainer-feature.json');

                if (!fs.existsSync(featureJsonPath)) {
                    core.error(`Feature '${f}' is missing a devcontainer-feature.json`);
                    core.setFailed('All features must have a devcontainer-feature.json');
                    return;
                }

                const featureMetadata: Feature = JSON.parse(fs.readFileSync(featureJsonPath, 'utf8'));

                if (!featureMetadata.id || !featureMetadata.version) {
                    core.error(`Feature '${f}' is must defined an id and version`);
                    core.setFailed('Incomplete devcontainer-feature.json');
                }

                metadatas.push(featureMetadata);

                const sourceInfo = getGitHubMetadata();

                // Adds a package.json file to the feature folder
                const packageJsonPath = path.join(featureFolder, 'package.json');
                if (publishToNPM) {
                    core.info(`Publishing to NPM`);
                    if (!sourceInfo.tag) {
                        core.error(`Feature ${f} is missing a tag! Cannot publish to NPM.`);
                        core.setFailed('All features published to NPM must be tagged with a version');
                    }

                    const packageJsonObject = {
                        name: `@${sourceInfo.owner}/${f}`,
                        version: featureMetadata.version,
                        description: `${featureMetadata.description ?? 'My cool feature'}`,
                        author: `${sourceInfo.owner}`,
                        "keywords": [
                            "devcontainer-features"
                          ],
                    };
                    await writeLocalFile(packageJsonPath, JSON.stringify(packageJsonObject, undefined, 4));

                    // const tarData = await pac.tarball(featureFolder);
                    // const archiveName = `${sourceInfo.owner}-${sourceInfo.repo}-${f}.tgz`; // TODO: changed this!
                    // TODO: Old way, GitHub release
                    // await tarDirectory(featureFolder, archiveName);

                    core.info(`Feature Folder is: ${featureFolder}`);

                    // Run npm pack, which 'tars' the folder
                    const packageName = await exec(`npm pack ./${featureFolder}`);
                    if (packageName.stderr) {
                        core.error(`${packageName.stderr.toString()}`);
                    }

                    const publishOutput = await exec(`npm publish --access public "${packageName.stdout.trim()}"`);
                    core.info(publishOutput.stdout);
                    if (publishOutput.stderr) {
                        core.error(`${publishOutput.stderr}`);
                    }
                }
            }
        })
    );

    if (metadatas.length === 0) {
        core.setFailed('No features found');
        return;
    }

    return metadatas;
}

export async function getTemplatesAndPackage(basePath: string): Promise<Template[] | undefined> {
    const templateDirs = fs.readdirSync(basePath);
    let metadatas: Template[] = [];

    await Promise.all(
        templateDirs.map(async (t: string) => {
            core.info(`template ==> ${t}`);
            if (!t.startsWith('.')) {
                const templateFolder = path.join(basePath, t);
                const archiveName = `devcontainer-template-${t}.tgz`;

                // await tarDirectory(templateFolder, archiveName);

                const templateJsonPath = path.join(templateFolder, 'devcontainer-template.json');

                if (!fs.existsSync(templateJsonPath)) {
                    core.error(`Template '${t}' is missing a devcontainer-template.json`);
                    core.setFailed('All templates must have a devcontainer-template.json');
                    return;
                }

                const templateMetadata: Template = JSON.parse(fs.readFileSync(templateJsonPath, 'utf8'));
                metadatas.push(templateMetadata);
            }
        })
    );

    if (metadatas.length === 0) {
        core.setFailed('No templates found');
        return;
    }

    return metadatas;
}
