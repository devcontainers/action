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
