import * as github from '@actions/github';
// import * as tar from 'tar';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as child_process from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { DevContainerCollectionMetadata, SourceInformation } from './contracts/collection';
import { Feature } from './contracts/features';
import { Template } from './contracts/templates';
import * as libpub from 'libnpmpublish';
import * as pac from 'pacote';

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

function getSourceInfo() {
    // Insert github repo metadata
    const ref = github.context.ref;
    let sourceInformation: SourceInformation = {
        source: 'github',
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

    const sourceInformation = getSourceInfo();

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
                metadatas.push(featureMetadata);

                const sourceInfo = getSourceInfo();

                // Adds a package.json file to the feature folder
                const packageJsonPath = path.join(featureFolder, 'package.json');
                if (publishToNPM) {
                    if (!sourceInfo.tag) {
                        core.error(`Feature ${f} is missing a tag! Cannot publish to NPM.`);
                        core.setFailed('All features published to NPM must be tagged with a version');
                    }

                    const packageJsonObject = {
                        name: `@${sourceInfo.owner}/${sourceInfo.repo}-${f}`,
                        version: `${sourceInfo.tag}`,
                        description: `${featureMetadata.description ?? 'My cool feature'}`,
                        repository: {
                            type: 'git',
                            url: `https://github.com/${sourceInfo.owner}/${sourceInfo.repo}.git`
                        },
                        author: `${sourceInfo.owner}`
                    };
                    await writeLocalFile(packageJsonPath, JSON.stringify(packageJsonObject, undefined, 4));

                    // const output = child_process.execSync(`npm publish ${archiveName} --access public`);
                    // core.info(output.toString());
                    const tarData = await pac.tarball(featureFolder);
                    await libpub.publish(packageJsonObject, tarData, {});
                }

                // TODO: Old way, GitHub release
                // const archiveName = `${sourceInfo.owner}-${sourceInfo.repo}-${f}.tgz`; // TODO: changed this!
                // await tarDirectory(featureFolder, archiveName);
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
