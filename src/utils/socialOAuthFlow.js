const getBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5174';
  }
  return window.location.origin;
};

export function startOAuthFlow(provider) {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    const popup = window.open(
      `${baseUrl}/api/auth/${provider}/login`,
      'oauth-popup',
      'width=600,height=700,scrollbars=yes,popup=1'
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for this site.'));
      return;
    }

    const handleMessage = (event) => {
      if (event.data?.provider === provider) {
        window.removeEventListener('message', handleMessage);
        if (event.data.profile?.error) {
          reject(new Error(event.data.profile.error));
        } else {
          resolve(event.data.profile);
        }
        try { popup.close(); } catch {}
      }
    };

    window.addEventListener('message', handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('OAuth popup was closed before completing.'));
      }
    }, 1000);

    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', handleMessage);
      try { popup.close(); } catch {}
      reject(new Error('OAuth request timed out. Please try again.'));
    }, 300000);
  });
}
