from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler


def check_expired_auctions(app):
    """Check for auctions that have expired and finalize them."""
    with app.app_context():
        from app import db
        from app.models import AuctionItem, Bid, Notification, Transaction

        now = datetime.now(timezone.utc)
        expired_items = AuctionItem.query.filter(
            AuctionItem.status == AuctionItem.STATUS_ACTIVE,
            AuctionItem.end_time <= now,
        ).all()

        for item in expired_items:
            if item.bid_count == 0:
                # No bids - unsold
                item.status = AuctionItem.STATUS_ENDED_UNSOLD
                _notify(
                    db,
                    item.seller_id,
                    Notification.TYPE_AUCTION_UNSOLD,
                    "拍品流拍",
                    f"「{item.title}」已结束，无人出价",
                    item.id,
                )
            else:
                # Has bids - check reserve price
                highest_bid = (
                    Bid.query.filter_by(item_id=item.id)
                    .order_by(Bid.amount.desc())
                    .first()
                )

                reserve_met = (
                    item.reserve_price is None
                    or highest_bid.amount >= item.reserve_price
                )

                if reserve_met:
                    # Auction won
                    item.status = AuctionItem.STATUS_ENDED_WON
                    item.winner_id = highest_bid.bidder_id

                    # Create transaction
                    txn = Transaction(
                        item_id=item.id,
                        seller_id=item.seller_id,
                        buyer_id=highest_bid.bidder_id,
                        final_price=highest_bid.amount,
                    )
                    db.session.add(txn)

                    # Notify winner
                    _notify(
                        db,
                        highest_bid.bidder_id,
                        Notification.TYPE_AUCTION_WON,
                        "竞拍成功",
                        f"恭喜！您以 {highest_bid.amount:.2f} 元拍下「{item.title}」",
                        item.id,
                    )
                    # Notify seller
                    _notify(
                        db,
                        item.seller_id,
                        Notification.TYPE_AUCTION_SOLD,
                        "拍品已成交",
                        f"恭喜！「{item.title}」已成交，成交价 {highest_bid.amount:.2f} 元",
                        item.id,
                    )
                else:
                    # Reserve not met - unsold
                    item.status = AuctionItem.STATUS_ENDED_UNSOLD

                    # Notify seller
                    _notify(
                        db,
                        item.seller_id,
                        Notification.TYPE_RESERVE_NOT_MET,
                        "拍品流拍",
                        f"「{item.title}」已结束，最高出价 {highest_bid.amount:.2f} 元未达到保留价",
                        item.id,
                    )

                    # Notify all bidders
                    bidder_ids = (
                        db.session.query(Bid.bidder_id)
                        .filter(Bid.item_id == item.id)
                        .distinct()
                        .all()
                    )
                    for (bidder_id,) in bidder_ids:
                        _notify(
                            db,
                            bidder_id,
                            Notification.TYPE_RESERVE_NOT_MET,
                            "拍品流拍",
                            f"「{item.title}」已结束，最高出价未达到卖家设定的保留价",
                            item.id,
                        )

        db.session.commit()


def _notify(db, user_id, ntype, title, content, item_id=None):
    from app.models import Notification

    n = Notification(
        user_id=user_id,
        type=ntype,
        title=title,
        content=content,
        related_item_id=item_id,
    )
    db.session.add(n)


def start_scheduler(app):
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_expired_auctions,
        "interval",
        seconds=30,
        args=[app],
        id="check_expired_auctions",
    )
    scheduler.start()
