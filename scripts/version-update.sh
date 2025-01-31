#!/bin/bash
# Auto-increment version for main branch merges

# Get current version
CURRENT_VERSION=$(grep "VERSION =" src/config/version.ts | cut -d "'" -f 2)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Determine increment type (default: minor)
INCREMENT=${1:-minor}

# Update version
case $INCREMENT in
  major)
    NEW_MAJOR=$((MAJOR + 1))
    NEW_VERSION="$NEW_MAJOR.0.0"
    ;;
  minor)
    NEW_MINOR=$((MINOR + 1))
    NEW_VERSION="$MAJOR.$NEW_MINOR.0"
    ;;
  patch)
    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
    ;;
  *)
    echo "Invalid increment type. Use major/minor/patch"
    exit 1
    ;;
esac

# Update version file
sed -i '' "s/VERSION = '.*'/VERSION = '$NEW_VERSION'/" src/config/version.ts
sed -i '' "s/APP_VERSION = '.*'/APP_VERSION = '$NEW_VERSION'/" src/config/version.ts

echo "Version updated from $CURRENT_VERSION to $NEW_VERSION" 