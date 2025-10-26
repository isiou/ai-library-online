from src.api import create_app
import config

SERVER_PORT = config.SERVER_PORT

app = create_app()

app.json.ensure_ascii = True

if __name__ == "__main__":
    app.run(port=SERVER_PORT, debug=True)
