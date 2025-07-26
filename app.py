# server.py
import os
import shutil
import platform
from urllib.parse import unquote, quote
from pathlib import Path
from flask import Flask, request, send_file, jsonify, abort
from flask import send_from_directory

app = Flask(__name__, static_folder='static', static_url_path='')
ROOT_ALLOWED = platform.system() == "Windows"   # 仅 Windows 开启盘符模式

def safe_join(base: str, *paths: str) -> Path:
    """防止目录穿越"""
    base = Path(base).resolve()
    final = Path(base, *paths).resolve()
    if ROOT_ALLOWED:
        # Windows 盘符根路径以外
        if not str(final).startswith(tuple(f"{d}:\\" for d in "ABCDEFGHIJKLMNOPQRSTUVWXYZ")):
            abort(403, description="非法路径")
    else:
        # Linux 限制在 base 以下
        try:
            final.relative_to(base)
        except ValueError:
            abort(403, description="非法路径")
    return final


# 1. 让根路径 / 自动返回 static/index.html
@app.route('/')
def root():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/app.js')
def serve_js():
    return send_from_directory(app.static_folder, 'app.js')

@app.route("/api/drives")
def api_drives():
    """Windows 返回盘符列表；Linux 返回 ['/']"""
    if ROOT_ALLOWED:
        import string
        from ctypes import windll
        bitmask = windll.kernel32.GetLogicalDrives()
        drives = [f"{d}:\\" for d in string.ascii_uppercase if bitmask & (1 << (ord(d) - 65))]
        return jsonify(drives)
    return jsonify(["/"])

@app.route("/api/browse")
def api_browse():
    raw = unquote(request.args.get("path", ""))
    # 将 %5C 替换回反斜杠
    raw = raw.replace('%5C', '\\')
    target = Path(raw).resolve()
    if not target.exists():
        abort(404, description=f"路径不存在: {target}")

    items = []
    if target.is_dir():
        for p in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name.lower())):
            stat = p.stat()
            items.append({
                "name": p.name,
                "path": str(p),
                "isDir": p.is_dir(),
                "size": stat.st_size if p.is_file() else None,
                "mtime": stat.st_mtime
            })
    else:
        abort(400, description="不是目录")
    return jsonify(items)


@app.route("/api/upload", methods=["POST"])
def api_upload():
    """在当前目录上传"""
    target_dir = unquote(request.args.get("path", ""))
    if not target_dir:
        abort(400, description="缺少 path 参数")
    target_dir = Path(target_dir).resolve()
    if not target_dir.is_dir():
        abort(400, description="目录不存在")

    files = request.files.getlist("files")
    for f in files:
        if f.filename == "":
            continue
        dest = safe_join(target_dir, f.filename)
        f.save(dest)
    return jsonify({"msg": "上传成功"})


@app.route("/api/download")
def api_download():
    """下载文件"""
    file_path = unquote(request.args.get("path", ""))
    if not file_path:
        abort(400, description="缺少 path 参数")
    file_path = Path(file_path).resolve()
    if not file_path.is_file():
        abort(404, description="文件不存在")
    return send_file(file_path, as_attachment=True)


@app.route("/api/delete", methods=["DELETE"])
def api_delete():
    """删除文件/目录"""
    data = request.get_json(silent=True) or {}
    target_path = unquote(data.get("path", ""))
    if not target_path:
        abort(400, description="缺少 path 参数")
    target_path = Path(target_path).resolve()
    if not target_path.exists():
        abort(404, description="目标不存在")
    if target_path.is_file():
        target_path.unlink()
    else:
        shutil.rmtree(target_path)
    return jsonify({"msg": "删除成功"})


if __name__ == "__main__":
    app.run(debug=True, port=80)