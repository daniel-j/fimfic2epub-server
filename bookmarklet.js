// ==Bookmarklet==
// @name fimfic2epub
// @author djazz
// ==/Bookmarklet==

var m = document.location.pathname.match(/^\/story\/(\d*)/);
if (m) {
  var storyId = m[1];
  document.location.href = 'PROTOCOL://HOST/story/' + storyId + '/download';
}

