export function countOccurrences(text, search) {
  if (!text || !search) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

export function getAllIndices(text, search) {
  const indices = [];
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    indices.push(pos);
    pos += search.length;
  }
  return indices;
}

export function countMatches(source, text, throwIfNotFound = true) {
  const count = (source.match(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (throwIfNotFound && count === 0) throw new Error(`old_text not found in file.`);
  return count;
}

export function parseColor(colorStr) {
  if (!colorStr) return null;
  const hex = colorStr.replace('#', '');
  if (hex.length !== 6) return null;
  return { red: parseInt(hex.substring(0, 2), 16) / 255, green: parseInt(hex.substring(2, 4), 16) / 255, blue: parseInt(hex.substring(4, 6), 16) / 255 };
}
