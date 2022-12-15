import * as github from '@actions/github';
import * as fs from 'fs';
import { promisify } from 'util';
import { GitHubMetadata } from './contracts/collection';
import * as cp from 'child_process';
import { Template } from './contracts/templates';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';

export const readLocalFile = promisify(fs.readFile);
export const writeLocalFile = promisify(fs.writeFile);
export const mkdirLocal = promisify(fs.mkdir);
export const renameLocal = promisify(fs.rename);

export function getGitHubMetadata() {
    // Insert github repo metadata
    const ref = github.context.ref;

    let metadata: GitHubMetadata = {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        ref,
        sha: github.context.sha
    };

    // Add tag if parseable
    if (ref.includes('refs/tags/')) {
        const tag = ref.replace('refs/tags/', '');
        metadata = { ...metadata, tag };
    }
    return metadata;
}

export async function isDevcontainerCliAvailable(cliDebugMode = false): Promise<boolean> {
    try {
        let cmd = 'devcontainer';
        let args = ['--version'];
        if (cliDebugMode) {
            cmd = 'npx';
            args = ['-y', './devcontainer.tgz', ...args];
        }
        const res = await exec.getExecOutput(cmd, args, {
            ignoreReturnCode: true,
            silent: true
        });
        core.info(`Devcontainer CLI version '${res.stdout}' is installed.`);
        return res.exitCode === 0;
    } catch (err) {
        return false;
    }
}

export async function addRepoTagForPublishedTag(type: string, id: string, version: string): Promise<boolean> {
    const octokit = github.getOctokit(process.env.GITHUB_TOKEN || '');
    const tag = `${type}_${id}_v${version}`;
    core.info(`Adding repo tag '${tag}'...`);

    try {
        await octokit.rest.git.createRef({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            ref: `refs/tags/${tag}`,
            sha: github.context.sha
        });

        await octokit.rest.git.createTag({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            tag,
            message: `${tag}`,
            object: github.context.sha,
            type: 'commit'
        });
    } catch (err) {
        core.error(`Failed to add tag '${tag}' to repo: ${err}`);
        return false;
    }

    core.info(`Tag '${tag}' added.`);
    return true;
}

export async function ensureDevcontainerCliPresent(cliDebugMode = false): Promise<boolean> {
    if (await isDevcontainerCliAvailable(cliDebugMode)) {
        return true;
    }

    if (cliDebugMode) {
        core.error('Cannot remotely fetch CLI in debug mode');
        return false;
    }

    // Unless this override is set,
    // we'll fetch the latest version of the CLI published to NPM
    const cliVersion = core.getInput('devcontainer-cli-version');
    let cli = '@devcontainers/cli';
    if (cliVersion) {
        core.info(`Manually overriding CLI version to '${cliVersion}'`);
        cli = `${cli}@${cliVersion}`;
    }

    try {
        core.info('Fetching the latest @devcontainer/cli...');
        const res = await exec.getExecOutput('npm', ['install', '-g', cli], {
            ignoreReturnCode: true,
            silent: true
        });
        return res.exitCode === 0;
    } catch (err) {
        core.error(`Failed to fetch @devcontainer/cli:  ${err}`);
        return false;
    }
}
