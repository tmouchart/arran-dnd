---
name: commit-push
description: Stage all changes, create a commit with a generated message, and push to remote
allowed_tools: Bash, Read, Glob, Grep
---

Follow the git commit protocol below, then push to remote.

## Steps

1. Run `git status` and `git diff` in parallel to see what changed.
2. Run `git log --oneline -5` to match the repo's commit message style.
3. Stage the relevant modified files (prefer specific filenames over `git add -A`).
4. Draft a commit message:
   - Concise subject line (imperative, ≤72 chars)
   - Follows the repo's existing style (conventional commits if used)
   - Focuses on *why*, not just *what*
   - Ends with: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
5. Commit using a HEREDOC to preserve formatting.
6. Run `git push`.
7. Confirm with the short commit SHA.
