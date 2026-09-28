// Runs before the app. SwimTrack's styles need Chrome 111 or newer; an older browser, or a phone whose Android System
// WebView was never updated, would show a broken page, so it gets a short note instead. Plain ES5 on purpose: this has
// to run in browsers too old for the app's own code.
;(function () {
  var ok = false
  try {
    ok = !!(window.CSS && CSS.supports && CSS.supports('color', 'color-mix(in oklab, red, blue)'))
  // eslint-disable-next-line no-unused-vars -- ES5 has no catch without a binding
  } catch (e) {
    ok = false
  }
  if (ok) return
  window.__swimtrackTooOld = true
  var inApp = !!window.Capacitor || /; wv\)/.test(navigator.userAgent)
  var title = inApp ? 'Update Android System WebView' : 'This browser is too old for SwimTrack'
  var body = inApp
    ? 'SwimTrack uses the phone’s Android System WebView to draw its screens, and the one on this phone is out of date. Update it from the Play Store (it’s free), then open SwimTrack again.'
    : 'Open SwimTrack in an up-to-date Chrome, Edge, Firefox or Safari.'
  var button = inApp
    ? '<a href="market://details?id=com.google.android.webview" style="display:inline-block;margin-top:24px;padding:12px 22px;border-radius:999px;background:#3ce0cf;color:#04211e;font-weight:600;text-decoration:none">Open the Play Store</a>'
    : ''
  function show() {
    var root = document.getElementById('root') || document.body
    root.innerHTML =
      '<div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;overflow:auto;display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;background:#060709;color:#e8ecf1;font-family:system-ui,sans-serif;text-align:center">' +
      '<div style="max-width:340px"><h1 style="font-size:22px;margin:0 0 12px">' + title + '</h1>' +
      '<p style="font-size:15px;line-height:1.55;color:#9aa4b1;margin:0">' + body + '</p>' + button + '</div></div>'
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show)
  else show()
})()
