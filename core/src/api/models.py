from . import db
from sqlalchemy import Column, Integer, String, Text, Date, BigInteger, ForeignKey
from sqlalchemy.orm import relationship


class Book(db.Model):
    __tablename__ = "books"
    no = Column(BigInteger)
    book_id = Column(String(255), primary_key=True)
    title = Column(Text)
    author = Column(Text)
    publisher = Column(Text)
    publication_year = Column(Integer)
    call_no = Column(String(255))
    language = Column(String(50))
    doc_type = Column(String(50))

    borrow_records = relationship("BorrowRecord", back_populates="book")


class Reader(db.Model):
    __tablename__ = "readers"
    no = Column(BigInteger)
    reader_id = Column(String(255), primary_key=True)
    gender = Column(String(10))
    enroll_year = Column(Integer)
    reader_type = Column(String(50))
    department = Column(Text)

    borrow_records = relationship("BorrowRecord", back_populates="reader")


class BorrowRecord(db.Model):
    __tablename__ = "borrow_records"
    borrow_id = Column(String(255), primary_key=True)
    reader_id = Column(String(255), ForeignKey("readers.reader_id"))
    book_id = Column(String(255), ForeignKey("books.book_id"))
    borrow_date = Column(Date)
    due_date = Column(Date)
    return_date = Column(Date)
    status = Column(String(50))

    reader = relationship("Reader", back_populates="borrow_records")
    book = relationship("Book", back_populates="borrow_records")


class RecommendationHistory(db.Model):
    __tablename__ = "recommendation_history"
    recommendation_id = db.Column(db.Integer, primary_key=True)
    reader_id = db.Column(
        db.String(255), db.ForeignKey("readers.reader_id"), nullable=False
    )
    model_used = db.Column(db.String(50))
    recommended_book_title = db.Column(db.Text)
    recommended_book_author = db.Column(db.Text)
    recommendation_reason = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    reader = relationship("Reader")
