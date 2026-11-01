# Specs

Each piece of work gets a folder named `<name>_<version>` containing a `spec.md`. Copy `_template/spec.md` to start one.

## Workflow

1. **Draft**: list the requirement IDs from `features/`, then write scope and acceptance criteria.
2. **Review**: resolve questions. Any spec that relies on an `Open` decision in `docs/decisions.md` stays here.
3. **Approved**: the owner approves the spec. Coding starts only from this point.
4. **In progress**: work through the tasks. If the design changes, update the spec in the same PR.
5. **Done**: all acceptance criteria are verified by tests, or by a recorded check where a test isn't possible. Update the status in the phase file.

## Versions

Use a new version folder when a shipped spec gets a significant change, for example `cli-publish_0.2.0`. Do not rewrite a spec after it reaches Done.
