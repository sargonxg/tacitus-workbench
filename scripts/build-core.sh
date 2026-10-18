#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo 'Usage: bash scripts/build-core.sh /absolute/new-build-directory' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute output path required' >&2; exit 2;; esac
if [ -e "$1" ] || [ -L "$1" ]; then echo 'Fresh output directory required' >&2; exit 2; fi
build_root=$1
mkdir -- "$build_root"
git clone --no-checkout https://github.com/sargonxg/tacitus-political-policy-second-brain.git "$build_root/core"
git -C "$build_root/core" checkout --detach 6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95
echo "b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662  $build_root/core/edgequake/crates/tacitus-analysis/src/knowledge_capture.rs" | sha256sum --check
python3 "$build_root/core/scripts/prepare-capsule-workspace.py" "$build_root/core-build"
cd -- "$build_root/core-build"
cargo +1.95.0 test --locked 2>&1 | tee "$build_root/core-tests.log"
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture
sha256sum target/debug/examples/knowledge_capture
