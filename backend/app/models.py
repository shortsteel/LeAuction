from datetime import datetime, timezone

from app import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    nickname = db.Column(db.String(20), nullable=False)
    avatar_url = db.Column(db.String(256), default="")
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    items = db.relationship("AuctionItem", backref="seller", lazy="dynamic", foreign_keys="AuctionItem.seller_id")
    bids = db.relationship("Bid", backref="bidder", lazy="dynamic", foreign_keys="Bid.bidder_id")
    notifications = db.relationship("Notification", backref="user", lazy="dynamic", foreign_keys="Notification.user_id")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "nickname": self.nickname,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at.isoformat(),
        }

    def to_public_dict(self):
        return {
            "id": self.id,
            "nickname": self.nickname,
            "avatar_url": self.avatar_url,
        }


class AuctionItem(db.Model):
    __tablename__ = "auction_items"

    # Status constants
    STATUS_DRAFT = "draft"
    STATUS_ACTIVE = "active"
    STATUS_ENDED_WON = "ended_won"
    STATUS_ENDED_UNSOLD = "ended_unsold"
    STATUS_CANCELLED = "cancelled"
    STATUS_COMPLETED = "completed"

    CATEGORY_ELECTRONICS = "electronics"
    CATEGORY_FOOD = "food"
    CATEGORY_DAILY = "daily"
    CATEGORY_OTHER = "other"

    CONDITION_NEW = "new"
    CONDITION_LIKE_NEW = "like_new"
    CONDITION_GOOD = "good"
    CONDITION_FAIR = "fair"

    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, default="")
    category = db.Column(db.String(20), default=CATEGORY_OTHER)
    condition = db.Column(db.String(20), default=CONDITION_NEW)
    starting_price = db.Column(db.Float, nullable=False)
    reserve_price = db.Column(db.Float, nullable=True)  # 最低成交价/保留价
    increment = db.Column(db.Float, nullable=False, default=1.0)
    buyout_price = db.Column(db.Float, nullable=True)  # 一口价
    current_price = db.Column(db.Float, nullable=False)  # 当前最高价
    bid_count = db.Column(db.Integer, default=0)
    start_time = db.Column(db.DateTime(timezone=True), nullable=True)
    end_time = db.Column(db.DateTime(timezone=True), nullable=True)
    status = db.Column(db.String(20), default=STATUS_DRAFT, index=True)
    winner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    images = db.relationship(
        "ItemImage", backref="item", lazy="dynamic", cascade="all, delete-orphan"
    )
    bids = db.relationship(
        "Bid", backref="item", lazy="dynamic", cascade="all, delete-orphan"
    )
    winner = db.relationship("User", foreign_keys=[winner_id])

    def to_dict(self, include_reserve=False):
        data = {
            "id": self.id,
            "seller_id": self.seller_id,
            "seller": self.seller.to_public_dict() if self.seller else None,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "condition": self.condition,
            "starting_price": self.starting_price,
            "increment": self.increment,
            "buyout_price": self.buyout_price,
            "current_price": self.current_price,
            "bid_count": self.bid_count,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "winner_id": self.winner_id,
            "images": [img.to_dict() for img in self.images.order_by(ItemImage.sort_order)],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        # Reserve price is only visible to the seller
        if include_reserve:
            data["reserve_price"] = self.reserve_price
        else:
            # Show whether reserve price has been met
            data["reserve_met"] = self._is_reserve_met()
            data["has_reserve"] = self.reserve_price is not None
        return data

    def _is_reserve_met(self):
        if self.reserve_price is None:
            return True  # No reserve means always met
        return self.current_price >= self.reserve_price

    def to_card_dict(self):
        """Minimal dict for list/card display."""
        first_image = self.images.order_by(ItemImage.sort_order).first()
        return {
            "id": self.id,
            "title": self.title,
            "category": self.category,
            "condition": self.condition,
            "current_price": self.current_price,
            "starting_price": self.starting_price,
            "buyout_price": self.buyout_price,
            "bid_count": self.bid_count,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
            "image_url": first_image.image_url if first_image else None,
            "seller": self.seller.to_public_dict() if self.seller else None,
            "reserve_met": self._is_reserve_met(),
            "has_reserve": self.reserve_price is not None,
        }


class ItemImage(db.Model):
    __tablename__ = "item_images"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(
        db.Integer, db.ForeignKey("auction_items.id"), nullable=False, index=True
    )
    image_url = db.Column(db.String(256), nullable=False)
    sort_order = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "image_url": self.image_url,
            "sort_order": self.sort_order,
        }


class Bid(db.Model):
    __tablename__ = "bids"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(
        db.Integer, db.ForeignKey("auction_items.id"), nullable=False, index=True
    )
    bidder_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "bidder_id": self.bidder_id,
            "bidder": self.bidder.to_public_dict() if self.bidder else None,
            "amount": self.amount,
            "created_at": self.created_at.isoformat(),
        }


class Notification(db.Model):
    __tablename__ = "notifications"

    TYPE_OUTBID = "outbid"
    TYPE_ENDING_SOON = "ending_soon"
    TYPE_AUCTION_WON = "auction_won"
    TYPE_AUCTION_SOLD = "auction_sold"
    TYPE_AUCTION_UNSOLD = "auction_unsold"
    TYPE_RESERVE_NOT_MET = "reserve_not_met"
    TYPE_TRANSACTION_CONFIRMED = "transaction_confirmed"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    type = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    related_item_id = db.Column(db.Integer, db.ForeignKey("auction_items.id"), nullable=True)
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "content": self.content,
            "related_item_id": self.related_item_id,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat(),
        }


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(
        db.Integer, db.ForeignKey("auction_items.id"), nullable=False, unique=True
    )
    seller_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    buyer_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    final_price = db.Column(db.Float, nullable=False)
    seller_confirmed = db.Column(db.Boolean, default=False)
    buyer_confirmed = db.Column(db.Boolean, default=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    item = db.relationship("AuctionItem", backref=db.backref("transaction", uselist=False))
    seller = db.relationship("User", foreign_keys=[seller_id])
    buyer = db.relationship("User", foreign_keys=[buyer_id])

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "seller_id": self.seller_id,
            "buyer_id": self.buyer_id,
            "final_price": self.final_price,
            "seller_confirmed": self.seller_confirmed,
            "buyer_confirmed": self.buyer_confirmed,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
