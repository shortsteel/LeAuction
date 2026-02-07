import os
import uuid

from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

upload_bp = Blueprint("upload", __name__)


def allowed_file(filename):
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower()
        in current_app.config["ALLOWED_EXTENSIONS"]
    )


@upload_bp.route("", methods=["POST"])
@jwt_required()
def upload_file():
    if "file" not in request.files:
        return jsonify({"errors": ["没有选择文件"]}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"errors": ["没有选择文件"]}), 400

    if not allowed_file(file.filename):
        return jsonify({"errors": ["不支持的文件格式，请上传 png/jpg/jpeg/gif/webp"]}), 400

    # Generate unique filename
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    # Return the URL path
    url = f"/api/upload/files/{filename}"
    return jsonify({"url": url}), 201


@upload_bp.route("/files/<filename>", methods=["GET"])
def get_file(filename):
    filename = secure_filename(filename)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], filename)
