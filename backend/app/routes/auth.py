import re

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

from app import db
from app.models import User

auth_bp = Blueprint("auth", __name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    nickname = data.get("nickname", "").strip()

    # Validation
    errors = []
    if not email or not EMAIL_REGEX.match(email):
        errors.append("请输入有效的邮箱地址")
    if not password or len(password) < 6:
        errors.append("密码至少需要6位")
    if not nickname or len(nickname) < 2 or len(nickname) > 20:
        errors.append("昵称需要2-20个字符")
    if errors:
        return jsonify({"errors": errors}), 400

    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"errors": ["该邮箱已被注册"]}), 409

    # Create user
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )
    user = User(email=email, password_hash=password_hash, nickname=nickname)
    db.session.add(user)
    db.session.commit()

    # Auto login after registration
    access_token = create_access_token(identity=str(user.id))
    return jsonify({"token": access_token, "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"errors": ["请输入邮箱和密码"]}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(
        password.encode("utf-8"), user.password_hash.encode("utf-8")
    ):
        return jsonify({"errors": ["邮箱或密码错误"]}), 401

    access_token = create_access_token(identity=str(user.id))
    return jsonify({"token": access_token, "user": user.to_dict()})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"errors": ["用户不存在"]}), 404
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/me", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"errors": ["用户不存在"]}), 404

    data = request.get_json() or {}

    if "nickname" in data:
        nickname = data["nickname"].strip()
        if len(nickname) < 2 or len(nickname) > 20:
            return jsonify({"errors": ["昵称需要2-20个字符"]}), 400
        user.nickname = nickname

    if "avatar_url" in data:
        user.avatar_url = data["avatar_url"]

    db.session.commit()
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"errors": ["用户不存在"]}), 404

    data = request.get_json() or {}
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")

    if not bcrypt.checkpw(
        old_password.encode("utf-8"), user.password_hash.encode("utf-8")
    ):
        return jsonify({"errors": ["原密码错误"]}), 400

    if len(new_password) < 6:
        return jsonify({"errors": ["新密码至少需要6位"]}), 400

    user.password_hash = bcrypt.hashpw(
        new_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    db.session.commit()
    return jsonify({"message": "密码修改成功"})
