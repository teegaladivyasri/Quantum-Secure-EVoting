from flask import Flask, jsonify
from backend.config import Config
from backend.extensions import db, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    frontend_origin = app.config.get("FRONTEND_ORIGIN", "http://localhost:5173")
    cors.init_app(app, resources={r"/api/v1/*": {"origins": [frontend_origin]}})

    # Register blueprints
    from backend.routes.auth_routes import auth_bp
    from backend.routes.admin_routes import admin_bp
    from backend.routes.voter_routes import voter_bp
    from backend.routes.health_routes import health_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(voter_bp)
    app.register_blueprint(health_bp)

    # Standard JSON error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "BAD_REQUEST", "message": str(getattr(error, "description", None) or "Bad request")}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({"error": "UNAUTHORIZED", "message": str(getattr(error, "description", None) or "Unauthorized")}), 401

    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({"error": "FORBIDDEN", "message": str(getattr(error, "description", None) or "Forbidden")}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "NOT_FOUND", "message": "The requested resource was not found."}), 404

    @app.errorhandler(409)
    def conflict(error):
        return jsonify({"error": "CONFLICT", "message": str(getattr(error, "description", None) or "Conflict")}), 409

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "SERVER_ERROR", "message": "An internal server error occurred."}), 500

    return app

def init_db(app):
    """
    Initializes database tables within the application context.
    Safely adds voter columns to existing PostgreSQL users table if not already present.
    """
    with app.app_context():
        try:
            db.create_all()
            if db.engine.name == "postgresql":
                with db.engine.connect() as conn:
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS voter_id VARCHAR(32) UNIQUE;"))
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);"))
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS registered_mobile VARCHAR(20);"))
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN IF NOT EXISTS synthetic_identity_reference VARCHAR(255);"))

                    # Multilingual candidate columns
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_te VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS name_hi VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_en VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_te VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS party_hi VARCHAR(255);"))

                    # Multilingual constituency columns
                    conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_en VARCHAR(100);"))
                    conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_te VARCHAR(100);"))
                    conn.execute(db.text("ALTER TABLE constituencies ADD COLUMN IF NOT EXISTS name_hi VARCHAR(100);"))

                    # Multilingual election columns
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_en VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_te VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS title_hi VARCHAR(255);"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_en TEXT;"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_te TEXT;"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS description_hi TEXT;"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_en VARCHAR(100);"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_te VARCHAR(100);"))
                    conn.execute(db.text("ALTER TABLE elections ADD COLUMN IF NOT EXISTS election_type_hi VARCHAR(100);"))
                    conn.commit()
        except Exception as e:
            app.logger.warning(f"Database initialization deferred: {e}")


if __name__ == "__main__":
    app = create_app()
    init_db(app)
    app.run(host="0.0.0.0", port=5000, debug=True)
