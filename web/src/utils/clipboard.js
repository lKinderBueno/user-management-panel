/**
 * Reliable copy to clipboard helper with fallback for non-secure contexts (HTTP / localhost)
 * @param {string} text - The text string to copy to the clipboard
 * @returns {Promise<boolean>} - True if copy succeeded, false otherwise
 */
export async function copyTextToClipboard(text) {
  if (!text) return false;

  // 1. Try modern navigator.clipboard API
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Falls through to fallback
  }

  // 2. Fallback using temporary textarea + document.execCommand('copy')
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0.01';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    return false;
  }
}
