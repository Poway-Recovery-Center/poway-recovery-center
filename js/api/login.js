import { apiRequest } from './config.js';

// Current user from the backend, or null when logged out / server unreachable
export function getCredentials() {
    return apiRequest('/api/id').catch(() => null);
}

// Swap every "Log in" link (header button, home page quick link) for the user's profile link when logged in
document.addEventListener('DOMContentLoaded', async () => {
    const links = document.querySelectorAll('[data-account-link]');
    if (!links.length) return;
    const user = await getCredentials();
    window.user = user;
    if (!user) return;
    links.forEach(link => {
        link.href = "profile.html";
        // Home page hub tile: only its title changes
        const title = link.querySelector('.hub__title');
        if (title) {
            title.textContent = `My profile (${user.name.split(" ")[0]})`;
            link.querySelector('.hub__desc').textContent = "See and change your reservations.";
            return;
        }
        // Keep a trailing arrow span if the link has one
        const arrow = link.querySelector('span');
        link.textContent = link.closest('.site-nav') ? "My profile" : `My profile (${user.name.split(" ")[0]})`;
        if (arrow) link.append(' ', arrow);
    });
});
