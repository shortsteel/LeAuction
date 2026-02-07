import os

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
jwt = JWTManager()

# Docker 构建时前端产物会被复制到此目录
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")


def create_app():
    app = Flask(__name__, static_folder=None)
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

    # Serve uploaded files
    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # SPA fallback: non-API routes all return index.html
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        # If the requested file exists in static dir, serve it directly
        if path and os.path.exists(os.path.join(STATIC_DIR, path)):
            return send_from_directory(STATIC_DIR, path)
        # Otherwise serve index.html for SPA client-side routing
        return send_from_directory(STATIC_DIR, "index.html")

    # Create tables
    with app.app_context():
        from app import models  # noqa: F401

        db.create_all()

    # Start scheduler for auction expiry checks
    from app.scheduler import start_scheduler

    start_scheduler(app)

    return app
