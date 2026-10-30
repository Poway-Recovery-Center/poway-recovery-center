// Backend address (same structure as Open Coding Society pages assets/js/api/config.js)
// Locally: run `make` in the poway-recovery-center-api repo (port 8450).
// Deployed: prc.opencodingsociety.com talks to the API at prc-api.opencodingsociety.com.
const deployedPythonURI = "https://prc-api.opencodingsociety.com";

export var pythonURI;
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    pythonURI = `http://${location.hostname}:8450`;  // Same host name as the page so the login cookie is sent
} else {
    pythonURI = deployedPythonURI;
}

export const fetchOptions = {
    method: 'GET', // Default method is GET
    mode: 'cors', // Enable CORS (Cross-Origin Resource Sharing)
    cache: 'default', // Default caching behavior
    credentials: 'include', // Include credentials (cookies, etc.)
    headers: {
        'Content-Type': 'application/json',
        'X-Origin': 'client' // Custom header to identify source
    },
};

// Shared request helper: returns parsed JSON, or throws an Error with the server's message
export async function apiRequest(path, method = 'GET', body) {
    if (!pythonURI) {
        throw new Error("Accounts are not available on this site yet: the Poway Recovery Center server has not been connected.");
    }
    let response;
    try {
        response = await fetch(pythonURI + path, {
            ...fetchOptions,
            method,
            cache: 'no-store',
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (error) {
        // Network failure: backend not running, or blocked by CORS
        console.log('Possible CORS or Service Down error: ' + error);
        throw new Error(`Can't reach the Poway Recovery Center server at ${pythonURI}. Please try again shortly.`);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw Object.assign(new Error(data.message || `Request failed: ${response.status}`), { status: response.status });
    }
    return data;
}

// User Login Function
export function login(options) {
    document.getElementById(options.message).textContent = "";
    return apiRequest('/api/authenticate', 'POST', options.body)
        .then(() => options.callback())
        .catch(error => { document.getElementById(options.message).textContent = error.message; });
}
