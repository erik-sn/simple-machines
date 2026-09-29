"""The ownership gate (just template-check).

Verifies template-owned files still match the template version this project
was generated from.

Mechanics: renders a pristine copy of the recorded template version into a
temp directory (copier, using .copier-answers.yml), then byte-compares every
file template-manifest.json classes as template-owned. The escape hatch:
delete a file's `template-managed` marker line (or, for JSON files that
cannot carry one, add its path to project.json "template_takeovers") to take
ownership - the file is then reported as taken over and skipped. The known
cost of a takeover is that `copier update` may conflict on that file.

Private template repos: set TEMPLATE_TOKEN (or rely on ambient git auth).
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKER = "template-managed (bootstrap)"


def parse_answers(path: Path) -> dict[str, str]:
    """Minimal parser for copier's flat key: value answers file."""
    answers: dict[str, str] = {}
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in stripped:
            continue
        key, _, value = stripped.partition(":")
        answers[key.strip()] = value.strip().strip("'\"")
    return answers


def has_marker(path: Path) -> bool:
    try:
        head = path.read_text(errors="replace").splitlines()[:5]
    except OSError:
        return False
    return any(MARKER in line for line in head)


def git_env(src: str) -> dict[str, str]:
    """Route the template clone through TEMPLATE_TOKEN without touching global git config."""
    env = dict(os.environ)
    token = env.get("TEMPLATE_TOKEN", "")
    if token and src.startswith(("https://github.com/", "gh:")):
        # copier honors GIT_CONFIG_* environment overrides.
        env |= {
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": f"url.https://x-access-token:{token}@github.com/.insteadOf",
            "GIT_CONFIG_VALUE_0": "https://github.com/",
        }
    return env


def render_pristine(answers: dict[str, str], destination: str) -> bool:
    """Render the recorded template version into destination; False when copier fails."""
    src = answers["_src_path"]
    data_args: list[str] = []
    for key, value in answers.items():
        if not key.startswith("_"):
            data_args += ["--data", f"{key}={value}"]
    command = ["copier", "copy", "--vcs-ref", answers["_commit"], "--defaults", "--force"]
    command += [*data_args, src, destination]
    # Arguments come from the answers file this repo committed, not from a
    # request; copier is a mise-pinned tool resolved on PATH.
    result = subprocess.run(command, capture_output=True, text=True, env=git_env(src))  # noqa: S603
    if result.returncode != 0:
        print(result.stdout + result.stderr, file=sys.stderr)
        print("template-check: pristine render failed (network/auth?).", file=sys.stderr)
        return False
    return True


def compare(pristine_root: Path, takeovers: set[str]) -> tuple[list[str], list[str]]:
    """Return (taken_over, diverged) template-owned paths against the pristine render."""
    manifest = json.loads((ROOT / "template-manifest.json").read_text())
    taken_over: list[str] = []
    diverged: list[str] = []
    for entry in manifest["files"]:
        if entry["class"] != "template-owned":
            continue
        rel = entry["path"]
        local = ROOT / rel
        pristine = pristine_root / rel
        if not local.exists():
            # Absent on both sides: excluded by a stack toggle (the Rust files
            # in a non-Rust project). Absent locally only: deleted, which is a
            # takeover when project.json lists the path and divergence otherwise.
            if rel in takeovers:
                taken_over.append(rel)
            elif pristine.exists():
                diverged.append(f"{rel} (deleted locally)")
            continue
        marker_dropped = local.suffix != ".json" and not has_marker(local) and has_marker(pristine)
        if rel in takeovers or marker_dropped:
            taken_over.append(rel)
        elif pristine.exists() and local.read_bytes() != pristine.read_bytes():
            # A path present locally but absent from this template version is
            # fine: a newer template than the recorded one cannot occur here.
            diverged.append(rel)
    return taken_over, diverged


def report(taken_over: list[str], diverged: list[str]) -> int:
    if taken_over:
        print("template-check: taken-over files (yours now; copier update may conflict):")
        for rel in taken_over:
            print(f"  - {rel}")
    if not diverged:
        print("template-check: ok")
        return 0
    print(
        "template-check: template-owned files differ from the recorded template version:",
        file=sys.stderr,
    )
    for rel in diverged:
        print(f"  - {rel}", file=sys.stderr)
    print(
        "Fix: revert the edit, or take ownership (delete the marker line,"
        " or add the path to project.json template_takeovers) with the"
        " reason in the commit message.",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    answers_path = ROOT / ".copier-answers.yml"
    if not answers_path.exists():
        print("template-check: no .copier-answers.yml (template development instance); skipping.")
        return 0

    answers = parse_answers(answers_path)
    if not answers.get("_src_path") or not answers.get("_commit"):
        print("template-check: answers file lacks _src_path/_commit.", file=sys.stderr)
        return 1

    facts = json.loads((ROOT / "project.json").read_text())
    takeovers: set[str] = set(facts.get("template_takeovers", []))

    with tempfile.TemporaryDirectory() as tmp:
        if not render_pristine(answers, tmp):
            return 1
        taken_over, diverged = compare(Path(tmp), takeovers)
    return report(taken_over, diverged)


if __name__ == "__main__":
    sys.exit(main())
