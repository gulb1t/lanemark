/** Rough "Chrome on Android" style label for the sessions list. Deliberately simple: display only. */
export function describeUserAgent(ua: string): string {
  if (!ua) return 'Unknown device'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /SwimTrack/.test(ua) ? 'SwimTrack app'
    : 'Browser'
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'unknown OS'
  return `${browser} on ${os}`
}

/** Hides the last part of an IP so the sessions list is useful without showing full addresses. */
export function maskIp(ip: string): string {
  if (ip.includes('.')) return ip.replace(/\.\d+$/, '.•••')
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + ':•••'
  return ip
}
