// nhie.js — BlinkMeet Never Have I Ever renderer
(function(){
  'use strict';
  window.BM_GAMES = window.BM_GAMES||{};

  window.BM_GAMES.nhie = {
    render: function(container, roomState, ctx){
      renderNHIE(container, roomState.gameState, ctx);
    },
    update: function(gs, ctx){
      var c = document.getElementById('nhie-container');
      if(c){ c.innerHTML=''; renderNHIE(c, gs, ctx); }
    },
    onEnded: function(){},
  };

  function renderNHIE(container, gs, ctx){
    var me = ctx.username;
    var isHost = ctx.isHost;
    var myVote = gs.votes && gs.votes[me];

    var wrap = document.createElement('div');
    wrap.id = 'nhie-container';
    wrap.className = 'nhie-area';

    // Round counter
    var rc = document.createElement('div');
    rc.className = 'nhie-round-counter';
    rc.textContent = 'Round ' + (gs.round||0) + ' / ' + (gs.totalRounds||10);
    wrap.appendChild(rc);

    // Players row
    var pr = document.createElement('div');
    pr.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;';
    ctx.players.forEach(function(p){
      var voted = gs.votes && gs.votes[p.username] !== undefined;
      var chip = document.createElement('div');
      chip.style.cssText = 'padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;'
        + 'background:' + (voted ? (p.color||'var(--game-accent)') : 'var(--game-raised)') + ';'
        + 'color:' + (voted ? '#fff' : 'var(--game-muted)') + ';'
        + 'border:1px solid ' + (voted ? (p.color||'var(--game-accent)') : 'var(--game-line)') + ';';
      chip.textContent = (voted ? '✓ ' : '') + esc(p.nickname||p.username);
      pr.appendChild(chip);
    });
    wrap.appendChild(pr);

    if(gs.phase === 'voting' && gs.currentPrompt){
      // Prompt
      var promptBox = document.createElement('div');
      promptBox.className = 'nhie-prompt-box';
      promptBox.textContent = gs.currentPrompt;
      wrap.appendChild(promptBox);

      // Vote buttons
      if(!myVote){
        var vr = document.createElement('div');
        vr.className = 'nhie-vote-row';
        var haveBtn = document.createElement('button');
        haveBtn.className = 'nhie-vote-btn have';
        haveBtn.textContent = '🙋 I Have!';
        haveBtn.addEventListener('click', function(){ ctx.emit('vote', {vote:'have'}); haveBtn.disabled = true; noBtn.disabled = true; });
        var noBtn = document.createElement('button');
        noBtn.className = 'nhie-vote-btn havenot';
        noBtn.textContent = '🙅 Never!';
        noBtn.addEventListener('click', function(){ ctx.emit('vote', {vote:'havenot'}); haveBtn.disabled = true; noBtn.disabled = true; });
        vr.appendChild(haveBtn);
        vr.appendChild(noBtn);
        wrap.appendChild(vr);
      } else {
        var waiting = document.createElement('div');
        waiting.style.cssText = 'font-size:13px;color:var(--game-muted);margin:12px 0;font-family:var(--font-mono);';
        var votedCount = Object.keys(gs.votes||{}).length;
        waiting.textContent = 'You voted! Waiting for others… (' + votedCount + '/' + ctx.players.length + ')';
        wrap.appendChild(waiting);
      }
    }

    if(gs.phase === 'results' && gs.results){
      // Show prompt
      var p2 = document.createElement('div');
      p2.className = 'nhie-prompt-box';
      p2.style.fontSize = '16px';
      p2.textContent = gs.currentPrompt||'—';
      wrap.appendChild(p2);

      // Results
      var res = document.createElement('div');
      res.className = 'nhie-results';

      var haveBox = document.createElement('div');
      haveBox.className = 'nhie-res-box';
      haveBox.style.borderTop = '2px solid var(--game-green)';
      haveBox.innerHTML = '<div class="nhie-res-label">🙋 I HAVE (' + gs.results.have.length + ')</div>'
        + '<div class="nhie-res-names">' + (gs.results.have.length ? gs.results.have.map(function(u){
          var p = ctx.players.find(function(pl){return pl.username===u;});
          return esc(p&&p.nickname||u);
        }).join(', ') : '—') + '</div>';

      var noBox = document.createElement('div');
      noBox.className = 'nhie-res-box';
      noBox.style.borderTop = '2px solid var(--game-accent)';
      noBox.innerHTML = '<div class="nhie-res-label">🙅 NEVER (' + gs.results.havenot.length + ')</div>'
        + '<div class="nhie-res-names">' + (gs.results.havenot.length ? gs.results.havenot.map(function(u){
          var p = ctx.players.find(function(pl){return pl.username===u;});
          return esc(p&&p.nickname||u);
        }).join(', ') : '—') + '</div>';

      res.appendChild(haveBox);
      res.appendChild(noBox);
      wrap.appendChild(res);

      // Next prompt btn
      var nextBtn = document.createElement('button');
      nextBtn.className = 'nhie-next-btn';
      nextBtn.textContent = gs.round >= gs.totalRounds ? '🏁 Finish' : '➡ Next Prompt';
      nextBtn.addEventListener('click', function(){ ctx.emit('next-prompt', {}); });
      wrap.appendChild(nextBtn);
    }

    if(gs.phase === 'prompt'){
      // First round — show start button
      var startPrompt = document.createElement('div');
      startPrompt.style.cssText = 'text-align:center;margin:32px 0;';
      startPrompt.innerHTML = '<p style="font-family:var(--game-font);font-size:20px;color:#ece8e0;margin:0 0 16px;">Ready to play Never Have I Ever?</p>';
      var startBtn2 = document.createElement('button');
      startBtn2.className = 'nhie-next-btn';
      startBtn2.textContent = '🎉 Start!';
      startBtn2.addEventListener('click', function(){ ctx.emit('next-prompt', {}); });
      startPrompt.appendChild(startBtn2);
      wrap.appendChild(startPrompt);
    }

    container.appendChild(wrap);
  }

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
