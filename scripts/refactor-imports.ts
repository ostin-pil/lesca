import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { resolve, relative, dirname, join } from 'path';

const ROOT_DIR = process.cwd();

// Mapping of package paths to their aliases
const PACKAGE_MAPPINGS = [
  { path: 'packages/core/src', alias: '@lesca/core' },
  { path: 'packages/auth/src', alias: '@lesca/auth' },
  { path: 'packages/api-client/src', alias: '@lesca/api-client' },
  { path: 'packages/browser-automation/src', alias: '@lesca/browser-automation' },
  { path: 'packages/scrapers/src', alias: '@lesca/scrapers' },
  { path: 'packages/converters/src', alias: '@lesca/converters' },
  { path: 'packages/storage/src', alias: '@lesca/storage' },
  { path: 'packages/cli/src', alias: '@lesca/cli' },
];

// Shared packages are a bit different as they have a wildcard
// shared/config/src -> @lesca/shared/config
// shared/utils/src -> @lesca/shared/utils
// shared/types/src -> @lesca/shared/types
// shared/error/src -> @lesca/shared/error

async function main() {
  const files = await glob('**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**', '**/dist/**', 'scripts/**'],
    cwd: ROOT_DIR,
    absolute: true,
  });

  console.log(`Found ${files.length} files to process.`);

  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let changed = false;

    // Regex to find import paths
    // Matches: import ... from 'path' OR export ... from 'path'
    const importRegex = /(from\s+['"])([^'"]+)(['"])/g;

    content = content.replace(importRegex, (match, prefix, importPath, suffix) => {
      let newPath = importPath;

      // 1. Remove extensions
      if (newPath.endsWith('.js') || newPath.endsWith('.ts') || newPath.endsWith('.tsx')) {
        newPath = newPath.replace(/\.(js|ts|tsx)$/, '');
      }

      // 2. Convert relative paths to absolute aliases
      if (newPath.startsWith('.')) {
        const absoluteImportPath = resolve(dirname(file), newPath);
        const relativeToRoot = relative(ROOT_DIR, absoluteImportPath);

        // Check if it matches any package mapping
        for (const mapping of PACKAGE_MAPPINGS) {
          if (relativeToRoot.startsWith(mapping.path)) {
            // It's inside a package
            // If it's exactly the package root (index), use the alias
            if (relativeToRoot === mapping.path || relativeToRoot === join(mapping.path, 'index')) {
               newPath = mapping.alias;
            } else {
               // It's a subpath, check if we should use alias
               // Actually, we usually only import from index in other packages
               // If we are importing from the SAME package, we should keep relative imports usually?
               // The request said "deep relative imports".
               // Let's say if we are importing from ANOTHER package, use alias.

               const currentFileRelativeToRoot = relative(ROOT_DIR, file);
               const currentPackage = PACKAGE_MAPPINGS.find(m => currentFileRelativeToRoot.startsWith(m.path));

               // If importing from a different package
               if (!currentPackage || currentPackage.path !== mapping.path) {
                  // Use alias
                  // If it points to index, just use alias
                  if (relativeToRoot === mapping.path || relativeToRoot === join(mapping.path, 'index')) {
                    newPath = mapping.alias;
                  } else {
                    // It points deep into another package. Ideally we should import from index.
                    // But if we must preserve deep import:
                    // @lesca/core/some-file
                    // But our aliases map to src.
                    // So packages/core/src/foo -> @lesca/core/foo
                    const subPath = relative(mapping.path, relativeToRoot);
                    newPath = `${mapping.alias}/${subPath}`;
                  }
               }
            }
            break;
          }
        }

        // Check shared packages
        if (relativeToRoot.startsWith('shared/')) {
           const parts = relativeToRoot.split('/');
           // shared/config/src/...
           if (parts.length >= 3 && parts[2] === 'src') {
             const sharedPkgName = parts[1]; // config
             const sharedAliasBase = `@lesca/shared/${sharedPkgName}`;
             const sharedSrcPath = `shared/${sharedPkgName}/src`;

             const currentFileRelativeToRoot = relative(ROOT_DIR, file);

             // If importing from outside this shared package (or even inside, if we want to be consistent?)
             // Usually internal imports are relative.
             if (!currentFileRelativeToRoot.startsWith(`shared/${sharedPkgName}`)) {
                if (relativeToRoot === sharedSrcPath || relativeToRoot === join(sharedSrcPath, 'index')) {
                  newPath = sharedAliasBase;
                } else {
                   // deep import
                   const subPath = relative(sharedSrcPath, relativeToRoot);
                   newPath = `${sharedAliasBase}/${subPath}`;
                }
             }
           }
        }

        // Handle root alias @/
        // If it's far away and not in a package?
      }

      // Fix specific case mentioned in prompt:
      // ../../../../shared/types/src/index.js -> @/shared/types/src/index
      // Wait, the prompt example was:
      // import ... from '@/shared/types/src/index.js'
      // The user wants to use aliases defined in tsconfig.

      // Let's refine the logic.
      // If the path is relative and goes up (starts with ../), try to resolve it to an alias.

      if (newPath !== importPath) {
        changed = true;
        return `${prefix}${newPath}${suffix}`;
      }
      return match;
    });

    if (changed) {
      console.log(`Updating ${relative(ROOT_DIR, file)}`);
      writeFileSync(file, content, 'utf-8');
    }
  }
}

main().catch(console.error);
