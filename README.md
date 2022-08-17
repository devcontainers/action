# Development Container Publish Action

<table style="width: 100%; border-style: none;"><tr>
<td style="width: 140px; text-align: center;"><a href="https://github.com/devcontainers"><img width="128px" src="https://raw.githubusercontent.com/microsoft/fluentui-system-icons/78c9587b995299d5bfc007a0077773556ecb0994/assets/Cube/SVG/ic_fluent_cube_32_filled.svg" alt="devcontainers organization logo"/></a></td>
<td>
<strong>Development Container Publish Action</strong><br />
<i>A GitHub Action to pubish development container features.
</td>
</tr></table>

This action is used to package and generate documentation for [dev container features](https://containers.dev/implementors/features/).  

Running this action will publish all dev container features in accordance with the [_proposed_ dev container feature distribution specification](https://containers.dev/implementors/features-distribution/).

This action is used in the [`devcontainer/features`](https://github.com/devcontainers/features) repo, in the [release.yaml](https://github.com/devcontainers/features/blob/main/.github/workflows/release.yaml) workflow.

## Usage

This GitHub action can be used to self-publish your own dev container features.

To help get started, create your own repo from the [`devcontainers/feature-template`](https://github.com/devcontainers/feature-template) template.