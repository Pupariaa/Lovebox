#!/usr/bin/env python3
"""Apply a Lucarne Studio export into the firmware sketch.

This automates the manual reconciliation that a raw Studio export needs:
  - copies the generated headers (Projet.h / fonts / icons / images)
  - re-injects the BacLocale translation hooks that Studio does not emit
    (include, prepare(), and menu labels -> BacLocale::lbl_*)
  - never overwrites the hand-maintained Projet_setup.h / LucarneUserConfig.h
  - mirrors the volume assets into data/assets and regenerates the OTA manifest
  - validates BacApp.h widget references against the new widget types so that
    renumbered widgets (setText on a non-Label, etc.) are reported instead of
    turning into a silent compile break.

Usage:
    python factory/apply_ui_export.py "C:/path/to/Lovebox_export"
    python factory/apply_ui_export.py <export_dir> --sketch firmware/boite-a-coeur
"""

import argparse
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
import ffat  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SKETCH = REPO_ROOT / "firmware" / "boite-a-coeur"

# Generated headers copied verbatim from the export.
GENERATED_HEADERS = [
    "Projet.h",
    "Projet_fonts.h",
    "Projet_icons.h",
    "Projet_images.h",
]

# Hand-maintained headers: never overwritten, only diff-reported.
PRESERVED_HEADERS = [
    "Projet_setup.h",
    "LucarneUserConfig.h",
]

# Menu labels that Studio emits as literals but must go through BacLocale so the
# device stays translatable. Only the first argument of addItem/addCallbackItem
# is rewritten, so language names (Francais, English, ...) are left untouched.
MENU_LOCALE = {
    "Paramètres": "lbl_settings",
    "Réinitialiser": "lbl_reset",
    "Informations": "lbl_info",
    "Quitter": "lbl_quit",
    "WIFI": "lbl_wifi",
    "WiFi": "lbl_wifi",
    "Langue": "lbl_language",
    "Retour": "lbl_back",
    "Déconnecter": "lbl_disconnect",
    "Tester": "lbl_test",
    "Confirmer": "lbl_confirm",
}

WIDGET_DECL_RE = re.compile(r"^(Label|Icon|Image|Menu|Bar)\s+(w\d+)\(", re.MULTILINE)
BACAPP_REF_RE = re.compile(r"projet::(w\d+)\.(\w+)\(")

# Method -> required widget type. Used to flag mismatched references.
METHOD_REQUIRES = {
    "setText": "Label",
    "setColor": "Label",
    "setSelected": "Menu",
    "selectedIndex": "Menu",
    "setItemStyle": "Menu",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8", newline="\n")


def inject_locale_hooks(projet_src: str) -> str:
    text = projet_src

    if '#include "BacLocale.h"' not in text:
        text = text.replace(
            '#include "Projet_setup.h"',
            '#include "Projet_setup.h"\n#include "BacLocale.h"',
            1,
        )

    if "BacLocale::prepare(" not in text:
        text = text.replace(
            "inline void build(UI &ui) {\n",
            'inline void build(UI &ui) {\n    BacLocale::prepare("fr");\n',
            1,
        )

    def repl(match: re.Match) -> str:
        call, label = match.group(1), match.group(2)
        key = MENU_LOCALE.get(label)
        if not key:
            return match.group(0)
        return f"{call}BacLocale::{key},"

    text = re.sub(r"(addItem\(|addCallbackItem\()\"([^\"]+)\",", repl, text)
    return text


def mirror_assets(src_assets: Path, dst_assets: Path) -> None:
    if not src_assets.is_dir():
        log(f"WARN: no assets folder in export ({src_assets})")
        return
    dst_assets.mkdir(parents=True, exist_ok=True)

    src_files = {p.relative_to(src_assets) for p in src_assets.rglob("*") if p.is_file()}
    for rel in sorted(src_files):
        target = dst_assets / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_assets / rel, target)

    # Remove stale files/dirs no longer in the export, but keep the OTA manifest.
    for p in sorted(dst_assets.rglob("*"), reverse=True):
        rel = p.relative_to(dst_assets)
        if p.is_file():
            if p.name == ".manifest":
                continue
            if rel not in src_files:
                p.unlink()
        elif p.is_dir():
            if not any(p.iterdir()):
                p.rmdir()

    log(f"assets mirrored: {len(src_files)} files")


def report_preserved(export_dir: Path, sketch: Path) -> None:
    for name in PRESERVED_HEADERS:
        exp = export_dir / name
        cur = sketch / name
        if not exp.exists() or not cur.exists():
            continue
        if read_text(exp) != read_text(cur):
            log(f"KEPT (hand-maintained, export differs): {name}")


def widget_types(projet_path: Path) -> dict:
    text = read_text(projet_path)
    return {name: typ for typ, name in WIDGET_DECL_RE.findall(text)}


def validate_bacapp(sketch: Path) -> int:
    projet = sketch / "Projet.h"
    bacapp = sketch / "BacApp.h"
    if not bacapp.exists():
        return 0
    types = widget_types(projet)
    issues = 0
    for lineno, line in enumerate(read_text(bacapp).splitlines(), start=1):
        for wid, method in BACAPP_REF_RE.findall(line):
            typ = types.get(wid)
            if typ is None:
                log(f"BINDING ERROR {bacapp.name}:{lineno} {wid} no longer exists")
                issues += 1
                continue
            need = METHOD_REQUIRES.get(method)
            if need and typ != need:
                log(
                    f"BINDING ERROR {bacapp.name}:{lineno} {wid}.{method}() "
                    f"but {wid} is now a {typ} (expected {need})"
                )
                issues += 1
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply a Lucarne Studio export into the sketch")
    parser.add_argument("export_dir", help="Path to the Studio export folder")
    parser.add_argument("--sketch", default=str(DEFAULT_SKETCH), help="Sketch folder")
    args = parser.parse_args()

    export_dir = Path(args.export_dir)
    sketch = Path(args.sketch)
    if not export_dir.is_dir():
        log(f"ERROR: export dir not found: {export_dir}")
        return 2
    if not (export_dir / "Projet.h").exists():
        log(f"ERROR: no Projet.h in export dir: {export_dir}")
        return 2

    for name in GENERATED_HEADERS:
        src = export_dir / name
        if not src.exists():
            log(f"WARN: missing in export: {name}")
            continue
        if name == "Projet.h":
            write_text(sketch / name, inject_locale_hooks(read_text(src)))
            log(f"copied + localized: {name}")
        else:
            shutil.copy2(src, sketch / name)
            log(f"copied: {name}")

    report_preserved(export_dir, sketch)
    mirror_assets(export_dir / "assets", sketch / "data" / "assets")
    ffat.write_local_manifest(sketch / "data" / "assets")

    issues = validate_bacapp(sketch)
    if issues:
        log("")
        log(f"{issues} widget binding issue(s) found: fix the BacApp.h lines above.")
        log("(A widget was renumbered by Studio; point the call at the right wN.)")
        return 1

    log("")
    log("Done. Upload data/ to FFat and flash.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
