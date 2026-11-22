"""Đọc tư liệu người dùng đưa vào → văn bản + ảnh để Claude chọn lọc khi viết kịch bản.

    uv run tools/materials/extract.py --out series/<slug>/.studio/tu-lieu <file hoặc thư mục>...

Đọc được: PDF, Word (.docx; .doc cũ chỉ đọc khi máy có `textutil` của macOS), PowerPoint (.pptx), Excel (.xlsx),
CSV/TXT/MD, ảnh (JPG/PNG/WEBP/GIF/BMP). Ra:
  <out>/index.md     — mục lục cho Claude: từng nguồn, file văn bản, danh sách ảnh (kích thước)
  <out>/index.json   — cùng nội dung dạng máy đọc (trang web dùng để đếm)
  <out>/text/NN-<tên>.md
  <out>/images/NN-<tên>-K.jpg  — ảnh rời + ảnh nhúng trong PDF/Word/PowerPoint (bỏ ảnh nhỏ kiểu icon), cạnh dài ≤ 2000 px
Nguồn không đổi (cùng đường dẫn, cỡ, giờ sửa) thì dùng lại kết quả lần trước.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile
from pathlib import Path

TEXT_EXT = {".txt", ".md", ".csv"}
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
DOC_EXT = {".pdf", ".docx", ".doc", ".pptx", ".xlsx"} | TEXT_EXT | IMG_EXT
MAX_FILES = 300
MAX_BYTES = 300 * 1024 * 1024
MAX_CHARS = 300_000
MAX_IMG_PER_FILE = 40
MIN_SIDE = 240  # ảnh nhỏ hơn (icon, đường kẻ) bỏ qua
SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".venv"}


def slug(s: str, n: int = 40) -> str:
    s = unicodedata.normalize("NFD", s).replace("đ", "d").replace("Đ", "D")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return (re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "tu-lieu")[:n]


def collect(inputs: list[str]) -> tuple[list[Path], list[str]]:
    files: list[Path] = []
    notes: list[str] = []
    for raw in inputs:
        p = Path(raw).expanduser()
        if not p.exists():
            notes.append(f"không thấy: {raw}")
            continue
        cands = [p] if p.is_file() else sorted(
            f for f in p.rglob("*") if f.is_file() and not any(part.startswith(".") or part in SKIP_DIRS for part in f.relative_to(p).parts)
        )
        for f in cands:
            if f.suffix.lower() not in DOC_EXT:
                if p.is_file():
                    notes.append(f"bỏ qua (chưa đọc được loại file này): {f.name}")
                continue
            if f.stat().st_size > MAX_BYTES:
                notes.append(f"bỏ qua (quá 300 MB): {f.name}")
                continue
            if len(files) >= MAX_FILES:
                notes.append(f"đã đủ {MAX_FILES} file — bỏ qua phần còn lại")
                return files, notes
            files.append(f.resolve())
    # bỏ trùng, giữ thứ tự
    seen: set[Path] = set()
    return [f for f in files if not (f in seen or seen.add(f))], notes


class Out:
    def __init__(self, root: Path, prefix: str):
        self.root, self.prefix, self.images = root, prefix, []

    def add_image(self, data: bytes | None = None, path: Path | None = None, label: str = "") -> None:
        if len(self.images) >= MAX_IMG_PER_FILE:
            return
        from PIL import Image

        try:
            im = Image.open(path if path else io.BytesIO(data or b""))
            im.load()
        except Exception:
            return
        if min(im.size) < MIN_SIDE:
            return
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        im.thumbnail((2000, 2000))
        name = f"{self.prefix}-{len(self.images) + 1}.jpg"
        im.save(self.root / "images" / name, "JPEG", quality=88)
        self.images.append({"file": f"images/{name}", "w": im.size[0], "h": im.size[1], **({"where": label} if label else {})})


def md_table(rows: list[list]) -> str:
    rows = [["" if c is None else str(c).replace("|", "/").replace("\n", " ").strip() for c in r] for r in rows]
    rows = [r for r in rows if any(r)]
    if not rows:
        return ""
    w = max(len(r) for r in rows)
    rows = [r + [""] * (w - len(r)) for r in rows]
    return "\n".join(["| " + " | ".join(rows[0]) + " |", "|" + "---|" * w] + ["| " + " | ".join(r) + " |" for r in rows[1:]])


def zip_media(f: Path, folder: str, out: Out) -> None:
    with zipfile.ZipFile(f) as z:
        for n in sorted(z.namelist()):
            if n.startswith(folder) and Path(n).suffix.lower() in IMG_EXT | {".jpeg", ".tif", ".tiff"}:
                out.add_image(z.read(n), label=Path(n).name)


def read_pdf(f: Path, out: Out) -> tuple[str, dict]:
    from pypdf import PdfReader

    r = PdfReader(str(f))
    parts = []
    for i, page in enumerate(r.pages, 1):
        t = (page.extract_text() or "").strip()
        if t:
            parts.append(f"## Trang {i}\n\n{t}")
        try:
            for im in page.images:
                out.add_image(im.data, label=f"trang {i}")
        except Exception:
            pass
    return "\n\n".join(parts), {"pages": len(r.pages)}


def read_docx(f: Path, out: Out) -> tuple[str, dict]:
    import docx

    d = docx.Document(str(f))
    parts = []
    body = d.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            p = docx.text.paragraph.Paragraph(child, d)
            t = p.text.strip()
            if not t:
                continue
            st = (p.style.name or "").lower() if p.style is not None else ""
            m = re.match(r"(heading|title)\s*(\d*)", st)
            if m:
                parts.append("#" * min(4, int(m.group(2) or 1) + 1) + " " + t)
            elif "list" in st:
                parts.append(f"- {t}")
            else:
                parts.append(t)
        elif tag == "tbl":
            tb = docx.table.Table(child, d)
            parts.append(md_table([[c.text for c in row.cells] for row in tb.rows]))
    zip_media(f, "word/media/", out)
    return "\n\n".join(p for p in parts if p), {}


def read_doc(f: Path, out: Out) -> tuple[str, dict]:
    if not shutil.which("textutil"):
        raise RuntimeError("file .doc cũ — mở bằng Word rồi lưu lại thành .docx")
    r = subprocess.run(["textutil", "-convert", "txt", "-stdout", str(f)], capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "textutil lỗi")
    return r.stdout, {}


def read_pptx(f: Path, out: Out) -> tuple[str, dict]:
    from pptx import Presentation

    prs = Presentation(str(f))
    parts = []
    for i, slide in enumerate(prs.slides, 1):
        lines = []
        for sh in slide.shapes:
            if sh.has_text_frame:
                t = "\n".join(p.text for p in sh.text_frame.paragraphs if p.text.strip())
                if t.strip():
                    lines.append(t.strip())
            if getattr(sh, "has_table", False) and sh.has_table:
                lines.append(md_table([[c.text for c in row.cells] for row in sh.table.rows]))
            if sh.shape_type == 13:  # ảnh
                try:
                    out.add_image(sh.image.blob, label=f"trang chiếu {i}")
                except Exception:
                    pass
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame is not None:
            n = slide.notes_slide.notes_text_frame.text.strip()
            if n:
                lines.append(f"_Ghi chú người trình bày:_ {n}")
        if lines:
            parts.append(f"## Trang chiếu {i}\n\n" + "\n\n".join(lines))
    return "\n\n".join(parts), {"slides": len(prs.slides)}


def read_xlsx(f: Path, out: Out) -> tuple[str, dict]:
    from openpyxl import load_workbook

    wb = load_workbook(str(f), read_only=True, data_only=True)
    parts = []
    for ws in wb.worksheets:
        rows = []
        for k, row in enumerate(ws.iter_rows(values_only=True)):
            if k >= 200:
                rows.append(["… (còn nữa, chỉ lấy 200 dòng đầu)"])
                break
            rows.append(list(row[:30]))
        t = md_table(rows)
        if t:
            parts.append(f"## Trang tính: {ws.title}\n\n{t}")
    return "\n\n".join(parts), {"sheets": len(wb.worksheets)}


def read_text(f: Path, out: Out) -> tuple[str, dict]:
    b = f.read_bytes()
    for enc in ("utf-8-sig", "utf-16", "cp1258", "latin-1"):
        try:
            return b.decode(enc), {}
        except UnicodeDecodeError:
            continue
    return "", {}


def read_image(f: Path, out: Out) -> tuple[str, dict]:
    out.add_image(path=f)
    return "", {}


READERS = {".pdf": read_pdf, ".docx": read_docx, ".doc": read_doc, ".pptx": read_pptx, ".xlsx": read_xlsx}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("inputs", nargs="*")
    a = ap.parse_args()
    root = Path(a.out)
    (root / "text").mkdir(parents=True, exist_ok=True)
    (root / "images").mkdir(parents=True, exist_ok=True)
    old = {}
    try:
        old = {s["path"]: s for s in json.loads((root / "index.json").read_text())["sources"]}
    except Exception:
        pass

    files, notes = collect(a.inputs)
    sources, keep = [], set()
    for n, f in enumerate(files, 1):
        st = f.stat()
        key = hashlib.sha1(f"{f}|{st.st_size}|{st.st_mtime_ns}".encode()).hexdigest()[:12]
        prefix = f"{n:02d}-{slug(f.stem)}"
        prev = old.get(str(f))
        if prev and prev.get("key") == key and prev.get("prefix") == prefix and all((root / x).exists() for x in [prev.get("text") or "index.json"] + [i["file"] for i in prev.get("images", [])]):
            sources.append(prev)
            keep.update([prev.get("text")] + [i["file"] for i in prev.get("images", [])])
            print(f"  = {f.name}", flush=True)
            continue
        for old_file in (root / "images").glob(f"{prefix}-*.jpg"):
            old_file.unlink()
        out = Out(root, prefix)
        ext = f.suffix.lower()
        rec = {"path": str(f), "name": f.name, "key": key, "prefix": prefix, "type": ext[1:], "bytes": st.st_size, "text": None, "chars": 0, "images": []}
        try:
            text, info = (READERS.get(ext) or (read_image if ext in IMG_EXT else read_text))(f, out)
            rec.update(info)
            text = (text or "").strip()
            if len(text) > MAX_CHARS:
                text = text[:MAX_CHARS] + "\n\n… (cắt bớt — tư liệu quá dài)"
            if text:
                rel = f"text/{prefix}.md"
                (root / rel).write_text(f"# {f.name}\n\nNguồn: {f}\n\n{text}\n", encoding="utf-8")
                rec.update(text=rel, chars=len(text))
                keep.add(rel)
        except Exception as e:  # một file lỗi không làm hỏng cả bộ tư liệu
            rec["error"] = str(e)[:300]
        rec["images"] = out.images
        keep.update(i["file"] for i in out.images)
        sources.append(rec)
        print(f"  + {f.name}: {rec['chars']} ký tự, {len(out.images)} ảnh" + (f" — lỗi: {rec['error']}" if rec.get("error") else ""), flush=True)

    # dọn file của nguồn đã bỏ
    for sub in ("text", "images"):
        for x in (root / sub).iterdir():
            if f"{sub}/{x.name}" not in keep:
                x.unlink()

    total_img = sum(len(s["images"]) for s in sources)
    (root / "index.json").write_text(json.dumps({"sources": sources, "notes": notes, "images": total_img, "chars": sum(s["chars"] for s in sources)}, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [
        "# Tư liệu người dùng đưa vào",
        "",
        f"{len(sources)} nguồn · {sum(s['chars'] for s in sources):,} ký tự văn bản · {total_img} ảnh. Đường dẫn dưới đây tính từ thư mục chứa file này.",
        "Ảnh dùng trong phim: chép file ảnh vào `episodes/epNN/assets/` rồi dùng cảnh `photo` (xem docs/reference.md).",
        "",
    ]
    for s in sources:
        meta = ", ".join(f"{k} {s[k]}" for k in ("pages", "slides", "sheets") if s.get(k))
        lines.append(f"## {s['prefix']} · {s['name']}" + (f" ({meta})" if meta else ""))
        lines.append(f"- File gốc: `{s['path']}`")
        if s.get("text"):
            lines.append(f"- Văn bản: `{s['text']}` ({s['chars']:,} ký tự)")
        if s["type"] == "pdf" and not s.get("chars") and not s.get("error"):
            lines.append("- PDF không có lớp chữ (bản scan/ảnh) — xem thẳng file gốc bằng công cụ Read (đọc được PDF và ảnh)")
        if s.get("error"):
            lines.append(f"- Không đọc được: {s['error']}")
        for i in s["images"]:
            lines.append(f"- Ảnh: `{i['file']}` {i['w']}×{i['h']}" + (f" — {i['where']}" if i.get("where") else ""))
        lines.append("")
    if notes:
        lines += ["## Ghi chú khi đọc", *[f"- {x}" for x in notes], ""]
    (root / "index.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"tư liệu: {len(sources)} nguồn, {total_img} ảnh → {root / 'index.md'}", flush=True)
    for x in notes:
        print(f"  ! {x}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
