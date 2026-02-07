from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models import AuctionItem, ItemImage

items_bp = Blueprint("items", __name__)

VALID_CATEGORIES = ["electronics", "food", "daily", "other"]
VALID_CONDITIONS = ["new", "like_new", "good", "fair"]
VALID_SORT = ["newest", "ending_soon", "price_low", "most_bids"]


@items_bp.route("", methods=["POST"])
@jwt_required()
def create_item():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    errors = _validate_item_data(data)
    if errors:
        return jsonify({"errors": errors}), 400

    item = AuctionItem(
        seller_id=user_id,
        title=data["title"].strip(),
        description=data.get("description", "").strip(),
        category=data.get("category", "other"),
        condition=data.get("condition", "new"),
        starting_price=float(data["starting_price"]),
        reserve_price=float(data["reserve_price"]) if data.get("reserve_price") else None,
        increment=float(data.get("increment", 1.0)),
        buyout_price=float(data["buyout_price"]) if data.get("buyout_price") else None,
        current_price=float(data["starting_price"]),
        status=AuctionItem.STATUS_DRAFT,
    )
    db.session.add(item)
    db.session.flush()  # Get the item ID

    # Add images
    image_urls = data.get("image_urls", [])
    for idx, url in enumerate(image_urls[:5]):
        img = ItemImage(item_id=item.id, image_url=url, sort_order=idx)
        db.session.add(img)

    db.session.commit()
    return jsonify({"item": item.to_dict(include_reserve=True)}), 201


@items_bp.route("", methods=["GET"])
def list_items():
    """List active auction items with filtering and sorting."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 50)  # Cap at 50

    category = request.args.get("category")
    sort = request.args.get("sort", "newest")
    search = request.args.get("search", "").strip()
    status = request.args.get("status", "active")

    query = AuctionItem.query

    # Filter by status
    if status == "active":
        query = query.filter(AuctionItem.status == AuctionItem.STATUS_ACTIVE)
    elif status == "ended":
        query = query.filter(
            AuctionItem.status.in_(
                [AuctionItem.STATUS_ENDED_WON, AuctionItem.STATUS_ENDED_UNSOLD, AuctionItem.STATUS_COMPLETED]
            )
        )

    # Filter by category
    if category and category in VALID_CATEGORIES:
        query = query.filter(AuctionItem.category == category)

    # Search
    if search:
        query = query.filter(
            db.or_(
                AuctionItem.title.ilike(f"%{search}%"),
                AuctionItem.description.ilike(f"%{search}%"),
            )
        )

    # Sort
    if sort == "ending_soon":
        query = query.order_by(AuctionItem.end_time.asc())
    elif sort == "price_low":
        query = query.order_by(AuctionItem.current_price.asc())
    elif sort == "most_bids":
        query = query.order_by(AuctionItem.bid_count.desc())
    else:  # newest
        query = query.order_by(AuctionItem.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    items = [item.to_card_dict() for item in pagination.items]

    return jsonify(
        {
            "items": items,
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }
    )


@items_bp.route("/<int:item_id>", methods=["GET"])
def get_item(item_id):
    item = db.session.get(AuctionItem, item_id)
    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404

    # Check if the requester is the seller (to show reserve price)
    include_reserve = False
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity as get_id
    try:
        verify_jwt_in_request(optional=True)
        current_user_id = get_id()
        if current_user_id and int(current_user_id) == item.seller_id:
            include_reserve = True
    except Exception:
        pass

    return jsonify({"item": item.to_dict(include_reserve=include_reserve)})


@items_bp.route("/<int:item_id>", methods=["PUT"])
@jwt_required()
def update_item(item_id):
    user_id = int(get_jwt_identity())
    item = db.session.get(AuctionItem, item_id)

    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404
    if item.seller_id != user_id:
        return jsonify({"errors": ["无权编辑此拍品"]}), 403

    data = request.get_json() or {}

    if item.status == AuctionItem.STATUS_DRAFT:
        # Can edit everything in draft
        errors = _validate_item_data(data, is_update=True)
        if errors:
            return jsonify({"errors": errors}), 400

        if "title" in data:
            item.title = data["title"].strip()
        if "description" in data:
            item.description = data["description"].strip()
        if "category" in data:
            item.category = data["category"]
        if "condition" in data:
            item.condition = data["condition"]
        if "starting_price" in data:
            item.starting_price = float(data["starting_price"])
            item.current_price = float(data["starting_price"])
        if "reserve_price" in data:
            item.reserve_price = float(data["reserve_price"]) if data["reserve_price"] else None
        if "increment" in data:
            item.increment = float(data["increment"])
        if "buyout_price" in data:
            item.buyout_price = float(data["buyout_price"]) if data["buyout_price"] else None

        # Update images
        if "image_urls" in data:
            # Remove old images
            ItemImage.query.filter_by(item_id=item.id).delete()
            for idx, url in enumerate(data["image_urls"][:5]):
                img = ItemImage(item_id=item.id, image_url=url, sort_order=idx)
                db.session.add(img)

    elif item.status == AuctionItem.STATUS_ACTIVE:
        # Can only edit description when active
        if "description" in data:
            item.description = data["description"].strip()
        else:
            return jsonify({"errors": ["进行中的拍品只能修改描述"]}), 400
    else:
        return jsonify({"errors": ["当前状态不允许编辑"]}), 400

    db.session.commit()
    return jsonify({"item": item.to_dict(include_reserve=True)})


@items_bp.route("/<int:item_id>/publish", methods=["POST"])
@jwt_required()
def publish_item(item_id):
    user_id = int(get_jwt_identity())
    item = db.session.get(AuctionItem, item_id)

    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404
    if item.seller_id != user_id:
        return jsonify({"errors": ["无权操作此拍品"]}), 403
    if item.status != AuctionItem.STATUS_DRAFT and item.status != AuctionItem.STATUS_ENDED_UNSOLD:
        return jsonify({"errors": ["只有草稿或流拍的拍品可以上架"]}), 400

    # Validate has images
    if item.images.count() == 0:
        return jsonify({"errors": ["请至少上传一张图片"]}), 400

    data = request.get_json() or {}
    duration_days = data.get("duration_days", 3)
    if duration_days not in [1, 3, 5, 7]:
        return jsonify({"errors": ["拍卖时长只能选择 1/3/5/7 天"]}), 400

    now = datetime.now(timezone.utc)
    item.start_time = now
    item.end_time = now + timedelta(days=duration_days)
    item.status = AuctionItem.STATUS_ACTIVE
    # Reset for re-listing
    if item.bid_count > 0 and item.status == AuctionItem.STATUS_ENDED_UNSOLD:
        item.current_price = item.starting_price
        item.bid_count = 0
        item.winner_id = None

    db.session.commit()
    return jsonify({"item": item.to_dict(include_reserve=True)})


@items_bp.route("/<int:item_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_item(item_id):
    user_id = int(get_jwt_identity())
    item = db.session.get(AuctionItem, item_id)

    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404
    if item.seller_id != user_id:
        return jsonify({"errors": ["无权操作此拍品"]}), 403
    if item.status != AuctionItem.STATUS_ACTIVE:
        return jsonify({"errors": ["只有进行中的拍品可以取消"]}), 400
    if item.bid_count > 0:
        return jsonify({"errors": ["已有人出价，不能取消"]}), 400

    item.status = AuctionItem.STATUS_CANCELLED
    db.session.commit()
    return jsonify({"item": item.to_dict(include_reserve=True)})


@items_bp.route("/<int:item_id>/delete", methods=["DELETE"])
@jwt_required()
def delete_item(item_id):
    user_id = int(get_jwt_identity())
    item = db.session.get(AuctionItem, item_id)

    if not item:
        return jsonify({"errors": ["拍品不存在"]}), 404
    if item.seller_id != user_id:
        return jsonify({"errors": ["无权操作此拍品"]}), 403
    if item.status != AuctionItem.STATUS_DRAFT:
        return jsonify({"errors": ["只有草稿状态的拍品可以删除"]}), 400

    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "删除成功"})


@items_bp.route("/my", methods=["GET"])
@jwt_required()
def my_items():
    user_id = int(get_jwt_identity())
    status = request.args.get("status")

    query = AuctionItem.query.filter_by(seller_id=user_id)
    if status:
        query = query.filter(AuctionItem.status == status)

    query = query.order_by(AuctionItem.created_at.desc())
    items = [item.to_card_dict() for item in query.all()]
    return jsonify({"items": items})


@items_bp.route("/my-bids", methods=["GET"])
@jwt_required()
def my_bids():
    """Items the user has bid on."""
    user_id = int(get_jwt_identity())

    from app.models import Bid

    # Get distinct item IDs the user has bid on
    bid_item_ids = (
        db.session.query(Bid.item_id)
        .filter(Bid.bidder_id == user_id)
        .distinct()
        .all()
    )
    item_ids = [row[0] for row in bid_item_ids]

    if not item_ids:
        return jsonify({"items": []})

    items = AuctionItem.query.filter(AuctionItem.id.in_(item_ids)).order_by(
        AuctionItem.end_time.desc()
    ).all()

    result = []
    for item in items:
        card = item.to_card_dict()
        # Get user's highest bid on this item
        user_max_bid = (
            db.session.query(db.func.max(Bid.amount))
            .filter(Bid.item_id == item.id, Bid.bidder_id == user_id)
            .scalar()
        )
        card["my_max_bid"] = user_max_bid
        card["is_leading"] = (
            item.status == AuctionItem.STATUS_ACTIVE
            and user_max_bid == item.current_price
        )
        card["is_winner"] = item.winner_id == user_id
        result.append(card)

    return jsonify({"items": result})


def _validate_item_data(data, is_update=False):
    errors = []
    if not is_update or "title" in data:
        title = data.get("title", "").strip()
        if len(title) < 2 or len(title) > 50:
            errors.append("标题需要2-50个字符")

    if not is_update or "starting_price" in data:
        try:
            price = float(data.get("starting_price", 0))
            if price < 0.01:
                errors.append("起拍价至少为0.01元")
        except (ValueError, TypeError):
            errors.append("起拍价格式错误")

    if data.get("reserve_price"):
        try:
            rp = float(data["reserve_price"])
            sp = float(data.get("starting_price", 0))
            if rp < sp:
                errors.append("保留价不能低于起拍价")
        except (ValueError, TypeError):
            errors.append("保留价格式错误")

    if data.get("increment"):
        try:
            inc = float(data["increment"])
            if inc < 0.01:
                errors.append("加价幅度至少为0.01元")
        except (ValueError, TypeError):
            errors.append("加价幅度格式错误")

    if data.get("buyout_price"):
        try:
            bp = float(data["buyout_price"])
            sp = float(data.get("starting_price", 0))
            if bp <= sp:
                errors.append("一口价必须高于起拍价")
        except (ValueError, TypeError):
            errors.append("一口价格式错误")

    if data.get("category") and data["category"] not in VALID_CATEGORIES:
        errors.append("无效的分类")
    if data.get("condition") and data["condition"] not in VALID_CONDITIONS:
        errors.append("无效的成色")

    return errors
