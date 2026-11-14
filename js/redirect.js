// js/redirect.js
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const targetLink = localStorage.getItem('link4m_target');

if (token && targetLink) {
  localStorage.setItem('bypass_token', token);
  setTimeout(() => {
    window.location.href = targetLink;
  }, 1000);
} else {
  window.location.href = 'index.html';
}
