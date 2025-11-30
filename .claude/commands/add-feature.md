# Plan New Feature

Create an implementation plan for a new feature in Lesca.

## Arguments

- `$ARGUMENTS` - Required: description of the feature to add

## Steps

1. Read `docs/LLM_AGENT_KNOWLEDGE.md` for project context
2. Read `docs/AGENT_GUIDELINES.md` for coding rules
3. Analyze existing similar features for patterns
4. Create a plan including:
   - Files to modify/create
   - Types to add in `shared/types/src/index.ts`
   - Tests to write
   - Documentation to update

## Planning Checklist

- [ ] Identify which package(s) this affects
- [ ] Check if existing types need extension
- [ ] Follow established design patterns (Facade, Strategy, Singleton, Adapter)
- [ ] Plan for >80% test coverage
- [ ] Consider error handling with LescaError subclasses
- [ ] Use logger instead of console
- [ ] Follow import conventions

## Output Format

Provide a structured plan with:

1. Overview of the feature
2. Files to create/modify (with reasons)
3. Type definitions needed
4. Test plan
5. Implementation order
