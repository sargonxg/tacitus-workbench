#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
  echo 'Usage: bash scripts/build-core.sh /absolute/new-build-directory' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute output path required' >&2; exit 2;; esac
if [ -e "$1" ] || [ -L "$1" ]; then echo 'Fresh output directory required' >&2; exit 2; fi
# Refuse missing prerequisites before creating or cloning into the output path.
for tool in git python3 cargo sha256sum; do
  command -v "$tool" >/dev/null || { echo "Required tool missing from PATH: $tool" >&2; exit 2; }
done
cargo +1.95.0 --version >/dev/null
workbench=$(cd -- "$(dirname -- "$0")/.." && pwd)
build_root=$1
mkdir -- "$build_root"
git clone --no-checkout https://github.com/sargonxg/tacitus-political-policy-second-brain.git "$build_root/core"
git -C "$build_root/core" checkout --detach 6bbdb0764b2bc7d7b05804c79ce9b5505c3bfc95
echo "b4a520566ec6d39179283fae3afe8ad330d0595b08ad9eebf9c99539cf7d9662  $build_root/core/edgequake/crates/tacitus-analysis/src/knowledge_capture.rs" | sha256sum --check
python3 "$build_root/core/scripts/prepare-capsule-workspace.py" "$build_root/core-build"
cp -- "$workbench/apps/workbench/server/local_author.rs" "$build_root/core-build/crates/tacitus-analysis/examples/local_author.rs"
cp -- "$workbench/tools/local-import/batch_author.rs" "$build_root/core-build/crates/tacitus-analysis/examples/batch_author.rs"
cd -- "$build_root/core-build"
cargo +1.95.0 test --locked 2>&1 | tee "$build_root/core-tests.log"
cargo +1.95.0 build --locked -p tacitus-analysis --example knowledge_capture --example local_author --example batch_author
sha256sum target/debug/examples/knowledge_capture target/debug/examples/local_author target/debug/examples/batch_author
