(function () {
  var GA_ID = 'G-GPSF5ZNZMF';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 — refusé par défaut jusqu'au choix de l'utilisateur
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    wait_for_update: 500
  });

  // Si l'utilisateur a déjà accepté lors d'une visite précédente
  if (localStorage.getItem('cfm_cookie_consent') === 'accepted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }

  gtag('js', new Date());
  gtag('config', GA_ID);

  // Chargement du script GA4
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  // Mise à jour du consentement quand l'utilisateur accepte via la bannière
  document.addEventListener('cfm:consent', function (e) {
    if (e.detail && e.detail.accepted) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
    }
  });
})();
