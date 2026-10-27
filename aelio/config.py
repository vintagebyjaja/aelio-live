"""Runtime configuration for AELIO Studio.

All values come from environment variables so that secrets never live in source
control. Nothing in this module talks to the public aelio.live website.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.environ.get("AELIO_DATA_DIR", ROOT / "var")).resolve())
    # Cookies are marked Secure unless explicitly running local http dev.
    secure_cookies: bool = field(default_factory=lambda: _bool("AELIO_SECURE_COOKIES", True))
    session_hours: int = field(default_factory=lambda: int(os.environ.get("AELIO_SESSION_HOURS", "12")))
    # A founder must have re-entered an MFA code this recently to approve deployments.
    mfa_fresh_minutes: int = field(default_factory=lambda: int(os.environ.get("AELIO_MFA_FRESH_MINUTES", "10")))
    allowed_hosts: list[str] = field(default_factory=lambda: os.environ.get(
        "AELIO_ALLOWED_HOSTS", "studio.aelio.live,localhost,127.0.0.1,testserver").split(","))
    sandbox_backend: str = field(default_factory=lambda: os.environ.get("AELIO_SANDBOX", "auto"))  # auto|docker|namespace|none
    worker_threads: int = field(default_factory=lambda: int(os.environ.get("AELIO_WORKERS", "1")))
    start_worker: bool = field(default_factory=lambda: _bool("AELIO_START_WORKER", True))
    telemetry_interval_s: int = field(default_factory=lambda: int(os.environ.get("AELIO_TELEMETRY_INTERVAL", "30")))

    @property
    def db_path(self) -> Path:
        return self.data_dir / "aelio.sqlite3"

    @property
    def artifacts_dir(self) -> Path:
        return self.data_dir / "artifacts"

    @property
    def workspaces_dir(self) -> Path:
        return self.data_dir / "workspaces"

    @property
    def secrets_dir(self) -> Path:
        return self.data_dir / "secrets"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.artifacts_dir, self.workspaces_dir, self.secrets_dir,
                  self.artifacts_dir / "checkpoints", self.artifacts_dir / "datasets",
                  self.artifacts_dir / "logs", self.artifacts_dir / "audio"):
            p.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(self.secrets_dir, 0o700)
        except OSError:
            pass


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.ensure_dirs()
    return _settings


def reset_settings(s: Settings | None = None) -> Settings:
    """Used by tests and the CLI to point at a different data dir."""
    global _settings
    _settings = s or Settings()
    _settings.ensure_dirs()
    return _settings


PROTECTED_SUITES_DIR = ROOT / "protected_suites"
SAMPLES_DIR = ROOT / "samples"
BENCHMARKS_DIR = ROOT / "benchmarks"
WEB_DIST = ROOT / "web" / "dist"
