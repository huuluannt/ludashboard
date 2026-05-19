export function normalizeForSearch(value: string) {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchTerms(value: string) {
  return value.split(' ').map((term) => term.trim()).filter(Boolean);
}

export function getSearchScore(text: string, query: string) {
  const originalText = text.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const originalQuery = query.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedQuery) return 1;

  let score = 0;
  const exactPhraseIndex = originalText.indexOf(originalQuery);
  const foldedPhraseIndex = normalizedText.indexOf(normalizedQuery);

  if (exactPhraseIndex >= 0) {
    score = Math.max(score, 1000 - exactPhraseIndex);
  }

  if (foldedPhraseIndex >= 0) {
    score = Math.max(score, 800 - foldedPhraseIndex);
  }

  const originalTerms = getSearchTerms(originalQuery);
  const normalizedTerms = getSearchTerms(normalizedQuery);
  const exactTermMatches = originalTerms.filter((term) => originalText.includes(term)).length;
  const foldedTermMatches = normalizedTerms.filter((term) => normalizedText.includes(term)).length;

  if (originalTerms.length > 0 && exactTermMatches === originalTerms.length) {
    score = Math.max(score, 650 + exactTermMatches * 10);
  }

  if (normalizedTerms.length > 0 && foldedTermMatches === normalizedTerms.length) {
    score = Math.max(score, 500 + foldedTermMatches * 10);
  }

  if (foldedTermMatches > 0) {
    score = Math.max(score, foldedTermMatches * 100);
  }

  return score;
}
