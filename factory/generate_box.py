#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from lib.identity import create_new_identity, load_registry


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate unique Lovebox factory identity")
    parser.add_argument("--suffix", type=int, help="Fixed 4-digit suffix for device_name")
    args = parser.parse_args()
    entry = create_new_identity(args.suffix)
    print(json.dumps(entry, indent=2))


if __name__ == "__main__":
    main()
