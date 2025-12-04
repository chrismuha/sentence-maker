document.getElementById("breakBtn").addEventListener("click", insertBreak);

function insertBreak() {
  const editor = document.getElementById("editor");
  const start = editor.selectionStart;
  const end = editor.selectionEnd;

  // Insert a newline at the cursor
  const text = editor.value;
  editor.value = text.substring(0, start) + "\n" + text.substring(end);

  // Move cursor after the newline
  editor.selectionStart = editor.selectionEnd = start + 1;
  editor.focus();
}