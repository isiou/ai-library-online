from functools import wraps
from flask import request, abort
from config import API_KEY


def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if (
            request.headers.get("X-API-KEY")
            and request.headers.get("X-API-KEY") == API_KEY
        ):
            return f(*args, **kwargs)
        else:
            abort(401)

    return decorated_function
