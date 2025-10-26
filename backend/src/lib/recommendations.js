function normalizeRecommendation(rec) {
  return {
    title: rec.title || rec.book_title || rec.name || rec.Title || "",
    author: rec.author || rec.book_author || rec.writer || rec.Author || "",
    call_number:
      rec.call_number ||
      rec.call_no ||
      rec.callNumber ||
      rec.callNum ||
      rec.call_num ||
      "",
    reason: rec.reason || rec.explanation || rec.rationale || "",
  };
}

function buildFallbackQuery(userBorrowsRows, query, limitNum) {
  let fallbackQuery = `
    SELECT b.title, b.author, b.call_no, b.doc_type,
           'Based on your reading history' as reason
    FROM books b
  `;

  const queryParams = [];
  let hasWhere = false;

  if (userBorrowsRows && userBorrowsRows.length > 0) {
    const docTypes = userBorrowsRows.map((r) => r.doc_type).filter(Boolean);
    const authors = userBorrowsRows.map((r) => r.author).filter(Boolean);

    if ((docTypes && docTypes.length > 0) || (authors && authors.length > 0)) {
      fallbackQuery += ` WHERE (`;
      if (docTypes.length > 0) {
        fallbackQuery += `b.doc_type = ANY($${queryParams.length + 1})`;
        queryParams.push(docTypes);
        hasWhere = true;
      }
      if (authors.length > 0) {
        if (hasWhere) {
          fallbackQuery += ` OR b.author = ANY($${queryParams.length + 1})`;
        } else {
          fallbackQuery += `b.author = ANY($${queryParams.length + 1})`;
          hasWhere = true;
        }
        queryParams.push(authors);
      }
      fallbackQuery += `)`;
    }
  }

  if (query) {
    if (!hasWhere) {
      fallbackQuery += ` WHERE (b.title ILIKE $${queryParams.length + 1} OR b.author ILIKE $${queryParams.length + 1} OR b.doc_type ILIKE $${queryParams.length + 1})`;
    } else {
      fallbackQuery += ` AND (b.title ILIKE $${queryParams.length + 1} OR b.author ILIKE $${queryParams.length + 1} OR b.doc_type ILIKE $${queryParams.length + 1})`;
    }
    queryParams.push(`%${query}%`);
    hasWhere = true;
  }

  fallbackQuery += ` ORDER BY b.publication_year DESC LIMIT $${queryParams.length + 1}`;
  queryParams.push(limitNum);

  return { sql: fallbackQuery, params: queryParams };
}

module.exports = { normalizeRecommendation, buildFallbackQuery };
