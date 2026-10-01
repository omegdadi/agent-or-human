# Publishing Agent or Human

The npm package name is `agent-or-human`. The source repository is `omegdadi/agent-or-human` and the demo is `https://omegdadi.github.io/agent-or-human/`. `agent-or-human@0.6.0` was first published publicly on npm under `omegdadi`; registry tarball SHA-1 is `945bf0f289d3a49366902819f405a0c0d5f3c50f`, matching the tested release artifact. Fresh ESM/CommonJS registry installs passed. Trusted publishing still requires configuration in the npm package settings.

## Release process

Use Node 22.14+ and npm 11.5.1+ for trusted publishing. Run `npm ci`, `npm test`, `npm run test:browser`, `npm run test:inputs`, `npm run test:package`, and the demo suite before release. Inspect `npm pack --dry-run` and ensure the Git checkout is clean. Package contents must match the tagged release.

For the first authenticated release, sign in as the owning npm account and run `npm publish --access public`. Complete any npm authentication/2FA challenge interactively; do not put credentials or OTPs in source or CI files. Verify the resulting package page and install the exact registry version in a fresh consumer before documenting bare-name installation as available. A successful pack or GitHub release does not establish npm publication.

After package creation, configure npm trusted publishing for the GitHub repository `omegdadi/agent-or-human` and workflow `publish.yml`. Allow direct `npm publish` in that publisher configuration. The workflow uses GitHub-hosted runners and OIDC, without an npm token. It runs only on manual dispatch for an existing version tag; it never publishes on ordinary pushes. Restrict who can dispatch release workflows through repository permissions.

Official references: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Compatibility

v0.8 completes the rebrand: the declaration helper is `declareAgentOrHuman`, the browser declaration key is `__AGENT_OR_HUMAN__`, and analytics properties use `agent_or_human_`. This is a breaking naming change from v0.7 with no legacy aliases. Migrate controller scripts and analytics schemas together. Older published releases and their immutable tarballs retain their original interfaces. See the README migration guide.
