import { apiRequest } from './config.js';

// Recovery tracker: the logged-in user's weekly check-ins {week, checkins}
export function getCheckIns() {
    return apiRequest('/api/checkins');
}

// Save this week's check-in {sleep, anxiety, focus, hope, note}; very low weeks alert the center's counselors
export function saveCheckIn(checkin) {
    return apiRequest('/api/checkins', 'POST', checkin);
}
