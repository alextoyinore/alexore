const sanitizeHtml = require('sanitize-html');

const BAD_WORDS = [
  'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'pussy',
  'fag', 'faggot', 'nigger', 'nigga', 'whore', 'slut', 'retard', 'twat',
  'motherfucker', 'bullshit', 'dipshit', 'jackass', 'wanker', 'prick',
  'blowjob', 'handjob', 'porn', 'porno', 'xxx', 'hentai', 'nude', 'naked',

  // Spam / scam keywords
  'viagra', 'cialis', 'casino', 'poker', 'crypto giveaway', 'free crypto',
  'wallet connect', 'seed phrase', 'private key', 'telegram @', 'whatsapp +',
  'make money fast', 'earn $', 'earn 1000', 'guaranteed profit', 'invest now',
  'forex signal', 'buy followers', 'cheap seo', 'sugar daddy', 'sugar mommy',
  'escort service', 'hookup', 'dating site'
];

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

function normalizeTextForFilter(text) {
  if (!text) return '';
  let str = text.toLowerCase();
  const subs = {
    '@': 'a',
    '4': 'a',
    '8': 'b',
    '3': 'e',
    '1': 'i',
    '!': 'i',
    '0': 'o',
    '$': 's',
    '5': 's',
    '7': 't',
    '+': 't'
  };

  for (const [char, rep] of Object.entries(subs)) {
    str = str.replaceAll(char, rep);
  }

  return str.replace(/[^a-z0-9\s]/g, ' ');
}

function checkCommentModeration(content, authorName = '', authorEmail = '') {
  const fullText = `${authorName} ${authorEmail} ${content}`.toLowerCase();
  const normalized = normalizeTextForFilter(fullText);

  const flaggedTerms = [];

  for (const word of BAD_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');

    if (regex.test(fullText) || regex.test(normalized)) {
      flaggedTerms.push(word);
    } else if (word.includes(' ') && (fullText.includes(word) || normalized.includes(word))) {
      flaggedTerms.push(word);
    }
  }

  if (flaggedTerms.length > 0) {
    const uniqueTerms = Array.from(new Set(flaggedTerms));
    return {
      isFlagged: true,
      matchedTerms: uniqueTerms,
      reason: `Contains sensitive/flagged keywords: ${uniqueTerms.slice(0, 3).join(', ')}`
    };
  }

  const urls = content.match(URL_PATTERN) || [];
  if (urls.length >= 3) {
    return {
      isFlagged: true,
      matchedTerms: urls,
      reason: 'Contains excessive links (possible link spam)'
    };
  }

  return {
    isFlagged: false,
    matchedTerms: [],
    reason: ''
  };
}

function sanitizeCommentContent(raw) {
  if (!raw) return '';
  return sanitizeHtml(raw, {
    allowedTags: ['br', 'p', 'b', 'i', 'strong', 'em', 'code', 'blockquote', 'a'],
    allowedAttributes: {
      a: ['href', 'rel', 'target']
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener noreferrer',
        target: '_blank'
      })
    }
  });
}

function sanitizePostHtml(html) {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
      'img', 'figure', 'figcaption', 'mark', 'span', 'div', 'sub', 'sup'
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
      pre: ['class'],
      span: ['class', 'style'],
      div: ['class'],
      p: ['class'],
      '*': ['class']
    }
  });
}

module.exports = {
  checkCommentModeration,
  sanitizeCommentContent,
  sanitizePostHtml
};
