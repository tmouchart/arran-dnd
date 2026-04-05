---
name: commit-push
description: Stage all changes, create one or more commits grouped by feature, and push to remote
allowed_tools: Bash, Read, Glob, Grep
---

Follow the git commit protocol below, then push to remote.

## Steps

1. Run `git status` and `git diff` in parallel to see what changed.
2. Run `git log --oneline -5` to match the repo's commit message style.
3. **Group the changes by feature or functional area.** If the diff touches multiple independent features or concerns, create one commit per group — do not bundle unrelated changes into a single commit.
4. For each group:
   - Stage only the relevant files (prefer specific filenames over `git add -A`)
   - Draft a commit message:
     - Concise subject line (imperative, ≤72 chars)
     - Follows the repo's existing style (conventional commits if used)
     - Focuses on *why*, not just *what*
   - Commit using a HEREDOC to preserve formatting
5. Run `npm run build` and check for errors.
   - If there are build errors (TypeScript, unused imports, etc.), fix them and create a fixup commit.
   - Repeat until the build passes cleanly.
6. Run `npm test` and check for failures.
   - If tests fail, fix the issues and create a fixup commit.
   - Repeat until all tests pass.
7. Run `git push` once all commits are done, build passes, and tests are green.
8. Confirm with the list of commit SHAs created.
