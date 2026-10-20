import { apiRequest } from './config.js';

// Calendar days with their sessions, from the backend (start is "YYYY-MM-DD", or omit for today)
export function getCalendar(start, days = 7) {
    const query = new URLSearchParams({ days });
    if (start) query.set('start', start);
    return apiRequest(`/api/schedule?${query}`);
}

// Logged-in user's upcoming reservations
export function getMyBookings() {
    return apiRequest('/api/schedule/bookings');
}

export function bookSession(meetingId, date, spots = 1) {
    return apiRequest('/api/schedule/bookings', 'POST', { meeting_id: meetingId, date, spots });
}

// Change how many spots an existing reservation holds
export function updateSession(meetingId, date, spots) {
    return apiRequest('/api/schedule/bookings', 'PUT', { meeting_id: meetingId, date, spots });
}

export function cancelSession(meetingId, date) {
    return apiRequest('/api/schedule/bookings', 'DELETE', { meeting_id: meetingId, date });
}
