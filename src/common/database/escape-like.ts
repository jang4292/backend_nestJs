export function escapeLike(value: string, escapeCharacter = '\\'): string {
  return Array.from(value, (character) =>
    character === escapeCharacter || character === '%' || character === '_'
      ? `${escapeCharacter}${character}`
      : character,
  ).join('');
}
