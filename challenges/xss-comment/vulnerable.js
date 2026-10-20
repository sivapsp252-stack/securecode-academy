// SecureCode Academy - Challenge: Cross-Site Scripting (XSS)
//
// renderComment() builds the HTML for a user's comment.
// The page inserts the returned string with  element.innerHTML = renderComment(text)
//
// 1) Use "Post comment" to make the page execute your JavaScript.
// 2) Patch renderComment so any comment is shown as plain text, then run the tests.

function renderComment(userInput) {
  return '<div class="comment">' + userInput + '</div>';
}
