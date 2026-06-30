// auth.js — fixed
(function(){
  var token = localStorage.getItem('lc_token');
  if(token){ location.href='/home.html'; return; }

  var mode         = 'login';
  var formTitle    = document.getElementById('formTitle');
  var formSubtitle = document.getElementById('formSubtitle');
  var nicknameField= document.getElementById('nicknameField');
  var nicknameEl   = document.getElementById('nickname');
  var usernameEl   = document.getElementById('username');
  var passwordEl   = document.getElementById('password');
  var submitBtn    = document.getElementById('submitBtn');
  var errorMsg     = document.getElementById('errorMsg');
  var switchText   = document.getElementById('switchText');
  var switchMode   = document.getElementById('switchMode');

  // Toggle login/register
  switchMode.addEventListener('click', function(e){
    e.preventDefault();
    errorMsg.classList.remove('show');
    if(mode === 'login'){
      mode = 'register';
      formTitle.textContent    = 'Create account';
      formSubtitle.textContent = 'Join BlinkMeet and start connecting.';
      submitBtn.textContent    = 'Create account';
      switchText.textContent   = 'Already have an account?';
      switchMode.textContent   = 'Sign in';
      if(nicknameField) nicknameField.style.display = '';
      passwordEl.setAttribute('autocomplete','new-password');
    } else {
      mode = 'login';
      formTitle.textContent    = 'Welcome back';
      formSubtitle.textContent = 'Sign in to your account to continue.';
      submitBtn.textContent    = 'Sign in';
      switchText.textContent   = "Don't have an account?";
      switchMode.textContent   = 'Create one';
      if(nicknameField) nicknameField.style.display = 'none';
      passwordEl.setAttribute('autocomplete','current-password');
    }
  });

  // Submit handler — attached to the button directly
  async function handleSubmit(){
    errorMsg.classList.remove('show');
    var username = usernameEl.value.trim();
    var password = passwordEl.value;
    var nickname = (nicknameEl && nicknameEl.value.trim()) || '';

    if(!username){ showError('Please enter a username.'); return; }
    if(!password){ showError('Please enter a password.'); return; }
    if(mode === 'register' && username.length < 3){ showError('Username must be at least 3 characters.'); return; }
    if(mode === 'register' && password.length < 4){ showError('Password must be at least 4 characters.'); return; }

    submitBtn.disabled   = true;
    submitBtn.textContent = mode === 'login' ? 'Signing in…' : 'Creating…';

    try {
      var endpoint = '/api/' + (mode === 'login' ? 'login' : 'register');
      var body     = mode === 'login' ? { username: username, password: password } : { username: username, password: password, nickname: nickname };
      var res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      var data = await res.json();

      if(!res.ok){ showError(data.error || 'Something went wrong.'); return; }

      localStorage.setItem('lc_token',    data.token);
      localStorage.setItem('lc_username', data.username);
      localStorage.setItem('lc_nickname', data.nickname || data.username);
      if(data.avatar) localStorage.setItem('lc_avatar', data.avatar);
      location.href = '/home.html';
    } catch(err){
      showError('Could not reach the server. Is it running?');
    } finally {
      submitBtn.disabled   = false;
      submitBtn.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    }
  }

  // Button click
  submitBtn.addEventListener('click', handleSubmit);

  // Also allow Enter key in password field
  passwordEl.addEventListener('keydown', function(e){ if(e.key === 'Enter') handleSubmit(); });
  usernameEl.addEventListener('keydown', function(e){ if(e.key === 'Enter') handleSubmit(); });

  function showError(msg){
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
  }
})();
