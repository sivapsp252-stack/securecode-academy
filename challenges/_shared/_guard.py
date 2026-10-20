"""Defence-in-depth guard that runs INSIDE the sandbox before any user code is imported.
The real isolation boundary is the Docker container (see docs/SANDBOX_DESIGN.md);
this hook adds a second layer so the local-dev fallback is not wide open either."""
import sys

BLOCKED = {
    "os.system", "os.exec", "os.fork", "os.forkpty", "os.posix_spawn", "os.spawn",
    "os.kill", "os.killpg", "os.remove", "os.rmdir", "os.rename", "os.mkdir",
    "os.chmod", "os.chown", "os.truncate", "os.symlink", "os.link",
    "subprocess.Popen", "socket.connect", "socket.bind", "socket.getaddrinfo",
    "ctypes.dlopen", "ctypes.dlsym", "shutil.rmtree", "shutil.move", "shutil.copyfile",
}


def arm():
    try:  # POSIX only: cap CPU time and address space
        import resource
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024,) * 2)
    except Exception:
        pass

    def hook(event, args):
        if event in BLOCKED:
            raise PermissionError("Blocked by SecureCode sandbox: " + event)
        if event == "open":
            mode = args[1] if len(args) > 1 and isinstance(args[1], str) else "r"
            if any(c in mode for c in "wax+"):
                raise PermissionError("Blocked by SecureCode sandbox: file writes are not allowed")

    sys.addaudithook(hook)
