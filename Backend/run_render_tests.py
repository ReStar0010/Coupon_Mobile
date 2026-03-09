from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path


def _repo_root() -> Path:
    # This file lives at <repo>/Backend/run_render_tests.py
    return Path(__file__).resolve().parents[1]


def _debug_log_path() -> Path:
    return _repo_root() / ".cursor" / "debug.log"


def _emit_log(*, run_id: str, hypothesis_id: str, location: str, message: str, data: dict) -> None:
    payload = {
        "id": f"log_{int(time.time() * 1000)}_{os.getpid()}",
        "timestamp": int(time.time() * 1000),
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
    }
    p = _debug_log_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    try:
        with p.open("a", encoding="utf-8") as f:
            f.write(line)
        return
    except PermissionError:
        # Fallback: send to provisioned local ingest server which writes to the same debug.log.
        # (No sessionId in this debug session.)
        try:
            req = urllib.request.Request(
                "http://127.0.0.1:7245/ingest/ba43f98c-8cfc-426e-89da-fdae06e0bac4",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(req, timeout=2)  # noqa: S310
        except Exception:
            # Best-effort only; never fail the run due to logging.
            return


def _build_remote_command(*, verbosity: int) -> str:
    v = "2" if verbosity >= 2 else ("1" if verbosity == 1 else "0")
    # Try common Render working directories, then locate manage.py.
    return (
        "bash -lc '"
        "set -u; "
        "cd /opt/render/project/src/Backend 2>/dev/null || "
        "cd /opt/render/project/src/backend 2>/dev/null || "
        "cd /opt/render/project/src 2>/dev/null || "
        "cd ~; "
        "echo \"REMOTE_PWD=$(pwd)\"; "
        "python -V || true; "
        "if [ -f manage.py ]; then "
        f"  python manage.py test -v {v}; "
        "elif [ -f Backend/manage.py ]; then "
        f"  python Backend/manage.py test -v {v}; "
        "else "
        "  echo \"manage.py not found\"; exit 2; "
        "fi'"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Django tests on Render over SSH.")
    parser.add_argument(
        "--host",
        default="srv-d6aol4jnv86c739r3b0g@ssh.singapore.render.com",
        help="Render SSH user@host",
    )
    parser.add_argument("--run-id", default="pre-fix", help="Label runs (pre-fix/post-fix)")
    parser.add_argument("-v", "--verbosity", type=int, default=2, help="Django test verbosity (0-2)")
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=900,
        help="Abort if SSH command exceeds this many seconds",
    )
    args = parser.parse_args()

    location = "Backend/run_render_tests.py:main"
    # region agent log
    _emit_log(
        run_id=args.run_id,
        hypothesis_id="runner",
        location=location,
        message="Starting SSH test run",
        data={"host": args.host, "verbosity": args.verbosity},
    )
    # endregion

    remote_cmd = _build_remote_command(verbosity=args.verbosity)
    ssh_cmd = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
        "-o",
        "ServerAliveInterval=5",
        "-o",
        "ServerAliveCountMax=3",
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=/dev/null",
        args.host,
        remote_cmd,
    ]

    t0 = time.time()
    proc = subprocess.Popen(
        ssh_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    combined_out: list[str] = []
    timed_out = False
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(line)
        combined_out.append(line)
        if (time.time() - t0) > args.timeout_seconds:
            timed_out = True
            break

    if timed_out:
        try:
            proc.kill()
        except Exception:
            pass
        elapsed_ms = int((time.time() - t0) * 1000)
        # region agent log
        _emit_log(
            run_id=args.run_id,
            hypothesis_id="runner",
            location=location,
            message="SSH test run timed out",
            data={"elapsedMs": elapsed_ms, "timeoutSeconds": args.timeout_seconds, "partialOut": "".join(combined_out)[-4000:]},
        )
        # endregion
        sys.stderr.write("SSH test run timed out.\n")
        return 124

    return_code = proc.wait()
    elapsed_ms = int((time.time() - t0) * 1000)

    stdout = "".join(combined_out)
    stderr = ""

    def _snip(s: str, *, max_chars: int = 6000) -> str:
        s = s.replace("\r\n", "\n")
        if len(s) <= max_chars:
            return s
        head = s[: int(max_chars * 0.25)]
        tail = s[-int(max_chars * 0.75) :]
        return head + "\n...\n" + tail

    # region agent log
    _emit_log(
        run_id=args.run_id,
        hypothesis_id="runner",
        location=location,
        message="SSH test run finished",
        data={
            "exitCode": return_code,
            "elapsedMs": elapsed_ms,
            "stdoutLen": len(stdout),
            "stderrLen": len(stderr),
            "stdoutSnip": _snip(stdout),
            "stderrSnip": _snip(stderr),
        },
    )
    # endregion

    return return_code


if __name__ == "__main__":
    raise SystemExit(main())

