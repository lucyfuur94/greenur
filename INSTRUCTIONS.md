## Version Management
1. All merges to main must use `scripts/merge-test-to-main.sh`
2. Never modify version.ts manually on main branch
3. Test branch should always reflect next planned version
4. Use semantic versioning (semver.org)
5. After merging, run:
```bash
git tag v$(grep "VERSION =" src/config/version.ts | cut -d "'" -f 2)
git push origin main --tags
``` 