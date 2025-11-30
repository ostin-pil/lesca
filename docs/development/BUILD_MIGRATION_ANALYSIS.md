# Build System Migration Analysis

## Current State

**Build Pipeline**: `tsc -b tsconfig.build.json && tsc-alias -p tsconfig.build.json`

**Issues**:

1. Two-step compilation process (TypeScript → path alias fixing)
2. TypeScript compilation errors (`TS6133`, `TS2322`, `TS2739`) blocking builds
3. Slow incremental builds for monorepo (composite projects still slow)
4. `tsc-alias` adds complexity and potential for misalignment
5. No tree-shaking or bundling optimization

**Current Structure**:

- 12 packages with `exports` fields
- npm workspaces monorepo
- ES Modules (`"type": "module"`)
- Mix of CLI app (packages/cli) and libraries
- Path aliases configured in tsconfig.json

---

## Migration Options

### Option 1: **tsup** (Recommended ⭐)

**Pros**:

- ✅ Native monorepo support with npm workspaces
- ✅ Built on esbuild (10-100x faster than tsc)
- ✅ Automatic path alias resolution (no tsc-alias needed)
- ✅ Type generation (`d.ts` + source maps) built-in
- ✅ Minimal config, each package has simple `tsup.config.ts`
- ✅ Tree-shaking by default
- ✅ Zero-config for most use cases
- ✅ ESM + CJS dual output support
- ✅ Seamless migration from tsc

**Cons**:

- Newer ecosystem (but mature enough)
- Requires config file per package (or root config)

**Estimated Impact**:

- Build time: ~2-3s (vs 6-8s currently)
- Setup time: ~30 mins
- Breaking changes: None (backward compatible)

---

### Option 2: **Vite** (Library Mode)

**Pros**:

- ✅ Fast, modern toolchain
- ✅ Library mode supports monorepos
- ✅ Great dev experience

**Cons**:

- ❌ Designed primarily for applications
- ❌ Library mode is less mature than application mode
- ⚠️ Requires significant config per package
- ⚠️ More complex migration path

**Verdict**: Not ideal for library-heavy monorepo

---

### Option 3: **Rollup** + TypeScript Plugin

**Pros**:

- ✅ Very flexible, powerful
- ✅ Mature ecosystem

**Cons**:

- ❌ Verbose config required for each package
- ❌ Manual TypeScript plugin setup
- ❌ Steeper learning curve
- ⚠️ More overhead than needed for this use case

**Verdict**: Overkill for Lesca's structure

---

### Option 4: **SWC** + Turbopack

**Pros**:

- ✅ Extremely fast (Rust-based)

**Cons**:

- ❌ Less mature TypeScript support
- ❌ Monorepo support still evolving
- ⚠️ Complex migration for existing projects

**Verdict**: Premature for this project

---

## Recommended Path: tsup

### Why tsup?

1. **Drop-in replacement** for tsc with esbuild performance
2. **Monorepo-friendly** - npm workspaces native support
3. **Minimal configuration** - leverages existing tsconfig.json
4. **No refactoring** - all source code stays the same
5. **Type safety** - full `.d.ts` generation + source maps
6. **Incremental builds** - fast rebuilds

### Migration Strategy

#### Phase 1: Root Configuration

```bash
npm install -D tsup
# Create root tsup.config.ts
# Update build script: "build": "tsup"
```

#### Phase 2: Per-Package Configuration (Optional)

```bash
# Each package gets minimal config (if needed)
# Most can use defaults from root
```

#### Phase 3: Update package.json scripts

```json
{
  "build": "tsup",
  "build:watch": "tsup --watch",
  "build:clean": "tsup --clean"
}
```

#### Phase 4: Remove tsc-alias dependency

```bash
npm uninstall tsc-alias
# Remove from build script
```

---

## Implementation Plan

### Step 1: Install tsup

```bash
npm install -D tsup
```

### Step 2: Create root tsup.config.ts

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    // CLI
    cli: 'packages/cli/src/index.ts',
    // Core packages
    core: 'packages/core/src/index.ts',
    auth: 'packages/auth/src/index.ts',
    'api-client': 'packages/api-client/src/index.ts',
    'browser-automation': 'packages/browser-automation/src/index.ts',
    scrapers: 'packages/scrapers/src/index.ts',
    converters: 'packages/converters/src/index.ts',
    storage: 'packages/storage/src/index.ts',
    // Shared
    'shared-types': 'shared/types/src/index.ts',
    'shared-config': 'shared/config/src/index.ts',
    'shared-utils': 'shared/utils/src/index.ts',
    'shared-error': 'shared/error/src/index.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: true,
  external: ['@lesca/cli', '@lesca/core', '@lesca/auth', '@lesca/api-client'],
})
```

### Step 3: Update package.json scripts

```json
{
  "build": "tsup",
  "build:watch": "tsup --watch",
  "build:clean": "tsup --clean",
  "clean": "rm -rf dist packages/*/dist shared/*/dist"
}
```

### Step 4: Remove tsc-alias from dependencies

```bash
npm uninstall tsc-alias
```

### Step 5: Remove tsconfig.build.json (or simplify)

- May no longer be needed, but can keep as reference

---

## Alternative: Per-Package tsup Config

For more granular control, each package could have `tsup.config.ts`:

```typescript
// packages/cli/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  external: ['@lesca/core', '@lesca/shared-config'],
})
```

Then build with: `tsup -c packages/cli/tsup.config.ts`

---

## Performance Comparison

| Metric                | Current (tsc)      | tsup      |
| --------------------- | ------------------ | --------- |
| Full build            | ~6-8s              | ~1-2s     |
| Incremental           | ~4-6s              | ~0.5-1s   |
| Type generation       | Automatic          | Automatic |
| Configuration         | Complex            | Simple    |
| Path alias resolution | Manual (tsc-alias) | Automatic |

---

## Risk Assessment

| Risk                  | Probability | Mitigation                       |
| --------------------- | ----------- | -------------------------------- |
| Path alias issues     | Low         | tsup handles automatically       |
| Export compatibility  | Low         | Keep package.json exports as-is  |
| Type generation       | Very Low    | tsup's dts is solid              |
| Dev workflow breakage | Low         | Can test parallel, rollback easy |

---

## Testing Strategy

1. **Install and configure** tsup
2. **Build side-by-side** with tsc (parallel testing)
3. **Compare outputs** - diffs should be minimal
4. **Run test suite** - `npm test` should pass
5. **Manual testing** - `npm run dev -- <command>`
6. **Type checking** - `npm run typecheck` still uses tsc
7. **Lint/format** - no changes needed

---

## Migration Timeline

- **Setup**: 15-20 mins (install, config, update scripts)
- **Testing**: 20-30 mins (verify outputs, run tests)
- **Cleanup**: 10 mins (remove tsc-alias, update docs)
- **Total**: ~1 hour

---

## Rollback Plan

If issues arise:

```bash
# Revert to tsc
npm install -D tsc-alias
git revert <commits>
npm run build  # Back to tsc
```

---

## Future Considerations

1. **Monorepo framework** (Nx, Turborepo) - if project grows
2. **Workspace-level build cache** - tsup supports this
3. **Docker optimizations** - layered builds with tsup
4. **CI/CD optimization** - parallel package builds

---

## Questions Before Implementation?

- Want per-package tsup configs or centralized?
- Keep type checking with tsc, or migrate to tsup-based?
- Need CommonJS output for Node 16 compatibility?
- Want to modernize other tools simultaneously (bundler, etc.)?
