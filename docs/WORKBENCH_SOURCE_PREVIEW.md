# Workbench interface source preview

This draft publishes the independently reviewed standalone interface v2 as a source preview. The owner authorized public publication with reserved rights for eligible original application code; no unrestricted or commercial-use license is granted. See `apps/workbench/APPLICATION_RIGHTS.md` and the repository `RIGHTS.md`. Dependency and historical-source rights remain separate.

## Exact source mapping

The reviewed archive SHA-256 is `95c8963e1921d364ccee3ea015f2a511e4ce697b5a671942108c1739cab0b5e0` (172,852 bytes). Its `tacitus-interface-candidate-v2/` prefix is mapped to `apps/workbench/`. All 34 payload files and `FILE_INVENTORY.json` retain their exact reviewed bytes. This note is the only additional file.

The embedded README, inventory and verification report are frozen review records. Their references to an unpublished candidate and pending publication review describe the earlier checkpoint. Independent inventory/privacy review and owner publication approval have since cleared this source-preview release. They do not imply a final commercial agreement or permission to merge/deploy.

## Run modes

Run all application commands from `apps/workbench`, not the repository root. Node 24.12.0 and the exact direct dependencies in `package.json` were used in the recorded validation. With those dependencies and a compatible Playwright Chromium browser already installed, run:

```sh
cd apps/workbench
npm run typecheck
npm run build
npm test
npm start
```

Browser installation is not performed or validated by this publication step.

Open `http://127.0.0.1:4317` and explicitly choose the recorded July example. A live request never falls back to recorded output. This source preview has no dependency lockfile and does not establish a clean-install or cold-cache workflow. Do not use `npm ci` as though a lockfile were provided.

Live inspection additionally requires the separately built, reviewed core executable and process-local configuration described in the application README: `TACITUS_LOCAL_INSPECTOR=1`, its absolute `TACITUS_KNOWLEDGE_CAPTURE_BIN` path, and the actual executable's SHA-256 in `TACITUS_KNOWLEDGE_CAPTURE_SHA256`. Executable hashes vary by build/platform; never substitute a source hash. Follow `docs/CORE_INTEGRATION.md` for the pinned core and patch. The server is loopback-only and disables live execution in production/hosted mode. These are local instructions, not a cloud deployment recipe.

## Verified scope and remaining gates

The producing environment passed type checking, build, three default-mode tests and three enabled-mode tests, including actual-core desktop/mobile flows. Independent source review verified the exact inventory, confidentiality boundary and four corrections described in the embedded verification report. This publication step verified bytes, rather than repeating browser execution in a different environment.

The full 622-record source-index adapter is published separately in example PR #2; it is not integrated into this interface. Ten cognitive-method proposals are likewise not retrieved by the live CLI. The guided example and live uploaded Context are separate modes. A clean dependency installation/lockfile, combined repository CI and end-to-end expanded-collection UI acceptance remain open. This draft does not merge other branches or deploy a hosted marketplace.
