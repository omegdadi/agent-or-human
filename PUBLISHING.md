# Publishing Agent or Human

The npm package name is `agent-or-human`. The source repository and demo stay at `omegdadi/session-driver` so existing links keep working. `agent-or-human@0.6.0` is now published publicly on npm under `omegdadi`; registry tarball SHA-1 is `945bf0f289d3a49366902819f405a0c0d5f3c50f`, matching the tested release artifact. Fresh ESM/CommonJS registry installs passed. Trusted publishing still requires configuration in the npm package settings.

## Release process

Use Node 22.14+ and npm 11.5.1+ for trusted publishing. Run `npm ci`, `npm test`, `npm run test:browser`, `npm run test:inputs`, `npm run test:package`, and the demo suite before release. Inspect `npm pack --dry-run` and ensure the Git checkout is clean. Package contents must match the tagged release.

For the first authenticated release, sign in as the owning npm account and run `npm publish --access public`. Complete any npm authentication/2FA challenge interactively; do not put credentials or OTPs in source or CI files. Verify the resulting package page and install the exact registry version in a fresh consumer before documenting bare-name installation as available. A successful pack or GitHub release does not establish npm publication.

After package creation, configure npm trusted publishing for the GitHub repository `omegdadi/session-driver` and workflow `publish.yml`. Allow direct `npm publish` in that publisher configuration. The workflow uses GitHub-hosted runners and OIDC, without an npm token. It runs only on manual dispatch for an existing version tag; it never publishes on ordinary pushes. Restrict who can dispatch release workflows through repository permissions.

Official references: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/).

## Compatibility

v0.6 changes the package name and browser global (`AgentOrHuman`). JavaScript function names, declaration key `__SESSION_DRIVER__`, and analytics property prefix `session_driver_` remain stable. GitHub releases before v0.6 still contain the old package and retain their original tarballs. v0.6 removes the old UA-based headless signal and heuristic; dashboards consuming that reason code should no longer expect it.
