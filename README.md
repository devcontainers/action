# Development Container Action

<table style="width: 100%; border-style: none;"><tr>
<td style="width: 140px; text-align: center;"><a href="https://github.com/devcontainers"><img width="128px" src="https://raw.githubusercontent.com/microsoft/fluentui-system-icons/78c9587b995299d5bfc007a0077773556ecb0994/assets/Cube/SVG/ic_fluent_cube_32_filled.svg" alt="devcontainers organization logo"/></a></td>
<td>
<strong>Development Container Action</strong><br />
<i>A GitHub Action to publish development container assets.
</td>
</tr></table>

This action is used to package and generate documentation for dev container [Features](https://containers.dev/implementors/features/) and [Templates](https://containers.dev/implementors/templates/).  

Running this action will publish dev container Features and templates in accordance with following specifications:

 - [Dev container Feature distribution specification](https://containers.dev/implementors/features-distribution/)
 - [Dev container Template distribution specification](https://containers.dev/implementors/templates-distribution/)

This action is used in the [`devcontainer/features`](https://github.com/devcontainers/features) repo, in the [release.yaml](https://github.com/devcontainers/features/blob/main/.github/workflows/release.yaml) workflow.

## Usage

See the [action.yml](https://github.com/devcontainers/action/blob/main/action.yml) for available options.

To best get started, create your own repo from the [`devcontainers/feature-starter`](https://github.com/devcontainers/feature-starter) or  [`devcontainers/template-starter`](https://github.com/devcontainers/template-starter) repos, customize the provided examples, and trigger the `release.yaml` workflow.

### Permissions

#### Workflow permissions

Running this action requires the following [permissions](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token) be granted:

- `packages: write`
- `contents: write`
- `pull-requests: write`

For example:

```yaml
jobs:
  deploy:
    if: ${{ github.ref == 'refs/heads/main' }}
    runs-on: ubuntu-latest
    permissions:
      packages: write
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v3

      - name: "Publish Templates"
        uses: devcontainers/action@v1
        with:
          publish-templates: "true"
          base-path-to-templates: "./src"
```

#### Enable creation of pull requests

This action will auto-generate documentation and create a pull request of those changes for your review.

Ensure [**Allow GitHub Actions to create and approve pull requests**](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests) is enabled in your repo settings.

#### Optional: Setting Features/Templates as public

Features or Templates published to a registry are **private** by default.  Access controls are managed by the registry. To share your Feature or Template with others outside your organization, you may update the visibility to public.

To do so, publish your Feature or Template and navigate to its setting page. To see packages you have published to the GitHub Container Registry, navigate to the following URL:

`https://github.com/<YOUR_GITHUB_USERNAME>?tab=packages`

### Pinning `devcontainer` CLI version

This action heavily relies on the [devcontainers/cli](https://github.com/devcontainers/cli) for various operations.  By default, this action will fetch the latest version published to [npm](https://www.npmjs.com/package/@devcontainers/cli).  The `devcontainer-cli-version` property can be used to pin to a specific CLI release. Eg:

```yaml
- name: "Publish Features"
  uses: devcontainers/action@v1
  with:
    publish-features: "true"
    base-path-to-features: "./src"
    devcontainer-cli-version: "0.53.0"
```

The changelog for the CLI can always be found here: https://github.com/devcontainers/cli/blob/main/CHANGELOG.md

## Design

Internally, this GitHub Action will fetch the latest published version of the [Dev Container CLI](https://github.com/devcontainers/cli) and execute the appropriate CLI commands - namely `devcontainer features publish` and `devcontainer templates publish`.   
