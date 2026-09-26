// Runs before first paint so the page never flashes the wrong theme. External file because the CSP forbids inline scripts.
;(function () {
  try {
    var pref = localStorage.getItem('swimtrack:theme') || 'system'
    var dark = pref === 'dark' || (pref === 'system' && !matchMedia('(prefers-color-scheme: light)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  } catch {
    document.documentElement.dataset.theme = 'dark'
  }
})()
