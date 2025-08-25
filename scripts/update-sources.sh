#!/bin/bash

# Script to regenerate generated-sources.json for Flatpak builds
# This should be run whenever package.json or package-lock.json changes

set -e

echo "Regenerating generated-sources.json for Flatpak..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "package-lock.json" ]; then
    echo "Error: package.json or package-lock.json not found"
    echo "Run this script from the project root directory"
    exit 1
fi

# Check if flatpak-node-generator is available
if ! command -v flatpak-node-generator &> /dev/null; then
    echo "Error: flatpak-node-generator not found"
    echo "Install it with: flatpak install org.flatpak.Builder"
    echo "Or run: sudo apt-get install flatpak-builder"
    exit 1
fi

# Generate the sources file
echo "Running flatpak-node-generator..."
flatpak-node-generator npm package-lock.json

echo "Generated sources file updated successfully!"
echo "You can now commit the updated generated-sources.json file"
