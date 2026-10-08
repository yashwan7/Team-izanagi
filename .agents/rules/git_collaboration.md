# Git Collaboration Protocol for Team-izanagi

Four team members are actively developing from separate laptops simultaneously.
To prevent merge conflicts, lost work, or desynchronized history:

1. **Always Pull Before Pushing**:
   - Before making any commit/push, run `git pull --rebase origin main` (or appropriate branch) to incorporate remote changes from teammates.
   - If conflicts arise, resolve them cleanly and verify code integrity before finalizing.

2. **Commit Hygiene**:
   - Keep commits focused and descriptive so teammates know what changed.
   - Stage only relevant files (`git add <specific files>`).

3. **Status Check**:
   - Always run `git status` and `git pull` before starting new tasks or pushing code.
