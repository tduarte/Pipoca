#!/bin/bash

# Regenerates generated-sources.json, the list of npm packages the Flatpak
# build downloads up front so that it can build without network access.
# Run this whenever package-lock.json changes.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v flatpak-node-generator &> /dev/null; then
    echo "Error: flatpak-node-generator not found"
    echo "Install it with: pipx install flatpak-node-generator"
    exit 1
fi

# The generator skips packages it finds installed in node_modules, so run it
# on a copy of the lockfile in an empty directory.
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
cp package.json package-lock.json "$workdir/"

# Only build-time dependencies are needed: the build runs `npm ci --omit=dev`.
(cd "$workdir" && flatpak-node-generator npm package-lock.json --no-devel -o generated-sources.json)
cp "$workdir/generated-sources.json" generated-sources.json

echo "generated-sources.json updated; commit it together with package-lock.json"
