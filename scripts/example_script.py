"""Example script: the scripting area's shape.

Scripts are plain files run via `uv run --directory scripts example_script.py`;
add dependencies to scripts/pyproject.toml (or use PEP 723 inline metadata for
one-offs).
"""


def main() -> None:
    print("Hello from the scripts workspace.")


if __name__ == "__main__":
    main()
