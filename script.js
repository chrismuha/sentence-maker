document.getElementById("breakBtn").addEventListener("click", breakSentences);

function breakSentences() {
  const editor = document.getElementById("editor");
  const text = editor.value.trim();

  // Split on sentence-ending punctuation and trim each chunk
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [];
  const separated = sentences.map(sentence => sentence.trim()).filter(Boolean);

  editor.value = separated.join("\n");
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  editor.focus();
}
