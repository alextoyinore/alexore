import re
import bleach

# Standard list of profane, offensive, abusive, and spam trigger keywords
BAD_WORDS = [
    # General profanities & slurs (common English offensive keywords)
    'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'pussy',
    'fag', 'faggot', 'nigger', 'nigga', 'whore', 'slut', 'retard', 'twat',
    'motherfucker', 'bullshit', 'dipshit', 'jackass', 'wanker', 'prick',
    'blowjob', 'handjob', 'porn', 'porno', 'xxx', 'hentai', 'nude', 'naked',
    
    # Spam / scam keywords
    'viagra', 'cialis', 'casino', 'poker', 'crypto giveaway', 'free crypto',
    'wallet connect', 'seed phrase', 'private key', 'telegram @', 'whatsapp +',
    'make money fast', 'earn $', 'earn 1000', 'guaranteed profit', 'invest now',
    'forex signal', 'buy followers', 'cheap seo', 'sugar daddy', 'sugar mommy',
    'escort service', 'hookup', 'dating site'
]

# Patterns for link spamming (e.g. comment full of URLs)
URL_PATTERN = re.compile(r'https?://[^\s]+|www\.[^\s]+', re.IGNORECASE)


def normalize_text_for_filter(text: str) -> str:
    """Normalize text replacing common leetspeak substitutions to catch evasions."""
    if not text:
        return ''
    text = text.lower()
    # Leetspeak map
    substitutions = {
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
        '+': 't',
    }
    for char, rep in substitutions.items():
        text = text.replace(char, rep)
    
    # Collapse multiple repeating non-alphanumeric chars
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    return text


def check_comment_moderation(content: str, author_name: str = '', author_email: str = '') -> tuple[bool, list[str], str]:
    """
    Checks if comment content, author name, or email contains bad words or spam.
    Returns:
        (is_flagged: bool, matched_terms: list, reason: str)
    """
    full_text = f"{author_name} {author_email} {content}".lower()
    normalized = normalize_text_for_filter(full_text)
    
    flagged_terms = []
    
    # 1. Check bad words with word boundary matching
    for word in BAD_WORDS:
        # Check in raw text
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, full_text, re.IGNORECASE) or re.search(pattern, normalized, re.IGNORECASE):
            flagged_terms.append(word)
        # For multi-word triggers (e.g. 'crypto giveaway')
        elif ' ' in word and (word in full_text or word in normalized):
            flagged_terms.append(word)

    if flagged_terms:
        unique_terms = list(dict.fromkeys(flagged_terms))
        return True, unique_terms, f"Contains sensitive/flagged keywords: {', '.join(unique_terms[:3])}"

    # 2. Check excessive URL count (more than 2 URLs = likely spam)
    urls = URL_PATTERN.findall(content)
    if len(urls) >= 3:
        return True, urls, "Contains excessive links (possible link spam)"

    return False, [], ""


def sanitize_comment_content(raw_html_or_text: str) -> str:
    """Sanitize user-submitted comment to plain safe text with allowed breaks."""
    # Convert linebreaks to <br> safely or strip HTML tags entirely
    cleaned = bleach.clean(
        raw_html_or_text,
        tags=['br', 'p', 'b', 'i', 'strong', 'em', 'code', 'blockquote', 'a'],
        attributes={'a': ['href', 'rel', 'target']},
        strip=True
    )
    # Ensure external links have rel="nofollow noopener noreferrer"
    cleaned = bleach.linkify(cleaned, parse_email=False)
    return cleaned
