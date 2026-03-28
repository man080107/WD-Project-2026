// ============================================================
//  Planet Playground – Front-end API wrapper
//  MongoDB backend
//  JWT token stored in localStorage under "ppToken".
// ============================================================

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('ppToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiCall(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function signup(name, email, password) {
  const data = await apiCall(`${API_BASE}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (data.token) localStorage.setItem('ppToken', data.token);
  return data;
}

export async function login(email, password) {
  const data = await apiCall(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (data.token) localStorage.setItem('ppToken', data.token);
  return data;
}

export function logout() {
  localStorage.removeItem('ppToken');
}

export async function getUserProfile() {
  return await apiCall(`${API_BASE}/user`, {
    headers: { ...getAuthHeader() }
  });
}

export async function claimDailyReward(dayNumber, points) {
  return await apiCall(`${API_BASE}/reward/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ dayNumber, points })
  });
}

export async function redeemReward(rewardName, cost) {
  return await apiCall(`${API_BASE}/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ rewardName, cost })
  });
}

export async function saveQuizScore(quizType, score, total, pointsEarned) {
  return await apiCall(`${API_BASE}/quizScore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ quizType, score, total, pointsEarned })
  });
}

export async function getLeaderboard() {
  return await apiCall(`${API_BASE}/leaderboard`, {
    headers: { ...getAuthHeader() }
  });
}
