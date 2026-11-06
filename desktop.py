
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import webview

ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

BACKEND_URL = "http://127.0.0.1:3001"
FRONTEND_URL = "http://127.0.0.1:5173"


def wait_for_server(url, process, timeout=30):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(
                f"Server stopped unexpectedly: {url}"
            )

        try:
            with urllib.request.urlopen(
                url, timeout=1
            ) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)

    raise TimeoutError(
        f"Server did not become ready: {url}"
    )


def stop_process(process):
    if process is None or process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            [
                "taskkill",
                "/PID",
                str(process.pid),
                "/T",
                "/F",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main():
    backend = None
    frontend = None

    try:
        print("Starting DocBuddy backend...")

        backend = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "src.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "3001",
            ],
            cwd=BACKEND_DIR,
        )

        print("Starting React frontend...")

        frontend = subprocess.Popen(
            [
                "npm.cmd" if os.name == "nt" else "npm",
                "run",
                "dev",
                "--",
                "--host",
                "127.0.0.1",
                "--port",
                "5173",
                "--strictPort",
            ],
            cwd=FRONTEND_DIR,
        )

        wait_for_server(
            f"{BACKEND_URL}/api/health",
            backend,
        )

        wait_for_server(
            FRONTEND_URL,
            frontend,
        )

        print("Opening DocBuddy...")

        webview.create_window(
            title="DocBuddy",
            url=FRONTEND_URL,
            width=1400,
            height=900,
            min_size=(900, 600),
            background_color="#0B1020",
        )

        webview.start()

    finally:
        print("Stopping DocBuddy servers...")
        stop_process(frontend)
        stop_process(backend)


if __name__ == "__main__":
    main()
