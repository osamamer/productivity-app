# Productivity App - So Life Doesn't Get Overwhelming
An app designed to help you manage various aspects of your life while keeping things light and fun.

## Tech Stack Used
**Backend**: Java and SpringBoot.

**Frontend**: React and Material UI.

Build the docker image with:
```sh
./deployment/build-docker-image.sh
```
Rerun the app after making changes to the backend:
```sh
./rerun-after-changes.sh
```

## Dev Coach

`dev-coach` turns a development goal into repository-grounded lessons backed by Codex. It explains the current concept, identifies the code target, reveals progressive hints, and assesses the current working tree without editing it.

```sh
./dev-coach/devcoach doctor
./dev-coach/devcoach start "add validation to task creation"
./dev-coach/devcoach resume
```

Use `--repo PATH` to coach a different Git repository and `--mode pair` for earlier scaffolding. Sessions are stored under `$XDG_STATE_HOME/devcoach` or `~/.local/state/devcoach`, not in the repository.
