class Config:
    DB_TYPE = "postgresql"
    DB_HOST = "isiou.top"
    DB_PORT = 5432
    DB_NAME = "************************"
    DB_USER = "************************"
    DB_PASSWORD = "************************"

    # SQLAlchemy 配置
    SQLALCHEMY_DATABASE_URI = (
        f"{DB_TYPE}+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Flask-RESTx 配置
    RESTX_VALIDATE = True
    RESTX_MASK_SWAGGER = False
