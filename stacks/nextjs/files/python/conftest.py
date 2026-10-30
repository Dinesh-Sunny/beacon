"""Load the shared local env file for pytest, mirroring `pnpm dev:py` and the JS test scripts."""

from pathlib import Path

from dotenv import load_dotenv

# Single local env file for every service; values already in the environment (CI) win.
LOCAL_ENV_FILE = Path(__file__).resolve().parent.parent / "apps" / "web" / ".env.local"

load_dotenv(LOCAL_ENV_FILE, override=False)
