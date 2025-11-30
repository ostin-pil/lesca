# Review Code

Review code for compliance with Lesca coding standards.

## Arguments

- `$ARGUMENTS` - Required: file path or glob pattern to review

## Steps

1. Read the file(s) specified
2. Check against Lesca standards:
   - No `any` types
   - No `console.log` (use logger)
   - No non-null assertions (`!`)
   - No file extensions in imports
   - Correct import order
   - Proper optional property handling
   - Array access safety
   - No unnecessary async
3. Run linting: `npx eslint $ARGUMENTS`
4. Provide feedback on:
   - Violations found
   - Suggested fixes
   - Code quality observations

## Severity Levels

- **Error**: Violations that will fail CI (any, non-null, console)
- **Warning**: Style issues that should be fixed
- **Suggestion**: Improvements that would enhance code quality
