// tod.js — BlinkMeet Truth or Dare renderer
(function(){
  'use strict';
  window.BM_GAMES = window.BM_GAMES||{};

  window.BM_GAMES.tod = {
    render: function(container, roomState, ctx){
      renderTOD(container, roomState.gameState, ctx);
    },
    update: function(gs, ctx){
      var c = document.getElementById('tod-container');
      if(c){ c.innerHTML=''; renderTOD(c, gs, ctx); }
    },
    onEnded: function(){},
  };

  function renderTOD(container, gs, ctx){
    var me = ctx.username;
    var curName = gs.players[gs.currentIndex];
    var curPlayer = ctx.players.find(function(p){return p.username===curName;});
    var isMyTurn = curName === me;

    var wrap = document.createElement('div');
    wrap.id='tod-container';
    wrap.className='tod-area';

    // Turn indicator
    var ti = document.createElement('div');
    ti.className='tod-current-player';
    ti.textContent = isMyTurn ? "It's your turn!" : ("It's "+esc(curPlayer&&curPlayer.nickname||curName)+"'s turn");
    wrap.appendChild(ti);

    // Players row
    var pr = document.createElement('div');
    pr.style.cssText='display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px;';
    ctx.players.forEach(function(p,i){
      var chip = document.createElement('div');
      var active = p.username===curName;
      chip.style.cssText='padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;background:'+(active?p.color||'var(--game-accent)':'var(--game-raised)')+';color:'+(active?'#fff':'var(--game-muted)')+';border:1px solid '+(active?p.color||'var(--game-accent)':'var(--game-line)')+';';
      chip.textContent=(active?'→ ':'')+esc(p.nickname||p.username);
      pr.appendChild(chip);
    });
    wrap.appendChild(pr);

    if(gs.phase==='prompt' && gs.currentPrompt){
      // Prompt display
      var badge = document.createElement('div');
      badge.className='tod-type-badge '+(gs.promptType||'truth');
      badge.textContent=(gs.promptType||'truth').toUpperCase();
      wrap.appendChild(badge);

      var promptBox = document.createElement('div');
      promptBox.className='tod-prompt-box';
      promptBox.textContent=gs.currentPrompt;
      wrap.appendChild(promptBox);

      // Next button
      var nextBtn = document.createElement('button');
      nextBtn.className='tod-next-btn';
      nextBtn.textContent='Next Player →';
      nextBtn.addEventListener('click',function(){ ctx.emit('next'); });
      wrap.appendChild(nextBtn);
    } else if(gs.phase==='choosing'){
      // Choice buttons (only for current player)
      var pb = document.createElement('div');
      pb.className='tod-prompt-box';
      pb.style.background='transparent';
      pb.style.border='none';
      pb.textContent=isMyTurn?'Choose your challenge:':'Waiting for '+esc(curPlayer&&curPlayer.nickname||curName)+'…';
      wrap.appendChild(pb);

      if(isMyTurn){
        var choiceRow = document.createElement('div');
        choiceRow.className='tod-choice-row';
        var truthBtn = document.createElement('button');
        truthBtn.className='tod-choice-btn truth'; truthBtn.textContent='🧠 Truth';
        truthBtn.addEventListener('click',function(){ ctx.emit('choose',{type:'truth'}); });
        var dareBtn = document.createElement('button');
        dareBtn.className='tod-choice-btn dare'; dareBtn.textContent='🔥 Dare';
        dareBtn.addEventListener('click',function(){ ctx.emit('choose',{type:'dare'}); });
        choiceRow.appendChild(truthBtn); choiceRow.appendChild(dareBtn);
        wrap.appendChild(choiceRow);
      }
    }

    container.appendChild(wrap);
  }

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
