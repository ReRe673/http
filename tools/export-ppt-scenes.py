from __future__ import annotations

import argparse
import json
import posixpath
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

EMU_PER_POINT = 12700


def q(name: str) -> str:
    prefix, local = name.split(":", 1)
    return f"{{{NS[prefix]}}}{local}"


def value(node: ET.Element | None, key: str, default: float = 0) -> float:
    if node is None:
        return default
    try:
        return float(node.attrib.get(key, default))
    except (TypeError, ValueError):
        return default


def pct(number: float, total: float) -> float:
    return round(number / total * 100, 5) if total else 0


def rgb_from_color(parent: ET.Element | None, scheme: dict[str, str]) -> str | None:
    if parent is None:
        return None
    color = parent.find("a:srgbClr", NS)
    if color is not None:
        return f"#{color.attrib.get('val', '000000')}"
    color = parent.find("a:schemeClr", NS)
    if color is not None:
        return scheme.get(color.attrib.get("val", ""), "#000000")
    color = parent.find("a:sysClr", NS)
    if color is not None:
        return f"#{color.attrib.get('lastClr', '000000')}"
    return None


def read_scheme(archive: zipfile.ZipFile) -> dict[str, str]:
    root = ET.fromstring(archive.read("ppt/theme/theme1.xml"))
    result: dict[str, str] = {}
    scheme = root.find(".//a:clrScheme", NS)
    if scheme is None:
        return result
    for item in list(scheme):
        key = item.tag.rsplit("}", 1)[-1]
        color = item.find("a:srgbClr", NS)
        if color is None:
            color = item.find("a:sysClr", NS)
        if color is not None:
            raw = color.attrib.get("val") or color.attrib.get("lastClr")
            if raw:
                result[key] = f"#{raw}"
    aliases = {"tx1": "dk1", "tx2": "dk2", "bg1": "lt1", "bg2": "lt2"}
    for alias, target in aliases.items():
        if target in result:
            result[alias] = result[target]
    return result


def relationships(archive: zipfile.ZipFile, slide_number: int) -> dict[str, str]:
    root = ET.fromstring(archive.read(f"ppt/slides/_rels/slide{slide_number}.xml.rels"))
    result: dict[str, str] = {}
    for rel in root.findall("pr:Relationship", NS):
        target = rel.attrib.get("Target", "")
        if "../media/" in target:
            result[rel.attrib["Id"]] = posixpath.basename(target)
    return result


def transform_box(xfrm: ET.Element | None, mapper: tuple[float, float, float, float]) -> dict[str, float]:
    ox, oy, sx, sy = mapper
    off = xfrm.find("a:off", NS) if xfrm is not None else None
    ext = xfrm.find("a:ext", NS) if xfrm is not None else None
    x = ox + value(off, "x") * sx
    y = oy + value(off, "y") * sy
    width = value(ext, "cx") * sx
    height = value(ext, "cy") * sy
    rotation = value(xfrm, "rot") / 60000 if xfrm is not None else 0
    return {"x": x, "y": y, "width": width, "height": height, "rotation": round(rotation, 3)}


def group_mapper(group: ET.Element, parent: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    xfrm = group.find("p:grpSpPr/a:xfrm", NS)
    if xfrm is None:
        return parent
    pox, poy, psx, psy = parent
    off, ext = xfrm.find("a:off", NS), xfrm.find("a:ext", NS)
    child_off, child_ext = xfrm.find("a:chOff", NS), xfrm.find("a:chExt", NS)
    csx = value(ext, "cx", 1) / max(value(child_ext, "cx", 1), 1)
    csy = value(ext, "cy", 1) / max(value(child_ext, "cy", 1), 1)
    return (
        pox + (value(off, "x") - value(child_off, "x") * csx) * psx,
        poy + (value(off, "y") - value(child_off, "y") * csy) * psy,
        psx * csx,
        psy * csy,
    )


def text_runs(shape: ET.Element, scheme: dict[str, str]) -> list[dict]:
    output: list[dict] = []
    body = shape.find("p:txBody", NS)
    if body is None:
        return output
    for paragraph in body.findall("a:p", NS):
        paragraph_props = paragraph.find("a:pPr", NS)
        align = paragraph_props.attrib.get("algn", "l") if paragraph_props is not None else "l"
        runs: list[dict] = []
        for child in list(paragraph):
            if child.tag == q("a:r"):
                props = child.find("a:rPr", NS)
                text = child.findtext("a:t", default="", namespaces=NS)
            elif child.tag == q("a:br"):
                props, text = None, "\n"
            elif child.tag == q("a:fld"):
                props = child.find("a:rPr", NS)
                text = child.findtext("a:t", default="", namespaces=NS)
            else:
                continue
            style: dict[str, object] = {"text": text}
            if props is not None:
                if props.attrib.get("sz"):
                    style["fontSize"] = round(float(props.attrib["sz"]) / 100, 2)
                if props.attrib.get("b") == "1":
                    style["bold"] = True
                if props.attrib.get("i") == "1":
                    style["italic"] = True
                latin = props.find("a:latin", NS)
                east = props.find("a:ea", NS)
                font_node = east if east is not None else latin
                typeface = font_node.attrib.get("typeface") if font_node is not None else None
                if typeface:
                    style["fontFamily"] = typeface
                color = rgb_from_color(props.find("a:solidFill", NS), scheme)
                if color:
                    style["color"] = color
            runs.append(style)
        if not runs:
            text = paragraph.findtext("a:endParaRPr/../a:t", default="", namespaces=NS)
            if text:
                runs.append({"text": text})
        output.append({"align": align, "runs": runs})
    return output


def shape_fill(shape_props: ET.Element | None, scheme: dict[str, str], rels: dict[str, str]) -> dict:
    if shape_props is None:
        return {"kind": "none"}
    blip = shape_props.find("a:blipFill/a:blip", NS)
    if blip is None:
        blip = shape_props.find("a:blip", NS)
    if blip is not None:
        transparency = blip.find("a:alphaModFix", NS)
        if transparency is not None and value(transparency, "amt", 100000) == 0:
            return {"kind": "none"}
        rid = blip.attrib.get(q("r:embed"))
        for descendant in blip.iter():
            embedded = descendant.attrib.get(q("r:embed"))
            if embedded and rels.get(embedded, "").lower().endswith(".svg"):
                rid = embedded
        filename = rels.get(rid or "")
        if filename:
            src_rect = shape_props.find(".//a:srcRect", NS)
            crop = {key: value(src_rect, key) / 1000 for key in ("l", "t", "r", "b")}
            return {"kind": "image", "src": f"/source-media/{filename}", "filename": filename, "crop": crop}
    solid = rgb_from_color(shape_props.find("a:solidFill", NS), scheme)
    if solid:
        return {"kind": "solid", "color": solid}
    return {"kind": "none"}


def line_style(shape_props: ET.Element | None, scheme: dict[str, str]) -> dict | None:
    if shape_props is None:
        return None
    line = shape_props.find("a:ln", NS)
    if line is None or line.find("a:noFill", NS) is not None:
        return None
    color = rgb_from_color(line.find("a:solidFill", NS), scheme) or "#000000"
    width = round(value(line, "w", 12700) / EMU_PER_POINT, 2)
    return {"color": color, "width": width}


def custom_geometry(shape_props: ET.Element | None) -> dict | None:
    path = shape_props.find("a:custGeom/a:pathLst/a:path", NS) if shape_props is not None else None
    if path is None:
        return None
    commands: list[str] = []
    for command in list(path):
        local = command.tag.rsplit("}", 1)[-1]
        points = command.findall("a:pt", NS)
        if local == "moveTo" and points:
            commands.append(f"M {value(points[0], 'x')} {value(points[0], 'y')}")
        elif local == "lnTo" and points:
            commands.append(f"L {value(points[0], 'x')} {value(points[0], 'y')}")
        elif local == "cubicBezTo" and len(points) == 3:
            commands.append("C " + " ".join(f"{value(point, 'x')} {value(point, 'y')}" for point in points))
        elif local == "quadBezTo" and len(points) == 2:
            commands.append("Q " + " ".join(f"{value(point, 'x')} {value(point, 'y')}" for point in points))
        elif local == "close":
            commands.append("Z")
    if not commands:
        return None
    return {"viewBox": f"0 0 {value(path, 'w', 1)} {value(path, 'h', 1)}", "path": " ".join(commands)}


def node_name(node: ET.Element) -> tuple[str, str]:
    props = node.find("p:nvSpPr/p:cNvPr", NS)
    if props is None:
        props = node.find("p:nvPicPr/p:cNvPr", NS)
    if props is None:
        props = node.find("p:nvCxnSpPr/p:cNvPr", NS)
    if props is None:
        return "unknown", ""
    return props.attrib.get("id", "unknown"), props.attrib.get("name", "")


def walk(container: ET.Element, mapper: tuple[float, float, float, float], slide: dict, scheme: dict[str, str], rels: dict[str, str], audit: list[dict]) -> None:
    for child in list(container):
        local = child.tag.rsplit("}", 1)[-1]
        if local in {"nvGrpSpPr", "grpSpPr"}:
            continue
        if local == "grpSp":
            walk(child, group_mapper(child, mapper), slide, scheme, rels, audit)
            continue
        if local not in {"sp", "pic", "cxnSp"}:
            continue
        shape_id, name = node_name(child)
        props = child.find("p:spPr", NS)
        if props is None:
            props = child.find("p:blipFill/..", NS)
        if local == "pic":
            props = child.find("p:spPr", NS)
        xfrm = props.find("a:xfrm", NS) if props is not None else None
        box = transform_box(xfrm, mapper)
        box.update({key: pct(box[key], slide["width"] if key in {"x", "width"} else slide["height"]) for key in ("x", "y", "width", "height")})
        geometry = "rect"
        preset = props.find("a:prstGeom", NS) if props is not None else None
        if preset is not None:
            geometry = preset.attrib.get("prst", "rect")
        fill_node = child.find("p:blipFill", NS)
        if fill_node is None:
            fill_node = props
        fill = shape_fill(fill_node, scheme, rels)
        if fill["kind"] == "none":
            fill = shape_fill(props, scheme, rels)
        paragraphs = text_runs(child, scheme)
        has_text = any(run.get("text") for paragraph in paragraphs for run in paragraph["runs"])
        element = {
            "id": shape_id,
            "name": name,
            "kind": "image" if fill["kind"] == "image" else ("text" if has_text else "shape"),
            "geometry": geometry,
            "box": box,
            "fill": fill,
            "line": line_style(props, scheme),
            "paragraphs": paragraphs if has_text else [],
            "z": len(slide["elements"]),
        }
        path_data = custom_geometry(props)
        if path_data:
            element["customPath"] = path_data
        body_props = child.find("p:txBody/a:bodyPr", NS)
        if body_props is not None:
            element["textBox"] = {
                "left": pct(value(body_props, "lIns", 91440) * mapper[2], slide["width"]),
                "right": pct(value(body_props, "rIns", 91440) * mapper[2], slide["width"]),
                "top": pct(value(body_props, "tIns", 45720) * mapper[3], slide["height"]),
                "bottom": pct(value(body_props, "bIns", 45720) * mapper[3], slide["height"]),
                "anchor": body_props.attrib.get("anchor", "t"),
            }
        slide["elements"].append(element)
        audit.append({"slide": slide["number"], "shapeId": shape_id, "name": name, "status": element["kind"]})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--start", type=int, default=4)
    parser.add_argument("--end", type=int, default=12)
    args = parser.parse_args()

    with zipfile.ZipFile(args.pptx) as archive:
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        size = presentation.find("p:sldSz", NS)
        width, height = value(size, "cx"), value(size, "cy")
        scheme = read_scheme(archive)
        scenes, audit = [], []
        for number in range(args.start, args.end + 1):
            root = ET.fromstring(archive.read(f"ppt/slides/slide{number}.xml"))
            scene = {"number": number, "width": width, "height": height, "elements": []}
            tree = root.find("p:cSld/p:spTree", NS)
            if tree is not None:
                walk(tree, (0, 0, 1, 1), scene, scheme, relationships(archive, number), audit)
            scene["sourceNodeCount"] = len([item for item in audit if item["slide"] == number])
            scenes.append(scene)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.audit.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"slides": scenes}, ensure_ascii=False, indent=2), encoding="utf-8")
    args.audit.write_text(json.dumps({"nodes": audit}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"slides": len(scenes), "nodes": len(audit)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
