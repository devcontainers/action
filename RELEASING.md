# Releasing

This guide is for maintainers publishing a new version of this action.

## Prepare the release

Ensure all intended changes are merged into `main`, then update your local branch and run the same build steps as the publish workflow:

```bash
git switch main
git pull --ff-only
yarn fetch-schemas
yarn
yarn test
yarn build
```

If fetching the schema changes `src/schemas/devContainerFeature.schema.json`, commit that update before publishing the release.

Choose the next semantic version and identify the previous full release tag. Use immutable full tags such as `v1.4.3`, not floating tags such as `v1` or `v1.4`.

## Publish the release

Create the GitHub release from `main`, explicitly setting the previous full release tag so the generated notes cover the correct range:

```bash
gh release create v1.4.4 \
  --repo devcontainers/action \
  --target main \
  --title v1.4.4 \
  --generate-notes \
  --notes-start-tag v1.4.3
```

Replace `v1.4.4` with the new version and `v1.4.3` with the previous full release tag.

Publishing the release triggers the `Publish` workflow. It checks out the new tag, fetches the current schema, installs dependencies, runs the tests, builds the action, and creates an `Automatic compilation` commit. The workflow then moves the new full tag and its floating major and minor tags to that compiled commit. Do not move those tags manually.

Editing an already published release also triggers the `Publish` workflow.

## Verify the release

Check that the publish workflow succeeded:

```bash
gh run list \
  --repo devcontainers/action \
  --workflow publish.yml \
  --limit 5
```

Confirm the release and floating tags point to the same compiled commit:

```bash
git ls-remote --tags origin \
  refs/tags/v1.4.4 \
  refs/tags/v1.4 \
  refs/tags/v1
```
