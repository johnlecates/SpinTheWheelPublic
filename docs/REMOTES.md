# Multiple Remotes — Template

This is a **template** for setting up multiple git remotes on this project. The placeholders
below are not real URLs — replace them with your own hosts (GitHub, Gitea, GitLab, Bitbucket, etc.).

Your **personal** remote URLs and credentials should **not** be committed to the repo. After
cloning, edit this file locally to match your setup, or copy its commands into your shell
history. If you want to keep your customizations out of git entirely, add this file to
`.git/info/exclude` (per-clone, never committed).

## Examples

### Add a Gitea mirror

```bash
# Create the empty repo in your Gitea web UI first, then:
git remote add gitea ssh://git@<your-gitea-host>:<port>/<your-org>/<your-repo>.git
git push gitea main
```

### Add a GitLab mirror

```bash
git remote add gitlab ssh://git@<your-gitlab-host>:<port>/<your-org>/<your-repo>.git
git push gitlab main
```

### Push to all remotes at once

```bash
git remote set-url --push all <your-primary-remote-url>
git remote set-url --add --push all <your-secondary-remote-url>
git push all main --tags
```

### Push a tag to a specific remote

```bash
git push gitea v1.0.0
```

## Notes

- The default `origin` is whatever you cloned from. Add named remotes (`gitea`, `github`,
  `gitlab`, etc.) for any other hosts you want to push to.
- The `CONVENTIONS.md` file in this repo already requires every change to bump the version
  **and** create a matching tag — make sure to push tags (`--tags`) to all remotes.
