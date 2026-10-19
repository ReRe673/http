from __future__ import annotations

import argparse
import json
import posixpath
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

GROUPS = [
    (1, 1, "cover"),
    (2, 3, "profile"),
    (4, 12, "journal"),
    (13, 24, "equipment"),
    (25, 28, "nsh"),
    (29, 32, "event"),
    (33, 35, "additional"),
    (36, 36, "thanks"),
]


def group_for_slide(number: int) -> str:
    for start, end, group in GROUPS:
        if start <= number <= end:
            return group
    raise ValueError(f"Unmapped slide: {number}")


def natural_number(name: str) -> int:
    match = re.search(r"(\d+)", name)
    return int(match.group(1)) if match else 0


def text_blocks(root: ET.Element) -> list[str]:
    blocks: list[str] = []
    for shape in root.findall(".//p:sp", NS):
        parts = [node.text or "" for node in shape.findall(".//a:t", NS)]
        text = "".join(parts).strip()
        if text:
            blocks.append(text)
    return blocks


def relationship_map(archive: zipfile.ZipFile, slide_number: int) -> dict[str, str]:
    path = f"ppt/slides/_rels/slide{slide_number}.xml.rels"
    try:
        root = ET.fromstring(archive.read(path))
    except KeyError:
        return {}
    result: dict[str, str] = {}
    for rel in root.findall("pr:Relationship", NS):
        target = rel.attrib.get("Target", "")
        if "../media/" in target:
            result[rel.attrib["Id"]] = posixpath.basename(target)
    return result


def slide_media(root: ET.Element, relationships: dict[str, str]) -> list[str]:
    ids: list[str] = []
    for node in root.iter():
        for key, value in node.attrib.items():
            if key.endswith("}embed") or key.endswith("}link"):
                if value in relationships and relationships[value] not in ids:
                    ids.append(relationships[value])
    return ids


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--media-dir", type=Path, required=True)
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.media_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(args.pptx) as archive:
        slide_paths = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=natural_number,
        )
        media_paths = sorted(
            (name for name in archive.namelist() if name.startswith("ppt/media/") and not name.endswith("/")),
            key=natural_number,
        )

        slides = []
        media_usage: dict[str, list[int]] = {posixpath.basename(path): [] for path in media_paths}
        for path in slide_paths:
            number = natural_number(path)
            root = ET.fromstring(archive.read(path))
            rels = relationship_map(archive, number)
            referenced_media = slide_media(root, rels)
            for filename in referenced_media:
                media_usage.setdefault(filename, []).append(number)
            slides.append(
                {
                    "number": number,
                    "group": group_for_slide(number),
                    "textBlocks": text_blocks(root),
                    "media": referenced_media,
                    "render": f"/slides/slide-{number}.png",
                }
            )

        media = []
        for path in media_paths:
            filename = posixpath.basename(path)
            destination = args.media_dir / filename
            with archive.open(path) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
            extension = destination.suffix.lower()
            slides_used = media_usage.get(filename, [])
            media.append(
                {
                    "filename": filename,
                    "path": f"/source-media/{filename}",
                    "extension": extension,
                    "bytes": destination.stat().st_size,
                    "slides": slides_used,
                    "status": "direct-video" if extension == ".mp4" else "presented-with-source-slide",
                }
            )

    payload = {
        "source": args.pptx.name,
        "slideCount": len(slides),
        "mediaCount": len(media),
        "slides": slides,
        "media": media,
    }
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"slides": len(slides), "media": len(media)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
