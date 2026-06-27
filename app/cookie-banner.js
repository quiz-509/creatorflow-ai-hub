(function () {
  var KEY = 'cfm_cookie_consent';
  var stored = localStorage.getItem(KEY);
  window.cfmConsent = stored === 'accepted';

  if (stored) return;

  var style = document.createElement('style');
  style.textContent = [
    '#cfm-cookie{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;',
    'width:calc(100% - 32px);max-width:640px;background:#0C0C18;border:1px solid rgba(255,255,255,0.10);',
    'border-radius:16px;padding:20px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;',
    'box-shadow:0 8px 40px rgba(0,0,0,0.6);font-family:Inter,system-ui,sans-serif;font-size:14px;color:#A0A0C2;',
    'animation:cfm-slide-in 0.3s cubic-bezier(0.16,1,0.3,1);}',
    '@keyframes cfm-slide-in{from{opacity:0;transform:translateX(-50%) translateY(16px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}',
    '#cfm-cookie p{margin:0;flex:1;min-width:200px;line-height:1.5;}',
    '#cfm-cookie a{color:#A78BFA;text-decoration:underline;}',
    '#cfm-cookie .cfm-btns{display:flex;gap:8px;flex-shrink:0;}',
    '#cfm-cookie .cfm-accept{background:linear-gradient(135deg,#9333EA,#7C3AED);color:#fff;border:none;',
    'padding:9px 20px;border-radius:999px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}',
    '#cfm-cookie .cfm-accept:hover{opacity:0.88;}',
    '#cfm-cookie .cfm-decline{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);',
    'color:#A0A0C2;padding:9px 16px;border-radius:999px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;}',
    '#cfm-cookie .cfm-decline:hover{background:rgba(255,255,255,0.09);}'
  ].join('');
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.id = 'cfm-cookie';
  banner.innerHTML = [
    '<p>Nous utilisons des cookies pour améliorer votre expérience et analyser notre trafic.',
    'Consultez notre <a href="/politique-confidentialite.html">politique de confidentialité</a>.</p>',
    '<div class="cfm-btns">',
    '<button class="cfm-decline">Refuser</button>',
    '<button class="cfm-accept">Accepter</button>',
    '</div>'
  ].join('');

  function dismiss(accepted) {
    localStorage.setItem(KEY, accepted ? 'accepted' : 'declined');
    window.cfmConsent = accepted;
    banner.style.animation = 'cfm-slide-in 0.2s cubic-bezier(0.16,1,0.3,1) reverse forwards';
    setTimeout(function () { banner.remove(); }, 220);
    document.dispatchEvent(new CustomEvent('cfm:consent', { detail: { accepted: accepted } }));
  }

  banner.querySelector('.cfm-accept').addEventListener('click', function () { dismiss(true); });
  banner.querySelector('.cfm-decline').addEventListener('click', function () { dismiss(false); });

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(banner);
  });
})();
