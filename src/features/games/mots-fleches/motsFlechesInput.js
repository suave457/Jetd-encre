import { applyTypedLetter } from "./motsFlechesEngine.js";

export function isMotsFlechesShortcut(event) {
  return Boolean(event.ctrlKey || event.metaKey || event.altKey || event.isComposing
    || event.nativeEvent?.isComposing || event.keyCode === 229);
}

export function getMotsFlechesLetters(text = "") {
  return Array.from(String(text).normalize("NFC"))
    .filter((letter) => /^[a-zA-ZÀ-ÖØ-öø-ÿŒœ]$/u.test(letter));
}

export function applyEntryText(progress, model, entry, startKey, text) {
  const startIndex = entry?.cells.findIndex((cell) => cell.key === startKey) ?? -1;
  const letters = getMotsFlechesLetters(text);
  if (startIndex < 0 || letters.length === 0) {
    return { progress, nextIndex: startIndex, acceptedCount: 0 };
  }

  const acceptedCount = Math.min(letters.length, entry.cells.length - startIndex);
  let nextProgress = progress;
  for (let offset = 0; offset < acceptedCount; offset += 1) {
    const key = entry.cells[startIndex + offset].key;
    nextProgress = applyTypedLetter(nextProgress, key, letters[offset], model.cells.get(key).solution);
  }
  return {
    progress: nextProgress,
    nextIndex: Math.min(entry.cells.length - 1, startIndex + acceptedCount),
    acceptedCount,
  };
}
