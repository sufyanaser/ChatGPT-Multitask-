# Contributing

Thanks for helping improve ChatGPT Multitask. This project is an independent
third-party client and is not affiliated with OpenAI.

## Ground rules

- Never claim or imply OpenAI affiliation, endorsement or partnership.
- Do not add scraping, private API access, token extraction or user-agent
  spoofing. The app must keep using the official ChatGPT web experience.
- Preserve the sandbox, context isolation and URL allowlist. Security
  regressions block a release.
- Keep Arabic RTL behaviour intact; it is a P0 feature.

## Development setup

```bash
npm ci
npm run typecheck
npm test
npm start
```

`npm test` builds the project and runs the unit, Electron, RTL and updater
verification suites. A change is not ready if any gate fails.

## Branching and commits

- Branch from `develop`; `main` holds release-ready code.
- Use short, imperative commit subjects, optionally with a conventional prefix
  (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Keep unrelated refactors out of bug-fix commits.
- Do not commit `dist/`, `release/`, `.agents/` evidence or local credentials.

## Pull request checklist

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes locally.
- [ ] Windows packaging still works (`npm run pack:win`) when packaging changed.
- [ ] Arabic RTL tests pass when renderer or tab CSS changed.
- [ ] No secrets, tokens, certificates or personal data are included.
- [ ] Documentation and `CHANGELOG.md` are updated for user-visible changes.
- [ ] No claim of OpenAI affiliation or endorsement is introduced.

## Code style

- TypeScript strict mode; avoid `any` unless interacting with untyped Electron
  or third-party events.
- Keep IPC channel names in `src/common/types.ts`; the sandboxed preload mirrors
  them as literals and both surfaces are tested.
- Do not create multiple `AppUpdater` instances.
- Prefer small, focused changes with clear failure handling.

## Release changes

Only maintainers publish releases. See [docs/RELEASE.md](docs/RELEASE.md).
