import * as github from '@actions/github';
import * as tar from 'tar';
import * as fs from 'fs';
import * as core from '@actions/core';
import * as child_process from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { DevContainerCollectionMetadata, GitHubMetadata } from './contracts/collection';
import { Feature } from './contracts/features';
import { Template } from './contracts/templates';
import { PackagingOptions } from './main';

export const readLocalFile = promisify(fs.readFile);
export const writeLocalFile = promisify(fs.writeFile);
export const mkdirLocal = promisify(fs.mkdir);
export const renameLocal = promisify(fs.rename);

// Filter what gets included in the tar.c
const filter = (file: string, _: tar.FileStat) => {
    // Don't include the archive itself.
    if (file === './devcontainer-features.tgz') {
        return false;
    }
    return true;
};

export async function tarDirectory(path: string, tgzName: string) {
    return tar.create({ file: tgzName, C: path, filter }, ['.']).then(_ => {
        core.info(`Compressed ${path} directory to file ${tgzName}`);
    });
}

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

async function tagFeatureAtVersion(featureMetaData: Feature) {
    const featureId = featureMetaData.id;
    const featureVersion = featureMetaData.version;

    const tagName = `${featureId}_v${featureVersion}`;

    // Get GITHUB_TOKEN from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        core.setFailed('GITHUB_TOKEN environment variable is not set.');
        return;
    }

    // Setup Octokit client
    const octokit = github.getOctokit(githubToken);

    // Use octokit to get all tags for this repo
    const tags = await octokit.rest.repos.listTags({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
    });

    // See if tags for this release was already created.
    const tagExists = tags.data.some(tag => tag.name === tagName);

    if (tagExists) {
        core.info(`Tag ${tagName} already exists. Skipping...`);
        return;
    }

    // Create tag
    const createdTag = await octokit.rest.git.createTag({
        tag: tagName,
        message: `Feature ${featureId} version ${featureVersion}`,
        object: github.context.sha,
        type: 'commit',
        owner: github.context.repo.owner,
        repo: github.context.repo.repo
    });

    if (createdTag.status === 201) {
        core.info(`Tagged '${tagName}'`);
    } else {
        core.setFailed(`Failed to tag '${tagName}'`);
        return;
    }

    // Create reference to tag
    const createdRef = await octokit.rest.git.createRef({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        ref: `refs/tags/${tagName}`,
        sha: createdTag.data.sha
    });

    if (createdRef.status === 201) {
        core.info(`Created reference for '${tagName}'`);
    } else {
        core.setFailed(`Failed to reference of tag '${tagName}'`);
        return;
    }
}

export async function addCollectionsMetadataFile(featuresMetadata: Feature[] | undefined, templatesMetadata: Template[] | undefined, opts: PackagingOptions) {
    const p = path.join('.', 'devcontainer-collection.json');

    const sourceInformation = getGitHubMetadata();

    const metadata: DevContainerCollectionMetadata = {
        sourceInformation,
        features: featuresMetadata || [],
        templates: templatesMetadata || []
    };

    // Write to the file
    await writeLocalFile(p, JSON.stringify(metadata, undefined, 4));

    if (opts.shouldPublishToOCI) {
        pushCollectionsMetadataToOCI(p);
    }
}

async function pushArtifactToOCI(version: string, featureName: string, artifactPath: string): Promise<void> {
    const exec = promisify(child_process.exec);

    const versions = [version, '1.0', '1']; // TODO: don't hardcode ofc.

    const sourceInfo = getGitHubMetadata();

    await Promise.all(
        versions.map(async (v: string) => {
            const ociRepo = `${sourceInfo.owner}/${sourceInfo.repo}/${featureName}:${v}`;
            try {
                const cmd: string = `oras push ghcr.io/${ociRepo} \
                    --manifest-config /dev/null:application/vnd.devcontainers \
                                ./${artifactPath}:application/vnd.devcontainers.layer.v1+tar`;
                await exec(cmd);
                core.info(`Pushed artifact to '${ociRepo}'`);
            } catch (error) {
                if (error instanceof Error) core.setFailed(`Failed to push '${ociRepo}':  ${error.message}`);
            }
        })
    );
}

export async function pushCollectionsMetadataToOCI(collectionJsonPath: string) {
    const exec = promisify(child_process.exec);

    const sourceInfo = getGitHubMetadata();
    const ociRepo = `${sourceInfo.owner}/${sourceInfo.repo}:latest`;
    try {
        const cmd: string = `oras push ghcr.io/${ociRepo} \
            --manifest-config /dev/null:application/vnd.devcontainers \
                        ./${collectionJsonPath}:application/vnd.devcontainers.collection.layer.v1+json`;
        await exec(cmd);
        core.info(`Pushed collection metadata to '${ociRepo}'`);
    } catch (error) {
        if (error instanceof Error) core.setFailed(`Failed to push collection metadata '${ociRepo}':  ${error.message}`);
    }
}

async function loginToGHCR(): Promise<void> {
    const exec = promisify(child_process.exec);

    // Get GITHUB_TOKEN from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
        core.setFailed('GITHUB_TOKEN environment variable is not set.');
        return;
    }

    try {
        await exec(`oras login ghcr.io -u USERNAME -p ${githubToken}`);
        core.info('Oras logged in successfully!');
    } catch (error) {
        if (error instanceof Error) core.setFailed(` Oras login failed!`);
    }
}

export async function getFeaturesAndPackage(basePath: string, opts: PackagingOptions): Promise<Feature[] | undefined> {
    const { shouldPublishToNPM, shouldTagIndividualFeatures, shouldPublishReleaseArtifacts, shouldPublishToOCI } = opts;
    const featureDirs = fs.readdirSync(basePath);
    let metadatas: Feature[] = [];
    const exec = promisify(child_process.exec);

    if (shouldPublishToOCI) {
        await loginToGHCR();
    }

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
                if (!sourceInfo.owner) {
                    core.setFailed('Could not determine repository owner.');
                    return;
                }

                const archiveName = `${f}.tgz`;
                // ---- PUBLISH RELEASE ARTIFACTS (classic method) ----
                if (shouldPublishReleaseArtifacts || shouldPublishToOCI) {
                    core.info(`** Tar'ing feature`);
                    await tarDirectory(featureFolder, archiveName);
                }

                // ---- PUBLISH TO NPM ----
                if (shouldPublishToOCI) {
                    core.info(`** Publishing to OCI`);

                    // TODO: CHECK IF THE FEATURE IS ALREADY PUBLISHED UNDER GIVEN TAG

                    await pushArtifactToOCI(featureMetadata.version, f, archiveName);
                }

                // ---- TAG INDIVIDUAL FEATURES ----
                if (shouldTagIndividualFeatures) {
                    core.info(`** Tagging individual feature`);
                    await tagFeatureAtVersion(featureMetadata);
                }

                // ---- PUBLISH TO NPM ----
                if (shouldPublishToNPM) {
                    core.info(`** Publishing to NPM`);
                    // Adds a package.json file to the feature folder
                    const packageJsonPath = path.join(featureFolder, 'package.json');
                    // if (!sourceInfo.tag) {
                    //     core.error(`Feature ${f} is missing a tag! Cannot publish to NPM.`);
                    //     core.setFailed('All features published to NPM must be tagged with a version');
                    // }

                    const packageJsonObject = {
                        name: `@${sourceInfo.owner}/${f}`,
                        version: featureMetadata.version,
                        description: `${featureMetadata.description ?? 'My cool feature'}`,
                        author: `${sourceInfo.owner}`,
                        keywords: ['devcontainer-features']
                    };
                    await writeLocalFile(packageJsonPath, JSON.stringify(packageJsonObject, undefined, 4));

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
