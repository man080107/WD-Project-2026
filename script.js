// ============================================================
//  Planet Playground – Main Script
//  Backend: Node/Express + MongoDB
//  Auth: JWT stored in localStorage
// ============================================================

import {
  signup,
  login,
  logout,
  getUserProfile,
  claimDailyReward,
  redeemReward,
  saveQuizScore,
  getLeaderboard
} from "./api.js";

// ── GLOBAL STATE ─────────────────────────────────────────────
let currentUser = null;

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuthState();
  initNavHandlers();
  initSearch();
  initRewardHandlers();
  initRedeemHandler();
  initLeaderboardHandler();
  initContentModals();
  initAnimations();
});

// ── ANIMATIONS ───────────────────────────────────────────────
function initAnimations() {
  // Inject keyframes once
  if (!document.getElementById('pp-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pp-keyframes';
    style.textContent = `
      @keyframes popIn { from { transform:scale(0.8);opacity:0; } to { transform:scale(1);opacity:1; } }
      @keyframes slideInRight { from { transform:translateX(120px);opacity:0; } to { transform:translateX(0);opacity:1; } }
      @keyframes fadeInUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
    `;
    document.head.appendChild(style);
  }

  // Observe sections for fade-in
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'fadeInUp 0.6s ease forwards';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.category, .reward-day, .eco-points-balance').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// ── AUTH STATE ───────────────────────────────────────────────
async function initAuthState() {
  const token = localStorage.getItem('ppToken');
  if (token) {
    try {
      const profile = await getUserProfile();
      currentUser = profile;
      updateUIForLoggedIn(profile.name || profile.email);
      syncUIFromProfile(profile);
      showDBBanner();
    } catch (e) {
      console.warn('Session expired, logged out:', e.message);
      localStorage.removeItem('ppToken');
      updateUIForLoggedOut();
      loadLocalFallback();
    }
  } else {
    updateUIForLoggedOut();
    loadLocalFallback();
    // Show server status banner if server is running
    try {
      const r = await fetch('/api/leaderboard');
      if (r.ok) showDBBanner();
    } catch { /* server not running – offline mode */ }
  }
}

function showDBBanner() {
  const banner = document.getElementById('db-banner');
  if (banner) {
    banner.style.display = 'block';
    setTimeout(() => {
      banner.style.transition = 'opacity 0.5s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 500);
    }, 4000);
  }
}

// ── NAV HANDLERS ─────────────────────────────────────────────
function initNavHandlers() {
  document.getElementById('play-now-btn')?.addEventListener('click', () => {
    document.querySelector('.category-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('nav-points')?.addEventListener('click', e => {
    e.preventDefault();
    document.querySelector('.daily-rewards-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('nav-help')?.addEventListener('click', e => {
    e.preventDefault();
    showHelpModal();
  });

  document.getElementById('nav-login')?.addEventListener('click', e => {
    e.preventDefault();
    if (currentUser) confirmLogout();
    else showLoginModal();
  });
}

// ── SEARCH ───────────────────────────────────────────────────
function initSearch() {
  const searchInput = document.getElementById('search-input');
  document.getElementById('search-icon')?.addEventListener('click', performSearch);
  searchInput?.addEventListener('keydown', e => { if (e.key === 'Enter') performSearch(); });
}

function performSearch() {
  const query = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  if (!query) return;
  const map = {
    quiz: '#games', puzzle: '#games', video: '#games', vid: '#games', game: '#games',
    environment: '#learn', content: '#learn', learn: '#learn', read: '#learn',
    reward: '#rewards', points: '#rewards', eco: '#rewards', streak: '#rewards',
    leaderboard: '#rewards', redeem: '#rewards'
  };
  for (const [kw, anchor] of Object.entries(map)) {
    if (query.includes(kw)) {
      document.querySelector(anchor)?.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('search-input').value = '';
      return;
    }
  }
  showNotification(`No results for "${query}"`, 'warning');
  document.getElementById('search-input').value = '';
}

// ── DAILY REWARDS ────────────────────────────────────────────
function initRewardHandlers() {
  document.querySelectorAll('.reward-day').forEach(day => {
    day.addEventListener('click', function () {
      if (this.classList.contains('active')) handleClaimReward(this);
      else if (this.classList.contains('locked')) {
        showNotification('🔒 Complete previous days first!', 'warning');
      } else if (this.classList.contains('claimed')) {
        showNotification('✅ Already claimed today!', 'info');
      }
    });
  });
}

async function handleClaimReward(dayEl) {
  const dayNumber = parseInt(dayEl.dataset.day);
  const points    = parseInt(dayEl.dataset.points) || 5;
  const rewardText = dayEl.querySelector('.reward-text')?.textContent || '';

  // Bounce animation
  dayEl.style.transform = 'scale(1.15)';
  setTimeout(() => { dayEl.style.transform = ''; }, 300);

  if (currentUser) {
    try {
      await claimDailyReward(dayNumber, points);
      const profile = await getUserProfile();
      currentUser = profile;
      syncUIFromProfile(profile);
      showNotification(`🎉 Day ${dayNumber} Reward Claimed: ${rewardText}`, 'success');
    } catch (err) {
      showNotification(`❌ ${err.message || 'Error claiming reward'}`, 'warning');
      return;
    }
  } else {
    // Local fallback – no server needed
    const el  = document.getElementById('points-count');
    const cur = parseInt(el?.textContent || '0');
    const newTotal = cur + points;
    if (el) el.textContent = `${newTotal} Points`;
    localStorage.setItem('ecoPoints', newTotal);
    showNotification(`🎉 Day ${dayNumber} Reward Claimed! +${points} Eco Points`, 'success');
  }

  // UI update
  dayEl.classList.remove('active');
  dayEl.classList.add('claimed');
  const statusEl = dayEl.querySelector('.reward-status');
  if (statusEl) { statusEl.textContent = 'Claimed'; statusEl.className = 'reward-status claimed'; }

  if (points > 0) activateNextDay(dayNumber);
}

function activateNextDay(claimedDay) {
  const nextEl = document.getElementById('reward-day-' + (claimedDay + 1));
  if (nextEl && nextEl.classList.contains('locked')) {
    setTimeout(() => {
      nextEl.classList.remove('locked');
      nextEl.classList.add('active');
      const statusEl = nextEl.querySelector('.reward-status');
      if (statusEl) { statusEl.textContent = 'Available'; statusEl.className = 'reward-status available'; }
    }, 800);
  }
}

// ── REDEEM ───────────────────────────────────────────────────
function initRedeemHandler() {
  document.getElementById('redeem-btn')?.addEventListener('click', showRedeemModal);
}

async function executeRedeem(name, cost) {
  if (!currentUser) {
    showNotification('⚠️ Please log in to redeem rewards', 'warning');
    showLoginModal();
    return;
  }
  try {
    await redeemReward(name, cost);
    const profile = await getUserProfile();
    currentUser = profile;
    syncUIFromProfile(profile);
    showNotification(`✅ Redeemed: ${name}!`, 'success');
    removeModal('redeem-modal');
  } catch (e) {
    showNotification(`❌ ${e.message || 'Redemption failed'}`, 'warning');
  }
}
window.executeRedeem = executeRedeem;

// ── LEADERBOARD ──────────────────────────────────────────────
function initLeaderboardHandler() {
  document.getElementById('leaderboard-btn')?.addEventListener('click', showLeaderboard);
}

async function showLeaderboard() {
  removeModal('leaderboard-modal');
  let rows = '';
  let statusMsg = '';

  try {
    const top = await getLeaderboard();
    if (top.length === 0) {
      rows = `<div style="text-align:center;padding:30px;color:#888;">
        <div style="font-size:3rem;margin-bottom:12px;">🌱</div>
        <div style="font-weight:600;">No players yet!</div>
        <div style="font-size:13px;margin-top:6px;">Sign up and play games to appear here.</div>
      </div>`;
    } else {
      rows = top.map((u, i) => {
        const medals   = ['🥇','🥈','🥉'];
        const medal    = medals[i] || `<span style="font-weight:700;color:#999;">#${i+1}</span>`;
        const isMe     = currentUser && u.name === currentUser.name;
        const bgColor  = isMe ? '#f1f8e9' : (i === 0 ? '#fffde7' : '#fafafa');
        const border   = isMe ? '2px solid #4caf50' : (i === 0 ? '2px solid #fdd835' : '2px solid #eee');
        return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:${bgColor};border-radius:12px;border:${border};margin-bottom:2px;">
          <span style="font-size:1.5em;width:32px;text-align:center;">${medal}</span>
          <div style="flex:1;">
            <div style="font-weight:600;color:#333;font-size:15px;">${escapeHtml(u.name)}${isMe ? ' <span style="font-size:11px;background:#4caf50;color:white;padding:2px 8px;border-radius:10px;vertical-align:middle;">You</span>' : ''}</div>
            <div style="font-size:12px;color:#888;margin-top:2px;">🔥 ${u.streak||0} day streak · 🏅 ${u.badges?.length||0} badges</div>
          </div>
          <div style="font-weight:700;color:#2e7d32;font-size:1.15em;">${u.ecoPoints||0} <span style="font-size:11px;font-weight:500;color:#888;">pts</span></div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    statusMsg = `<div style="text-align:center;padding:20px;color:#e65100;">
      <i class="fa-solid fa-triangle-exclamation"></i> Server not running.<br>
      <span style="font-size:13px;color:#888;">Start the server with <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">node server.js</code></span>
    </div>`;
    rows = statusMsg;
  }

  const modal = document.createElement('div');
  modal.id = 'leaderboard-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(6px);" onclick="if(event.target===this) removeModal('leaderboard-modal')">
      <div style="background:white;padding:30px;border-radius:22px;max-width:500px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Poppins',sans-serif;animation:popIn 0.3s ease;max-height:85vh;overflow-y:auto;">
        <div style="text-align:center;margin-bottom:22px;">
          <div style="font-size:2.5rem;">🏆</div>
          <h3 style="color:#e65100;font-size:1.5em;margin-top:8px;">Global Leaderboard</h3>
          <p style="color:#888;font-size:13px;margin-top:4px;">Top Eco Heroes by Points</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:22px;">${rows}</div>
        <button onclick="removeModal('leaderboard-modal')" style="width:100%;padding:13px;background:linear-gradient(135deg,#ff9800,#e65100);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-family:'Poppins',sans-serif;font-size:15px;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── CONTENT MODALS ───────────────────────────────────────────
function initContentModals() {
  document.querySelectorAll('.content-card').forEach(card => {
    card.addEventListener('click', () => {
      const heading = card.querySelector('p')?.textContent || '';
      showContentModal(heading);
    });
  });
}

const contentDetails = {
  'What is Environment ?': {
    icon: '🌿',
    content: `The environment is everything around us — the air we breathe, the water we drink, the land we live on, and all the plants and animals sharing our planet. It includes both the natural world (forests, oceans, atmosphere) and the built world (cities, farms, roads).

Understanding our environment means recognizing how all these elements connect and depend on each other. When one part is affected, it creates a ripple effect throughout the entire system.`,
    facts: [
      'The Amazon rainforest produces 20% of the world\'s oxygen and is home to 10% of all species.',
      'Earth has over 8.7 million known species, but millions more remain undiscovered.',
      'Oceans cover 71% of Earth\'s surface and regulate global climate and weather patterns.',
      'The atmosphere extends about 10,000 km above Earth\'s surface, protecting us from harmful radiation.'
    ]
  },
  'Why it is needed ?': {
    icon: '🌍',
    content: `A healthy environment is the foundation of all life on Earth. Without clean air, pure water, fertile soil, and stable climate — human civilisations cannot survive, let alone thrive.

The environment provides ecosystem services worth $125 trillion per year: purifying air and water, pollinating crops, stabilising climate, preventing floods, and providing medicines. Protecting it isn't just an ethical choice — it's an economic necessity.`,
    facts: [
      'Air pollution causes 7 million premature deaths every year worldwide (WHO).',
      'Forests prevent soil erosion, regulate rainfall, and are home to 80% of land-based biodiversity.',
      'Over 50% of all modern medicines are derived from natural compounds found in nature.',
      'Coral reefs protect coastlines and support fisheries worth $375 billion annually.'
    ]
  },
  'Relation between human and Environment': {
    icon: '🤝',
    content: `Humans and the environment share a deep, two-way relationship. For thousands of years, humans lived in balance with nature — hunting, farming, and building sustainably. However, the Industrial Revolution (1760s–1840s) accelerated resource consumption exponentially.

Today, human activity is the dominant force shaping the planet. Scientists call this era the "Anthropocene" — the age of humans. We have the power to both destroy and restore our environment. The choices we make every day — what we eat, how we travel, what we buy — directly impact the planet.`,
    facts: [
      'The Industrial Revolution began in the 1760s and transformed how humans interact with nature forever.',
      'Renewable energy (solar + wind) could power the entire world\'s needs by 2050 if scaled up.',
      'Reforestation is one of the most cost-effective climate change solutions available today.',
      'A plant-based diet reduces your carbon footprint by up to 73% compared to a meat-heavy diet.'
    ]
  },
  'Damage to Environment': {
    icon: '⚠️',
    content: `Environmental damage occurs through pollution, deforestation, overexploitation of natural resources, and climate change. These problems are interconnected — deforestation increases CO₂, which warms the climate, which kills more forests.

The good news: many ecosystems can recover if we act quickly. Rivers that were once dead from pollution have revived. Species on the brink of extinction have rebounded. We have the knowledge and technology to reverse much of the damage — what's needed is collective action.`,
    facts: [
      '1 million plastic bottles are purchased every minute globally. Only 9% of all plastic ever made has been recycled.',
      'Global temperatures have risen 1.2°C since pre-industrial times. Scientists warn 1.5°C is the critical threshold.',
      'An estimated 10,000 species go extinct every year — primarily due to habitat loss caused by humans.',
      'The Great Pacific Garbage Patch is twice the size of Texas, containing 1.8 trillion pieces of plastic.'
    ]
  }
};

function showContentModal(heading) {
  const data = contentDetails[heading];
  if (!data) return;
  removeModal('content-modal');
  const modal = document.createElement('div');
  modal.id = 'content-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(6px);" onclick="if(event.target===this) removeModal('content-modal')">
      <div style="background:white;padding:32px;border-radius:22px;max-width:560px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Poppins',sans-serif;animation:popIn 0.3s ease;max-height:88vh;overflow-y:auto;">
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:3.5rem;">${data.icon}</span>
          <h2 style="color:#2e7d32;margin-top:12px;font-size:1.4em;line-height:1.3;">${heading}</h2>
        </div>
        <p style="color:#444;line-height:1.9;margin-bottom:20px;white-space:pre-line;font-size:14px;">${data.content}</p>
        <div style="background:linear-gradient(135deg,#e8f5e8,#f1f8e9);border-radius:14px;padding:20px;margin-bottom:20px;">
          <h4 style="color:#2e7d32;margin-bottom:14px;font-size:1em;"><i class="fa-solid fa-lightbulb"></i> Did You Know?</h4>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${data.facts.map(f => `<div style="padding:12px 14px;background:white;border-left:4px solid #4caf50;border-radius:8px;font-size:13px;color:#444;line-height:1.6;">🌱 ${f}</div>`).join('')}
          </div>
        </div>
        <button onclick="removeModal('content-modal')" style="width:100%;padding:13px;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:15px;">Got it! 🌍</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ── UI SYNC ──────────────────────────────────────────────────
function updateUIForLoggedIn(name) {
  const el = document.getElementById('nav-login');
  if (el) el.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${escapeHtml(name)}`;
}

function updateUIForLoggedOut() {
  const el = document.getElementById('nav-login');
  if (el) el.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login`;
}

function loadLocalFallback() {
  const pts = localStorage.getItem('ecoPoints') || '0';
  const el  = document.getElementById('points-count');
  if (el) el.textContent = `${pts} Points`;
}

function syncUIFromProfile(profile) {
  if (!profile) return;
  const el = document.getElementById('points-count');
  if (el) el.textContent = `${profile.ecoPoints || 0} Points`;
  const sc = document.getElementById('streak-count');
  if (sc) sc.textContent = profile.streak || 0;

  const claimed = profile.claimedDays || [];
  claimed.forEach(dayNum => {
    const dayEl = document.getElementById('reward-day-' + dayNum);
    if (dayEl) {
      dayEl.classList.remove('active', 'locked');
      dayEl.classList.add('claimed');
      const status = dayEl.querySelector('.reward-status');
      if (status) { status.textContent = 'Claimed'; status.className = 'reward-status claimed'; }
    }
  });

  if (claimed.length === 0) {
    // Activate day 1 if nothing claimed
    const d1 = document.getElementById('reward-day-1');
    if (d1 && !d1.classList.contains('active')) {
      d1.classList.remove('locked');
      d1.classList.add('active');
    }
  } else {
    const maxClaimed = Math.max(...claimed);
    const nextDay = maxClaimed + 1;
    if (nextDay <= 7 && !claimed.includes(nextDay)) {
      const nextEl = document.getElementById('reward-day-' + nextDay);
      if (nextEl && nextEl.classList.contains('locked')) {
        nextEl.classList.remove('locked');
        nextEl.classList.add('active');
        const status = nextEl.querySelector('.reward-status');
        if (status) { status.textContent = 'Available'; status.className = 'reward-status available'; }
      }
    }
  }
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
function showNotification(message, type = 'success') {
  const colors = {
    success: 'linear-gradient(135deg,#4caf50,#388e3c)',
    warning: 'linear-gradient(135deg,#ff9800,#e65100)',
    info:    'linear-gradient(135deg,#2196f3,#1565c0)'
  };
  const icons = { success: '✅', warning: '⚠️', info: 'ℹ️' };

  // Remove existing
  document.getElementById('pp-notification')?.remove();

  const n = document.createElement('div');
  n.id = 'pp-notification';
  n.style.cssText = `position:fixed;top:24px;right:24px;background:${colors[type]||colors.success};color:white;
    padding:14px 22px;border-radius:14px;box-shadow:0 8px 25px rgba(0,0,0,0.25);z-index:3000;
    font-family:'Poppins',sans-serif;font-weight:500;font-size:14px;
    display:flex;align-items:center;gap:10px;animation:slideInRight 0.4s ease;max-width:340px;`;
  n.innerHTML = `<span style="font-size:1.1em;">${icons[type]||''}</span><span>${message}</span>`;
  document.body.appendChild(n);
  setTimeout(() => { n.style.transition='opacity 0.5s'; n.style.opacity='0'; }, 3200);
  setTimeout(() => n.remove(), 3800);
}

// ── LOGIN MODAL ──────────────────────────────────────────────
function showLoginModal() {
  removeModal('login-modal');
  const modal = document.createElement('div');
  modal.id = 'login-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(6px);" onclick="if(event.target===this) removeModal('login-modal')">
      <div style="background:white;padding:36px;border-radius:22px;max-width:390px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Poppins',sans-serif;animation:popIn 0.3s ease;">
        <div style="text-align:center;margin-bottom:24px;">
          <i class="fa-solid fa-seedling" style="font-size:2.8rem;color:#4caf50;"></i>
          <h2 style="color:#2e7d32;margin-top:12px;font-size:1.5em;">Planet Playground</h2>
          <p style="color:#888;font-size:13px;margin-top:4px;">Login to save your progress 🌍</p>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:22px;">
          <button id="tab-login" onclick="switchLoginTab('login')" style="flex:1;padding:11px;border:none;border-radius:10px;cursor:pointer;font-family:'Poppins',sans-serif;font-weight:600;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;font-size:14px;">Login</button>
          <button id="tab-signup" onclick="switchLoginTab('signup')" style="flex:1;padding:11px;border:none;border-radius:10px;cursor:pointer;font-family:'Poppins',sans-serif;font-weight:600;background:#f1f8e9;color:#4caf50;font-size:14px;">Sign Up</button>
        </div>
        <div id="login-form">
          <input id="login-email" type="email" placeholder="📧 Email address" style="width:100%;padding:13px 15px;border:2px solid #e8f5e8;border-radius:12px;margin-bottom:12px;font-family:'Poppins',sans-serif;font-size:14px;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#4caf50'" onblur="this.style.borderColor='#e8f5e8'">
          <input id="login-password" type="password" placeholder="🔒 Password" style="width:100%;padding:13px 15px;border:2px solid #e8f5e8;border-radius:12px;margin-bottom:20px;font-family:'Poppins',sans-serif;font-size:14px;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#4caf50'" onblur="this.style.borderColor='#e8f5e8'" onkeydown="if(event.key==='Enter') handleLogin()">
          <button id="login-submit" onclick="handleLogin()" style="width:100%;padding:14px;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:15px;font-family:'Poppins',sans-serif;transition:all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Login →</button>
        </div>
        <div id="signup-form" style="display:none;">
          <input id="signup-name" type="text" placeholder="👤 Full Name" style="width:100%;padding:13px 15px;border:2px solid #e8f5e8;border-radius:12px;margin-bottom:12px;font-family:'Poppins',sans-serif;font-size:14px;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#4caf50'" onblur="this.style.borderColor='#e8f5e8'">
          <input id="signup-email" type="email" placeholder="📧 Email address" style="width:100%;padding:13px 15px;border:2px solid #e8f5e8;border-radius:12px;margin-bottom:12px;font-family:'Poppins',sans-serif;font-size:14px;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#4caf50'" onblur="this.style.borderColor='#e8f5e8'">
          <input id="signup-password" type="password" placeholder="🔒 Password (min 6 chars)" style="width:100%;padding:13px 15px;border:2px solid #e8f5e8;border-radius:12px;margin-bottom:20px;font-family:'Poppins',sans-serif;font-size:14px;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#4caf50'" onblur="this.style.borderColor='#e8f5e8'" onkeydown="if(event.key==='Enter') handleSignup()">
          <button id="signup-submit" onclick="handleSignup()" style="width:100%;padding:14px;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:15px;font-family:'Poppins',sans-serif;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">Create Account 🌱</button>
        </div>
        <div style="text-align:center;margin-top:14px;padding:12px;background:#f9fff9;border-radius:10px;font-size:12px;color:#888;">
          <i class="fa-solid fa-database" style="color:#4caf50;"></i> Data saved securely in MongoDB database
        </div>
        <button onclick="removeModal('login-modal')" style="width:100%;margin-top:10px;padding:10px;background:transparent;color:#bbb;border:none;cursor:pointer;font-family:'Poppins',sans-serif;font-size:13px;">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

window.switchLoginTab = function(tab) {
  const isLogin = tab === 'login';
  document.getElementById('login-form').style.display  = isLogin ? 'block' : 'none';
  document.getElementById('signup-form').style.display = isLogin ? 'none' : 'block';
  document.getElementById('tab-login').style.background  = isLogin ? 'linear-gradient(135deg,#4caf50,#388e3c)' : '#f1f8e9';
  document.getElementById('tab-login').style.color       = isLogin ? 'white' : '#4caf50';
  document.getElementById('tab-signup').style.background = isLogin ? '#f1f8e9' : 'linear-gradient(135deg,#4caf50,#388e3c)';
  document.getElementById('tab-signup').style.color      = isLogin ? '#4caf50' : 'white';
};

window.handleLogin = async function() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();
  if (!email || !password) { showNotification('⚠️ Please fill in all fields', 'warning'); return; }
  const btn = document.getElementById('login-submit');
  btn.textContent = 'Logging in…'; btn.disabled = true;
  try {
    const data = await login(email, password);
    const profile = await getUserProfile();
    currentUser = profile;
    updateUIForLoggedIn(profile.name || profile.email);
    syncUIFromProfile(profile);
    removeModal('login-modal');
    showNotification(`👋 Welcome back, ${profile.name}!`, 'success');
  } catch (e) {
    btn.textContent = 'Login →'; btn.disabled = false;
    showNotification('❌ ' + (e.message || 'Login failed'), 'warning');
  }
};

window.handleSignup = async function() {
  const name     = document.getElementById('signup-name')?.value.trim();
  const email    = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value.trim();
  if (!name || !email || !password) { showNotification('⚠️ Please fill in all fields', 'warning'); return; }
  const btn = document.getElementById('signup-submit');
  btn.textContent = 'Creating…'; btn.disabled = true;
  try {
    const data = await signup(name, email, password);
    const profile = await getUserProfile();
    currentUser = profile;
    updateUIForLoggedIn(profile.name || profile.email);
    syncUIFromProfile(profile);
    removeModal('login-modal');
    showNotification(`🎉 Welcome to Planet Playground, ${profile.name}!`, 'success');
  } catch (e) {
    btn.textContent = 'Create Account 🌱'; btn.disabled = false;
    showNotification('❌ ' + (e.message || 'Signup failed'), 'warning');
  }
};

function confirmLogout() {
  if (!confirm('Log out of Planet Playground?')) return;
  logout();
  currentUser = null;
  updateUIForLoggedOut();
  loadLocalFallback();
  showNotification('👋 Logged out successfully', 'info');
}

// ── HELP MODAL ───────────────────────────────────────────────
function showHelpModal() {
  removeModal('help-modal');
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(6px);" onclick="if(event.target===this) removeModal('help-modal')">
      <div style="background:white;padding:32px;border-radius:22px;max-width:520px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Poppins',sans-serif;animation:popIn 0.3s ease;max-height:88vh;overflow-y:auto;">
        <div style="text-align:center;margin-bottom:22px;">
          <span style="font-size:2.5rem;">❓</span>
          <h2 style="color:#2e7d32;margin-top:10px;font-size:1.5em;">Help Center</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:22px;">
          ${helpItem('🎮','How to Play Games?','Click any game card in the Games Corner. Complete quizzes and puzzles to earn Eco Points. Each game type has a different point reward!')}
          ${helpItem('🌱','What are Eco Points?','Points are earned by completing activities — quizzes (+10), puzzles (+15), video quizzes (+20), and daily rewards. Log in to save your points forever!')}
          ${helpItem('💾','MongoDB Database','All your data is securely saved in a cloud MongoDB database. Fast, secure, and reliable.')}
          ${helpItem('📅','Daily Rewards','Log in every day and click the glowing reward card. Claim consecutive days for bigger rewards. Build your streak!')}
          ${helpItem('🏆','Leaderboard','The top 10 players by Eco Points are shown here. Log in, play games, and earn points to climb the leaderboard!')}
          ${helpItem('🎁','Redeeming Rewards','Collect enough Eco Points and click "Redeem Rewards" to exchange them for virtual trees, badges, quiz unlocks, and certificates.')}
          ${helpItem('📧','Contact Support','Email: info@planetplayground.edu | Phone: +91 98765 43210 | Location: Surat, Gujarat, India')}
        </div>
        <button onclick="removeModal('help-modal')" style="width:100%;padding:13px;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:15px;">Got it! 🌍</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function helpItem(icon, title, desc) {
  return `<div style="padding:14px 16px;background:linear-gradient(135deg,#f9fff9,#f1f8e9);border-left:4px solid #4caf50;border-radius:10px;">
    <div style="font-weight:700;color:#2e7d32;margin-bottom:5px;font-size:14px;">${icon} ${title}</div>
    <div style="font-size:13px;color:#555;line-height:1.6;">${desc}</div>
  </div>`;
}

// ── REDEEM MODAL ─────────────────────────────────────────────
function showRedeemModal() {
  const pts  = parseInt(document.getElementById('points-count')?.textContent) || 0;
  removeModal('redeem-modal');
  const items = [
    { icon: '🌱', name: 'Plant a Virtual Tree',   cost: 50,  desc: 'Add a tree to your eco-garden' },
    { icon: '🧩', name: 'Unlock Special Quiz',    cost: 75,  desc: 'Access an exclusive eco challenge' },
    { icon: '🏆', name: 'Earth Champion Badge',   cost: 100, desc: 'Show off your eco-hero status' },
    { icon: '🎓', name: 'Learning Certificate',   cost: 150, desc: 'Digital certificate of completion' }
  ];
  const modal = document.createElement('div');
  modal.id = 'redeem-modal';
  modal.innerHTML = `
    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(6px);" onclick="if(event.target===this) removeModal('redeem-modal')">
      <div style="background:white;padding:32px;border-radius:22px;max-width:440px;width:92%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);font-family:'Poppins',sans-serif;animation:popIn 0.3s ease;">
        <span style="font-size:2.5rem;">🎁</span>
        <h3 style="color:#2e7d32;margin:12px 0 6px;font-size:1.4em;">Redeem Eco Points</h3>
        <p style="color:#888;font-size:13px;margin-bottom:20px;">Your Balance: <strong style="color:#1b5e20;font-size:16px;">${pts} Points</strong></p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:22px;text-align:left;">
          ${items.map(it => redeemItemHTML(it.icon, it.name, it.cost, it.desc, pts)).join('')}
        </div>
        <button onclick="removeModal('redeem-modal')" style="width:100%;padding:12px;background:linear-gradient(135deg,#4caf50,#388e3c);color:white;border:none;border-radius:12px;cursor:pointer;font-weight:600;font-size:14px;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function redeemItemHTML(icon, name, cost, desc, balance) {
  const can = balance >= cost;
  return `<div style="padding:14px 16px;background:${can?'#f1f8e9':'#fafafa'};border:2px solid ${can?'#4caf50':'#e0e0e0'};border-radius:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
    <div>
      <div style="font-size:1.2em;margin-bottom:2px;">${icon} <strong style="color:#333;">${name}</strong></div>
      <div style="font-size:12px;color:#888;">${desc}</div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-weight:700;color:${can?'#2e7d32':'#999'};font-size:13px;margin-bottom:6px;">${cost} pts</div>
      <button onclick="executeRedeem('${name}',${cost})" style="background:${can?'linear-gradient(135deg,#4caf50,#388e3c)':'#ddd'};color:${can?'white':'#999'};border:none;padding:7px 14px;border-radius:20px;cursor:${can?'pointer':'not-allowed'};font-weight:600;font-size:12px;font-family:'Poppins',sans-serif;" ${can?'':'disabled'}>${can?'Redeem':'Need more'}</button>
    </div>
  </div>`;
}

// ── UTILS ─────────────────────────────────────────────────────
function removeModal(id) { document.getElementById(id)?.remove(); }
window.removeModal = removeModal;

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}