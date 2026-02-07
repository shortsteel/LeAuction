from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import Comment, AuctionItem

comments_bp = Blueprint("comments", __name__)


@comments_bp.route("/<int:item_id>/comments", methods=["GET"])
def list_comments(item_id):
    """获取拍品的留言列表"""
    item = db.session.get(AuctionItem, item_id)
    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)

    pagination = (
        Comment.query
        .filter_by(item_id=item_id)
        .order_by(Comment.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "comments": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "pages": pagination.pages,
    })


@comments_bp.route("/<int:item_id>/comments", methods=["POST"])
@jwt_required()
def create_comment(item_id):
    """在拍品下留言"""
    user_id = int(get_jwt_identity())
    item = db.session.get(AuctionItem, item_id)

    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404

    # 只有非草稿状态的拍品可以留言
    if item.status == AuctionItem.STATUS_DRAFT:
        return jsonify({"errors": ["草稿状态的拍品不能留言"]}), 400

    data = request.get_json() or {}
    content = data.get("content", "").strip()

    if not content:
        return jsonify({"errors": ["留言内容不能为空"]}), 400
    if len(content) > 500:
        return jsonify({"errors": ["留言内容不能超过500个字符"]}), 400

    comment = Comment(
        item_id=item_id,
        user_id=user_id,
        content=content,
    )
    db.session.add(comment)
    db.session.commit()

    return jsonify({"comment": comment.to_dict()}), 201
