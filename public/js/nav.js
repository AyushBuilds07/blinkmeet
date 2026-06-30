// nav.js — mobile hamburger drawer toggle.
// Shared across home/history/contacts/settings pages (anywhere with a sidebar).
// room.html doesn't include this — it has no sidebar.
(function () {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  if (!hamburgerBtn || !sidebar || !backdrop) return;

  function openDrawer() {
    sidebar.classList.add('open');
    backdrop.classList.add('show');
    hamburgerBtn.style.visibility = 'hidden';
  }

  function closeDrawer() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    hamburgerBtn.style.visibility = 'visible';
  }

  hamburgerBtn.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  // tapping any nav item (which navigates to a new page) should close the
  // drawer first so it doesn't flash open on the next page before unload
  sidebar.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', closeDrawer);
  });
})();
