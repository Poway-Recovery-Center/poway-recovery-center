import { apiRequest } from './config.js';

// Update the logged-in user (name, email, phone, or password)
export function putUpdate(body) {
    return apiRequest('/api/user', 'PUT', body);
}

// Admin only: every user in the database
export function getAllUsers() {
    return apiRequest('/api/user');
}

export async function logoutUser() {
    await apiRequest('/api/authenticate', 'DELETE').catch(() => {});
    window.location.href = "login.html";
}

// Admin only: messages sent from the Contact Us form
export function getContactMessages() {
    return apiRequest('/api/contact');
}

export function setMessageHandled(id, handled) {
    return apiRequest('/api/contact', 'PUT', { id, handled });
}
