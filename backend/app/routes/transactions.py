from datetime import datetime, timezone

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import AuctionItem, Transaction, Notification

transactions_bp = Blueprint("transactions", __name__)


@transactions_bp.route("/<int:transaction_id>", methods=["GET"])
@jwt_required()
def get_transaction(transaction_id):
    user_id = int(get_jwt_identity())
    txn = db.session.get(Transaction, transaction_id)

    if not txn:
        return jsonify({"errors": ["交易不存在"]}), 404
    if txn.seller_id != user_id and txn.buyer_id != user_id:
        return jsonify({"errors": ["无权查看此交易"]}), 403

    return jsonify({"transaction": txn.to_dict()})


@transactions_bp.route("/item/<int:item_id>", methods=["GET"])
@jwt_required()
def get_transaction_by_item(item_id):
    user_id = int(get_jwt_identity())
    txn = Transaction.query.filter_by(item_id=item_id).first()

    if not txn:
        return jsonify({"errors": ["交易不存在"]}), 404
    if txn.seller_id != user_id and txn.buyer_id != user_id:
        return jsonify({"errors": ["无权查看此交易"]}), 403

    return jsonify({"transaction": txn.to_dict()})


@transactions_bp.route("/<int:transaction_id>/confirm", methods=["POST"])
@jwt_required()
def confirm_transaction(transaction_id):
    user_id = int(get_jwt_identity())
    txn = db.session.get(Transaction, transaction_id)

    if not txn:
        return jsonify({"errors": ["交易不存在"]}), 404

    if txn.seller_id != user_id and txn.buyer_id != user_id:
        return jsonify({"errors": ["无权操作此交易"]}), 403

    # Mark confirmed based on role
    if txn.seller_id == user_id:
        if txn.seller_confirmed:
            return jsonify({"errors": ["您已确认过了"]}), 400
        txn.seller_confirmed = True
        other_user_id = txn.buyer_id
    else:
        if txn.buyer_confirmed:
            return jsonify({"errors": ["您已确认过了"]}), 400
        txn.buyer_confirmed = True
        other_user_id = txn.seller_id

    # Notify the other party
    _notify(
        other_user_id,
        Notification.TYPE_TRANSACTION_CONFIRMED,
        "交易确认",
        f"对方已确认「{txn.item.title}」的交易完成",
        txn.item_id,
    )

    # Check if both confirmed -> complete
    if txn.seller_confirmed and txn.buyer_confirmed:
        txn.completed_at = datetime.now(timezone.utc)
        item = db.session.get(AuctionItem, txn.item_id)
        if item:
            item.status = AuctionItem.STATUS_COMPLETED

    db.session.commit()
    return jsonify({"transaction": txn.to_dict()})


@transactions_bp.route("/my", methods=["GET"])
@jwt_required()
def my_transactions():
    user_id = int(get_jwt_identity())
    txns = Transaction.query.filter(
        db.or_(Transaction.seller_id == user_id, Transaction.buyer_id == user_id)
    ).order_by(Transaction.created_at.desc()).all()

    return jsonify({"transactions": [t.to_dict() for t in txns]})


def _notify(user_id, ntype, title, content, item_id=None):
    n = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        content=content,
        related_item_id=item_id,
    )
    db.session.add(n)
