# Sandbox Design Document

**Project:** SecureCode Academy · **Component:** Code execution sandbox (`server/src/sandbox.js`, `challenges/_shared/_guard.py`)

## 1. Problem

Learners submit arbitrary Python that the server executes (to run an exploit against a vulnerable mini-app, and to run a hidden test-suite against their patch). That code is **untrusted by definition** and must not be able to destroy the server, steal data, attack other users or the network, or exhaust resources.

## 2. Threat model

| # | Threat | Example | Mitigation |
|---|--------|---------|-----------|
| T1 | Run commands on the host | `os.system("rm -rf /")`, `subprocess` | Runs inside a container, not on the host; non-root user; all Linux capabilities dropped; `no-new-privileges`; in-process audit hook blocks `os.system`, `subprocess.Popen`, `os.exec*`, `os.fork` |
| T2 | Modify or read the host filesystem | write files, read `.env`, the database, other users' code | Root filesystem is `--read-only`; only a throw-away `/tmp` tmpfs (8 MB, `noexec`) is writable; the only mount is the run's own temp folder, mounted **read-only**; secrets and DB are never mounted; audit hook blocks file writes |
| T3 | Network abuse | port scanning, calling the cloud metadata service, exfiltrating data, DDoS | `--network none` - the container has no network interface at all; audit hook also blocks `socket.connect/bind` |
| T4 | CPU exhaustion | `while True: pass`, fork bombs | `--cpus 0.5`, `--pids-limit 64`, 5 s wall-clock timeout after which the container is force-removed (`docker rm -f`), `RLIMIT_CPU` 3 s |
| T5 | Memory exhaustion | `"x" * 10**10` | `--memory 128m --memory-swap 128m` (OOM-killed inside the container, host unaffected); `RLIMIT_AS` 1 GB as a backstop |
| T6 | Output flooding | print gigabytes to stdout | The server stops collecting after 64 KB per stream and returns a truncated result |
| T7 | Persistence between runs | leave a backdoor for the next learner | **Ephemeral**: one new container per run (`--rm`), temp folder deleted afterwards. Nothing survives |
| T8 | One user starving the others | spam the *Run* button | Per-user rate limit (30 requests/min), global cap of 4 concurrent sandbox runs (extra requests get HTTP 429), 20 KB maximum code size |
| T9 | Tampering with results | printing a fake "all tests passed" line | Result line carries a random per-run **nonce** that the learner's code never receives; lines without the correct nonce are ignored |
| T10 | Escaping through the harness | importing the grader's modules | The harness only exposes the learner's function and a fresh in-memory database / fixtures object per test; the hidden tests are never sent to the browser |

## 3. Layers (defence in depth)

1. **Ephemeral Docker container per run** - the primary boundary.
   ```
   docker run --rm -i --network none --memory 128m --memory-swap 128m --cpus 0.5
              --pids-limit 64 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=8m
              --cap-drop ALL --security-opt no-new-privileges --user 65534:65534
              -v <run-dir>:/work:ro -w /work python:3.12-alpine python run.py
   ```
2. **Language-level guard** (`_guard.py`, a Python audit hook installed *before* the learner's module is imported) - blocks process creation, network and destructive file operations, and sets CPU/address-space `rlimit`s. This is *not* a security boundary on its own (Python sandboxing from inside is famously leaky) but it makes the local fallback and the container safer.
3. **Application limits** - timeouts, output cap, code-size cap, concurrency cap, per-user rate limit.
4. **Input handling** - challenge slugs are validated against `^[a-z0-9-]+$` (no path traversal); file names written to the run folder are validated; the exploit form accepts only short strings/numbers; user data is passed to the harness as JSON on stdin, never through a shell command line (`spawn` with an argument array, no `shell: true`).

## 4. Execution flow

```
Browser ──POST /api/challenges/:slug/{exploit|validate}──▶ Express (JWT auth, rate limit)
   └─▶ challengeRunner: copy harness + _guard.py + user_code.py + fixtures into a fresh temp dir
        └─▶ sandbox.runPython: docker run … (or local fallback) → stdout/stderr, timeout kill
             └─▶ parse nonce-tagged JSON result → API response → XP / badge logic (only on full pass)
```

The learner's code is never `exec`'d inside the Node.js process.

## 5. Browser-side challenges (XSS)

JavaScript challenges run in the learner's own browser inside an `<iframe sandbox="allow-scripts">` **without** `allow-same-origin`. The frame has an opaque origin, so it cannot read the platform's cookies, `localStorage`, or DOM, and it can only talk to the page through `postMessage`. Code that loops forever only freezes that frame; the parent times out after 6 s and removes it.

Because the XSS tests run on the client, the "challenge completed" signal for that one lesson is client-reported. This is an accepted trade-off for a learning platform (cheating only cheats yourself) and is documented rather than hidden. Server-validated challenges (SQLi, IDOR) can *only* be completed through `/validate`; the generic `/complete` endpoint rejects them.

## 6. Operating modes

| Mode | When | Isolation |
|------|------|-----------|
| `docker` | Server has Docker (recommended for production on a VM) | Full container isolation per run |
| `local` | Development, or PaaS hosts without Docker | Child process + audit hook + rlimits + timeout. **Weaker** - use only for demos / trusted users |

`SANDBOX_MODE=auto` (default) picks Docker when it is reachable and falls back to local with a loud console warning.

## 7. Residual risks and next steps

- **Local mode is not hardened** against a determined attacker. Production should use `SANDBOX_MODE=docker`.
- Giving a web server access to the Docker socket is itself powerful. Better options: a dedicated sandbox host/service, rootless Docker, or [Piston](https://github.com/engineer-man/piston) / gVisor / Firecracker for a stronger kernel boundary.
- Add seccomp profile tightening and a read-only image with only the Python standard library.
- Pin the image by digest and rebuild it regularly.
- Log every run (user, challenge, duration, exit status) for abuse detection.
