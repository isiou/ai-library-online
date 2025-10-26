from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_restx import Api
from .config import Config

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)

    authorizations = {"apikey": {"type": "apiKey", "in": "header", "name": "X-API-KEY"}}

    api = Api(
        app,
        prefix="/api/v1",
        title="API Document",
        doc="/docs",
        authorizations=authorizations,
        security="apikey",
    )

    # 导入并添加命名空间
    from .routes import query_ns, ops_ns

    api.add_namespace(query_ns, path="/query")
    api.add_namespace(ops_ns, path="/operations")

    return app
