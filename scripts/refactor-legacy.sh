#!/bin/bash

# Refactor legacy patterns using ast-grep

# 1. Refactor property access: A && A.B -> A?.B
# Example: obj && obj.prop -> obj?.prop
echo "Refactoring property access..."
npx @ast-grep/cli sg run --pattern '$A && $A.$B' --rewrite '$A?.$B' .

# 2. Refactor method call: A && A.B(...) -> A?.B(...)
# Example: str && str.trim() -> str?.trim()
echo "Refactoring method calls..."
npx @ast-grep/cli sg run --pattern '$A && $A.$B($$$)' --rewrite '$A?.$B($$$)' .

# 3. Refactor chained method call with length check (specific to discussion-strategy.ts pattern)
# Example: extracted && extracted.trim().length -> extracted?.trim()?.length
echo "Refactoring chained method calls..."
npx @ast-grep/cli sg run --pattern '$A && $A.$B().$C' --rewrite '$A?.$B()?.$C' .
