import pytest
from app import app
from config import API_KEY


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_get_books(client):
    response = client.get("/api/v1/query/books?limit=5")
    assert response.status_code == 200
    data = response.get_json()
    assert "books" in data
    assert len(data["books"]) <= 5


def test_search_books(client):
    response = client.get("/api/v1/query/books/search?search=python&limit=3")
    assert response.status_code == 200
    data = response.get_json()
    assert "books" in data
    assert len(data["books"]) <= 3


def test_get_reader(client):
    response = client.get("/api/v1/query/readers/PCSCS19139")
    assert response.status_code == 200
    data = response.get_json()
    assert data["reader_id"] == "PCSCS19139"


def test_get_reader_history(client):
    response = client.get("/api/v1/query/readers/PCSCS19139/history?limit=3")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) <= 3


def test_get_recommendations(client):
    # ollama 测试
    response = client.get(
        "/api/v1/query/readers/PCSCS19139/recommendations?model=ollama&limit=5"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["model_used"] == "ollama"

    # gemini 测试
    response = client.get(
        "/api/v1/query/readers/PCSCS19139/recommendations?model=gemini&limit=5"
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True
    assert data["model_used"] == "gemini"


def test_clean_books_unauthorized(client):

    response = client.post("/api/v1/operations/cleaning/books")

    assert response.status_code == 401


def test_clean_books_authorized(client):

    response = client.post(
        "/api/v1/operations/cleaning/books", headers={"X-API-KEY": API_KEY}
    )

    assert response.status_code == 200


def test_clean_readers_unauthorized(client):

    response = client.post("/api/v1/operations/cleaning/readers")

    assert response.status_code == 401


def test_clean_readers_authorized(client):

    response = client.post(
        "/api/v1/operations/cleaning/readers", headers={"X-API-KEY": API_KEY}
    )

    assert response.status_code == 200


def test_generate_borrow_records_unauthorized(client):

    response = client.post("/api/v1/operations/virtual/borrow-records")

    assert response.status_code == 401


def test_generate_borrow_records_authorized(client):

    response = client.post(
        "/api/v1/operations/virtual/borrow-records", headers={"X-API-KEY": API_KEY}
    )

    assert response.status_code == 200
