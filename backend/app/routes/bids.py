from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import AuctionItem, Bid, Notification, Transaction, ensure_utc

bids_bp = Blueprint("bids", __name__)

ANTI_SNIPE_MINUTES = 5


@bids_bp.route("/item/<int:item_id>", methods=["POST"])
@jwt_required()
def place_bid(item_id):
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    item = db.session.get(AuctionItem, item_id)
    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404

    if item.status != AuctionItem.STATUS_ACTIVE:
        return jsonify({"errors": ["该拍品未在拍卖中"]}), 400

    if item.seller_id == user_id:
        return jsonify({"errors": ["不能对自己的拍品出价"]}), 400

    # Check if auction has ended
    now = datetime.now(timezone.utc)
    if item.end_time and now >= ensure_utc(item.end_time):
        return jsonify({"errors": ["拍卖已结束"]}), 400

    try:
        amount = float(data.get("amount", 0))
    except (ValueError, TypeError):
        return jsonify({"errors": ["出价格式错误"]}), 400

    min_bid = item.current_price + item.increment
    if item.bid_count == 0:
        min_bid = item.starting_price  # First bid only needs to match starting price

    if amount < min_bid:
        return jsonify({"errors": [f"出价至少为 {min_bid:.2f} 元"]}), 400

    # Check buyout
    is_buyout = item.buyout_price and amount >= item.buyout_price

    # Record the previous highest bidder for notification
    previous_highest_bidder_id = None
    if item.bid_count > 0:
        previous_bid = (
            Bid.query.filter_by(item_id=item.id)
            .order_by(Bid.amount.desc())
            .first()
        )
        if previous_bid and previous_bid.bidder_id != user_id:
            previous_highest_bidder_id = previous_bid.bidder_id

    # Create bid
    bid = Bid(item_id=item.id, bidder_id=user_id, amount=amount, created_at=now)
    db.session.add(bid)

    # Update item
    item.current_price = amount
    item.bid_count += 1

    # Anti-sniping: extend auction if bid placed within last 5 minutes
    if item.end_time and (ensure_utc(item.end_time) - now) <= timedelta(minutes=ANTI_SNIPE_MINUTES):
        item.end_time = now + timedelta(minutes=ANTI_SNIPE_MINUTES)

    # Handle buyout
    if is_buyout:
        item.current_price = item.buyout_price
        item.status = AuctionItem.STATUS_ENDED_WON
        item.winner_id = user_id

        # Create transaction
        transaction = Transaction(
            item_id=item.id,
            seller_id=item.seller_id,
            buyer_id=user_id,
            final_price=item.buyout_price,
        )
        db.session.add(transaction)

        # Notify seller
        _notify(
            item.seller_id,
            Notification.TYPE_AUCTION_SOLD,
            "拍品已成交",
            f"恭喜！「{item.title}」已被一口价买下，成交价 {item.buyout_price:.2f} 元",
            item.id,
        )
        # Notify buyer
        _notify(
            user_id,
            Notification.TYPE_AUCTION_WON,
            "竞拍成功",
            f"恭喜！您以一口价 {item.buyout_price:.2f} 元拍下「{item.title}」",
            item.id,
        )

    # Notify previous highest bidder they've been outbid
    if previous_highest_bidder_id:
        _notify(
            previous_highest_bidder_id,
            Notification.TYPE_OUTBID,
            "出价已被超越",
            f"您在「{item.title}」的出价已被超越，当前最高价 {amount:.2f} 元",
            item.id,
        )

    db.session.commit()

    return jsonify(
        {
            "bid": bid.to_dict(),
            "item": item.to_dict(),
        }
    )


@bids_bp.route("/item/<int:item_id>", methods=["GET"])
def get_bids(item_id):
    item = db.session.get(AuctionItem, item_id)
    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404

    bids = (
        Bid.query.filter_by(item_id=item_id)
        .order_by(Bid.amount.desc())
        .all()
    )
    return jsonify({"bids": [b.to_dict() for b in bids]})


def _notify(user_id, ntype, title, content, item_id=None):
    n = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        content=content,
        related_item_id=item_id,
    )
    db.session.add(n)
