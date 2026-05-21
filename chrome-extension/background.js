chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_LINKEDIN_COOKIES") {
    // Fetch cookies for linkedin.com
    chrome.cookies.getAll({ domain: "linkedin.com" }, (cookies) => {
      // Playwright expects a slightly different format (e.g., 'expires' instead of 'expirationDate')
      const formattedCookies = cookies.map(c => {
        const pCookie = {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite === "no_restriction" ? "None" : 
                    c.sameSite === "unspecified" ? "Lax" : 
                    c.sameSite === "lax" ? "Lax" : "Strict"
        };
        if (c.expirationDate) {
          pCookie.expires = c.expirationDate;
        }
        return pCookie;
      });
      
      sendResponse({ cookies: formattedCookies });
    });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});
