// Announce to the Vercel app that the extension is installed and ready
window.postMessage({ type: "AUTOAPPLY_EXTENSION_READY" }, "*");

// Listen for messages from the Vercel app
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data && event.data.type === "AUTOAPPLY_SYNC_REQUEST") {
    // Ask the background script for cookies
    chrome.runtime.sendMessage({ type: "GET_LINKEDIN_COOKIES" }, (response) => {
      // Send the cookies back to the Vercel app
      if (response && response.cookies) {
        window.postMessage({
          type: "AUTOAPPLY_SYNC_RESPONSE",
          cookies: response.cookies
        }, "*");
      } else {
        window.postMessage({
          type: "AUTOAPPLY_SYNC_ERROR",
          error: "Failed to retrieve cookies"
        }, "*");
      }
    });
  }
});
