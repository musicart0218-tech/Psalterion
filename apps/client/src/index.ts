import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { UIOverlayScene } from './scenes/UIOverlayScene';

// Element Selectors
const authGateway = document.getElementById('auth-gateway');
const gameContainer = document.getElementById('game-container');
const goRegister = document.getElementById('go-register');
const goLogin = document.getElementById('go-login');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Form Actions
goRegister?.addEventListener('click', (e) => {
  e.preventDefault();
  if (loginForm && registerForm) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  }
});

goLogin?.addEventListener('click', (e) => {
  e.preventDefault();
  if (loginForm && registerForm) {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
});

// Dynamically target the correct server origin
const apiOrigin = window.location.origin.includes('3002')
  ? window.location.origin.replace('3002', '3000')
  : window.location.origin;

// Submit Hooks
document.getElementById('btn-register')?.addEventListener('click', async () => {
  const username = (document.getElementById('reg-user') as HTMLInputElement).value;
  const email = (document.getElementById('reg-email') as HTMLInputElement).value;
  const password = (document.getElementById('reg-pass') as HTMLInputElement).value;
  const characterName = (document.getElementById('reg-char') as HTMLInputElement).value;
  const className = (document.getElementById('reg-class') as HTMLSelectElement).value;

  if (!username || !email || !password || !characterName || !className) {
    alert('Please fill out all fields.');
    return;
  }

  try {
    const res = await fetch(`${apiOrigin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, characterName, className })
    });
    
    const data = await res.json();
    if (res.ok) {
      alert('Character Created! Logging in now...');
      location.reload();
    } else {
      alert(`Error: ${data.error || 'Registration failed'}`);
    }
  } catch (err: any) {
    console.error('Registration error:', err);
    alert(`Could not connect to registration service: ${err.message || err}`);
  }
});

document.getElementById('btn-login')?.addEventListener('click', async () => {
  const username = (document.getElementById('login-user') as HTMLInputElement).value;
  const password = (document.getElementById('login-pass') as HTMLInputElement).value;

  if (!username || !password) {
    alert('Please enter both username and password.');
    return;
  }

  try {
    const res = await fetch(`${apiOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok) {
      // Hide UI forms, open game canvas viewport
      if (authGateway) authGateway.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'block';

      // Store runtime credentials securely
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('characterId', data.user.character.id);

      // Boot up game matrix engine
      initializeGame();
    } else {
      alert(`Authentication Failed: ${data.error || 'Invalid credentials'}`);
    }
  } catch (err: any) {
    console.error('Login error:', err);
    alert(`Could not connect to authentication service: ${err.message || err}`);
  }
});

function initializeGame() {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#111216',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    scene: [BootScene, WorldScene, UIOverlayScene]
  };

  new Phaser.Game(config);
}

