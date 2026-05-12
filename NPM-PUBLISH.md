# 🚀 Publishing to npm Registry

Guide to publish Overdrive AI Agent to npm as a global CLI tool.

---

## Prerequisites

1. **npm account** - Create at https://www.npmjs.com/signup
2. **Logged in locally** - Run: `npm login`
3. **Valid package.json** - Already configured ✅
4. **Git repository** - Recommended for version tracking

---

## Step 1: Verify Package Configuration

Check that `package.json` has correct metadata:

```bash
npm ls --depth=0
```

Expected fields (already set):
- ✅ `name`: overdrive-ai-agent
- ✅ `version`: 1.0.0
- ✅ `description`: Full MCP description
- ✅ `bin`: { "overdrive": "./bin/overdrive" }
- ✅ `preferGlobal`: true
- ✅ `repository`: GitHub URL
- ✅ `keywords`: Array of relevant terms

---

## Step 2: Login to npm

```bash
npm login
```

Enter:
- Username
- Password
- Email

Verify:
```bash
npm whoami
```

---

## Step 3: Prepare for Publishing

### Check what gets published:

```bash
npm pack --dry-run
```

Shows what's included. Should see:
```
npm notice Packfile contents
npm notice === Tarball Contents ===
npm notice bin/overdrive
npm notice lib/cli/...
npm notice mcp-server.js
npm notice server.js
npm notice ... (all core files)
```

### Clean up before publishing:

```bash
# Remove files not needed in package
rm -rf node_modules/.bin
rm -rf .git
rm -rf dist/
```

---

## Step 4: Create .npmignore

File already created - prevents publishing unnecessary files.

Check contents:
```bash
cat .npmignore
```

---

## Step 5: Test Locally Before Publishing

### Install globally from local package:

```bash
npm install -g .
```

Test global command:
```bash
overdrive --help
overdrive info
overdrive status
```

Should work from anywhere:
```bash
cd /tmp
overdrive --help
# ✅ Should work!
```

### Uninstall test:
```bash
npm uninstall -g overdrive-ai-agent
```

---

## Step 6: Publish to npm

### First-time publish (public):

```bash
npm publish --access public
```

### Update version for next release:

```bash
npm version patch    # 1.0.0 → 1.0.1 (bug fixes)
npm version minor    # 1.0.0 → 1.1.0 (new features)
npm version major    # 1.0.0 → 2.0.0 (breaking changes)
```

Then publish:
```bash
npm publish
```

---

## Step 7: Verify Published Package

### On npm registry:

```bash
npm info overdrive-ai-agent
```

Should show:
- ✅ Your package name
- ✅ Version published
- ✅ Keywords
- ✅ Downloads

### Check registry online:

Visit: https://www.npmjs.com/package/overdrive-ai-agent

---

## Step 8: Users Install Globally

After publishing, users can install:

```bash
npm install -g overdrive-ai-agent
```

Then use globally:
```bash
overdrive status
overdrive projects
overdrive setup
overdrive run all
```

---

## Commands for Users (After Global Install)

### Local core agent:
```bash
cd x:\core-agent
overdrive status      # Check what's running
overdrive config view # View settings
```

### Setup new project:
```bash
overdrive setup       # Interactive wizard
```

### Start servers:
```bash
overdrive run all     # Start shared + independent
overdrive run shared  # Shared mode only
overdrive run independent  # Independent mode only
```

### Test connectivity:
```bash
overdrive test        # Test all endpoints
```

### View system info:
```bash
overdrive info        # Full architecture info
```

---

## Publishing Updates

### Each time you update:

```bash
# 1. Update version
npm version patch

# 2. Commit changes
git add -A
git commit -m "Update to v1.0.1"

# 3. Publish
npm publish

# 4. Push to GitHub
git push --tags
```

---

## Scoped Packages (Optional)

If you want a scoped package (e.g., @yourorg/overdrive):

```json
{
  "name": "@yourorg/overdrive-ai-agent",
  "publishConfig": {
    "access": "public"
  }
}
```

Install:
```bash
npm install -g @yourorg/overdrive-ai-agent
```

---

## Troubleshooting

### "Package name not available"
```bash
# Name already taken, use different name
npm search overdrive-ai-agent
```

### "Not logged in"
```bash
npm login
npm whoami  # Verify
```

### "Permission denied"
```bash
# Check npm permissions
npm access ls-packages

# Or use different scoped name
npm publish --scope=@yourname
```

### "Version already published"
```bash
# Increment version
npm version minor
npm publish
```

---

## After Publishing

### Notify users:

1. Update GitHub README
   - Add npm install instructions
   - Link to npm package

2. Update documentation:
   - Add cli commands to SETUP-MCP.md
   - Add global install option

3. Create release notes:
   - Features added
   - Bug fixes
   - Breaking changes

---

## Verification Checklist

Before publishing:

- [ ] `npm whoami` shows your username
- [ ] `npm pack --dry-run` shows correct files
- [ ] `npm install -g .` works locally
- [ ] `overdrive --help` works globally
- [ ] `overdrive info` shows version correctly
- [ ] package.json has valid metadata
- [ ] .npmignore configured
- [ ] Repository URL correct
- [ ] All dependencies listed
- [ ] Node version requirement set

---

## Quick Command Reference

```bash
# Setup
npm login

# Test locally
npm pack --dry-run
npm install -g .
overdrive --help
npm uninstall -g overdrive-ai-agent

# Update version
npm version patch

# Publish
npm publish --access public

# Verify
npm info overdrive-ai-agent
npm view overdrive-ai-agent version

# Unpublish (within 72h of first publish)
npm unpublish overdrive-ai-agent@1.0.0 --force
```

---

## npm Package Page

After publishing, users see:

```
https://www.npmjs.com/package/overdrive-ai-agent

npm install -g overdrive-ai-agent

Usage:
$ overdrive status
$ overdrive projects
$ overdrive setup
$ overdrive run all
```

---

**Your package is now globally available to 2M+ npm users!** 🎉

For updates, increment version and republish.
For more help: https://docs.npmjs.com/packages-and-modules
