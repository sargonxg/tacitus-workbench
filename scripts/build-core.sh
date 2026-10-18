#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo 'Usage: bash scripts/build-core.sh /absolute/new-build-directory' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute output path required' >&2; exit 2;; esac
if [ -e "$1" ] || [ -L "$1" ]; then echo 'Fresh output directory required' >&2; exit 2; fi
workbench=$(cd -- "$(dirname -- "$0")/.." && pwd)
build_root=$1
mkdir -- "$build_root"
git clone --no-checkout https://github.com/sargonxg/tacitus-political-policy-second-brain.git "$build_root/core"
git -C "$build_root/core" checkout --detach 0d47eafd93f2b4a5e4a926d3c761410b1c319cd6
echo "5dbf6a9c000b7a381601063115c9b08d4b509d239b7edd9d2c4b0067f3856611  $workbench/patches/source-span-recall.patch" | sha256sum --check
git -C "$build_root/core" apply --check "$workbench/patches/source-span-recall.patch"
git -C "$build_root/core" apply "$workbench/patches/source-span-recall.patch"
echo "b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662  $build_root/core/edgequake/crates/tacitus-analysis/src/knowledge_capture.rs" | sha256sum --check
python3 "$build_root/core/scripts/prepare-capsule-workspace.py" "$build_root/core-build"
cd -- "$build_root/core-build"
cargo +1.95.0 test --locked 2>&1 | tee "$build_root/core-tests.log"
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture
sha256sum target/debug/examples/knowledge_capture
