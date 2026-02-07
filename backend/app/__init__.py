import os

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.Config")

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Init extensions
    db.init_app(app)
    jwt.init_app(app)
    CORS(app)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.items import items_bp
    from app.routes.bids import bids_bp
    from app.routes.notifications import notifications_bp
    from app.routes.transactions import transactions_bp
    from app.routes.upload import upload_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(items_bp, url_prefix="/api/items")
    app.register_blueprint(bids_bp, url_prefix="/api/bids")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(upload_bp, url_prefix="/api/upload")

    # Create tables
    with app.app_context():
        from app import models  # noqa: F401

        db.create_all()

    # Start scheduler for auction expiry checks
    from app.scheduler import start_scheduler

    start_scheduler(app)

    return app
