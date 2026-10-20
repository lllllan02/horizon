import { Tokenizer } from 'marked';
import type { marked } from 'marked';

// Marked 4 treats only ASCII punctuation as emphasis boundaries. Match Unicode
// punctuation too, keeping UTF-16 offsets intact so source text is never rewritten.
const punctuation = /[\p{P}\p{S}]/u;
function emphasisBoundaries(source: string) {
  // Chinese prose commonly places quoted emphasis directly beside Han text.
  // Treat the inner quote/bracket as text in that case, so Marked can open or
  // close the delimiter. ASCII punctuation and masked code/links stay unchanged.
  const chineseBoundaries = source.replace(
    /(?<=\p{Script=Han}[*_]+)[\p{Ps}\p{Pi}]|[\p{Pe}\p{Pf}](?=[*_]+\p{Script=Han})/gu,
    (char) => (/[^\x00-\x7f]/u.test(char) ? 'a'.repeat(char.length) : char),
  );
  return chineseBoundaries.replace(/[^\x00-\x7f]/gu, (char) =>
    punctuation.test(char) ? '.'.repeat(char.length) : char,
  );
}

export class MarkdownTokenizer extends Tokenizer {
  private readonly boundaryMasks = new Map<string, string>();

  override emStrong(
    this: MarkdownTokenizer & marked.TokenizerThis,
    src: string,
    maskedSrc: string,
    prevChar: string,
  ): ReturnType<Tokenizer['emStrong']> {
    if (!/^[*_]/.test(src))
      return Tokenizer.prototype.emStrong.call(this, src, maskedSrc, prevChar);

    let mask = this.boundaryMasks.get(maskedSrc);
    if (mask === undefined) {
      mask = emphasisBoundaries(maskedSrc);
      this.boundaryMasks.set(maskedSrc, mask);
    }
    if (mask === maskedSrc)
      return Tokenizer.prototype.emStrong.call(this, src, maskedSrc, prevChar);

    // Marked keeps only the final UTF-16 unit of the preceding text. Recover
    // the complete code point before classifying an astral symbol as punctuation.
    let previous = prevChar || '';
    if (/^[\uDC00-\uDFFF]$/.test(previous)) {
      const offset = maskedSrc.length - src.length;
      const candidate = maskedSrc.slice(Math.max(0, offset - 2), offset);
      if (candidate.endsWith(previous)) previous = candidate;
    }

    // Delegate delimiter matching (including escapes and nesting) to Marked.
    // Its recursive tokenization must run on the original text below instead.
    const context = Object.create(this) as Tokenizer & marked.TokenizerThis;
    context.lexer = Object.create(this.lexer) as marked.Lexer;
    context.lexer.inlineTokens = () => [];
    const token = Tokenizer.prototype.emStrong.call(
      context,
      // Only the character after the opening delimiter is inspected in src;
      // closing delimiters are matched against the cached mask above.
      src.replace(/^(\*+|_+)([^\x00-\x7f])/u, (_, delimiter: string, char: string) => {
        const offset = maskedSrc.length - src.length + delimiter.length;
        return delimiter + mask.slice(offset, offset + char.length);
      }),
      mask,
      emphasisBoundaries(previous),
    );
    if (!token) return token;
    const raw = src.slice(0, token.raw.length);
    const width = token.type === 'strong' ? 2 : 1;
    const text = raw.slice(width, -width);
    return { ...token, raw, text, tokens: this.lexer.inlineTokens(text) };
  }
}
