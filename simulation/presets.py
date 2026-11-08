"""Memuat studi kasus bawaan dari data/presets.json."""
import json
from pathlib import Path

PRESETS_PATH = Path(__file__).resolve().parent.parent / "data" / "presets.json"


def load_presets():
    with PRESETS_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)
