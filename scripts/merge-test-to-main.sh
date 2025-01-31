#!/bin/bash
# Merge test branch to main with version bump

# Ensure we're on main
git checkout main || exit 1

# Update main
git pull origin main || exit 1

# Merge test branch
git merge test --no-ff -m "Merge branch 'test'" || exit 1

# Bump version
./scripts/version-update.sh minor || exit 1

# Commit version bump
git add src/config/version.ts
git commit -m "build: Bump version to $(grep "VERSION =" src/config/version.ts | cut -d "'" -f 2)" || exit 1

# Push changes
git push origin main || exit 1

echo "Successfully merged test to main and updated version" 