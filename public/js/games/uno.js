// uno.js — BlinkMeet UNO renderer
(function(){
  'use strict';
  window.BM_GAMES = window.BM_GAMES||{};

  var CARD_SYMBOLS = { skip:'⊘', reverse:'↺', draw2:'+2', wild:'★', wild4:'+4★' };

  function cardLabel(c){ return c.type==='number'?c.value:(CARD_SYMBOLS[c.type]||c.type); }

  function buildCard(card, onClick, playable, isBack){
    var div = document.createElement('div');
    div.className = 'uno-card '+(isBack?'back':card.color)+(playable?' playable':'');
    div.textContent = isBack?'UNO': cardLabel(card);
    div.title = isBack?'Draw pile':(card.color+' '+cardLabel(card));
    if(onClick) div.addEventListener('click', onClick);
    return div;
  }

  var pendingCardId_ = null;

  window.BM_GAMES.uno = {
    render: function(container, roomState, ctx){
      var gs = roomState.gameState;
      var me = ctx.username;
      container.innerHTML='';

      var wrap = document.createElement('div');
      wrap.id='uno-wrap';
      wrap.className='uno-area';

      // Current turn
      var curName = gs.players[gs.currentIndex];
      var curPlayer = ctx.players.find(function(p){return p.username===curName;});
      var turn = document.createElement('div');
      turn.id='uno-turn';
      turn.className='turn-banner';
      turn.style.maxWidth='500px';
      turn.innerHTML='<div class="turn-dot"></div><div class="turn-text">'+(curName===me?'Your turn!':(esc(curPlayer&&curPlayer.nickname||curName)+"'s turn"))+'</div>';
      wrap.appendChild(turn);

      // Direction
      var dir = document.createElement('div');
      dir.style.cssText='font-size:12px;color:var(--game-muted);text-align:center;margin-bottom:6px;';
      dir.textContent='Direction: '+(gs.direction===1?'Clockwise ↻':'Counter-clockwise ↺')+(gs.pendingDraw?'  Draw pile: +'+gs.pendingDraw:'');
      wrap.appendChild(dir);

      // Opponents' hand sizes (top)
      var opponents = gs.players.filter(function(p){return p!==me;});
      var oppRow = document.createElement('div');
      oppRow.className='uno-top-hand';
      opponents.forEach(function(p){
        var op = ctx.players.find(function(pl){return pl.username===p;});
        var cnt = gs.hands[p]?gs.hands[p].length:0;
        var chip = document.createElement('div');
        chip.style.cssText='display:flex;flex-direction:column;align-items:center;gap:4px;';
        chip.innerHTML='<div style="font-size:12px;font-weight:600;color:#ece8e0;">'+esc(op&&op.nickname||p)+'</div>'
          +'<div style="display:flex;gap:2px;">'+Array(Math.min(cnt,10)).fill('<div style="width:16px;height:24px;background:#1e2060;border-radius:3px;border:1px solid #3030a0;"></div>').join('')+'</div>'
          +'<div style="font-size:11px;color:var(--game-muted);">'+cnt+' cards</div>';
        oppRow.appendChild(chip);
      });
      wrap.appendChild(oppRow);

      // Discard + draw pile
      var tableArea = document.createElement('div');
      tableArea.className='uno-discard-area';

      // Draw pile
      var drawPile = buildCard(null, function(){
        if(curName===me) ctx.emit('draw-card');
      }, false, true);
      drawPile.className='draw-pile-btn';
      drawPile.textContent='DRAW';
      tableArea.appendChild(drawPile);

      // Top card
      var topCard = buildCard(gs.topCard, null, false, false);
      topCard.style.transform='none';
      topCard.style.cursor='default';
      topCard.style.width='70px';
      topCard.style.height='105px';
      topCard.style.fontSize='22px';
      if(gs.wildColor && gs.topCard.color==='wild'){
        topCard.className='uno-card '+gs.wildColor;
      }
      tableArea.appendChild(topCard);

      // Wild color indicator
      if(gs.wildColor){
        var wc = document.createElement('div');
        wc.style.cssText='font-size:12px;color:var(--game-muted);position:absolute;right:0;top:-20px;font-family:var(--font-mono);';
        wc.textContent='Active: '+gs.wildColor;
        topCard.style.position='relative';
        topCard.appendChild(wc);
      }

      wrap.appendChild(tableArea);

      // My hand
      var myHand = gs.hands[me]||[];
      var handRow = document.createElement('div');
      handRow.id='uno-my-hand';
      handRow.className='uno-my-hand';

      myHand.forEach(function(card){
        var isPlayable = curName===me && isCardPlayable(card, gs);
        var c = buildCard(card, isPlayable ? function(){
          if(card.color==='wild'){
            pendingCardId_=card.id;
            window.BM_COLOR_PICK && window.BM_COLOR_PICK(function(color){
              ctx.emit('play-card',{cardId:card.id, chosenColor:color});
              pendingCardId_=null;
            });
          } else {
            ctx.emit('play-card',{cardId:card.id});
          }
        } : null, isPlayable, false);
        handRow.appendChild(c);
      });
      wrap.appendChild(handRow);

      container.appendChild(wrap);
    },

    update: function(gs, ctx){
      var me = ctx.username;
      var curName = gs.players[gs.currentIndex];

      // Update turn banner
      var tb = document.getElementById('uno-turn');
      var curPlayer = ctx.players.find(function(p){return p.username===curName;});
      if(tb) tb.innerHTML='<div class="turn-dot"></div><div class="turn-text">'+(curName===me?'Your turn!':(esc(curPlayer&&curPlayer.nickname||curName)+"'s turn"))+'</div>';

      // Re-render hand
      var hand = document.getElementById('uno-my-hand');
      if(!hand) return;
      hand.innerHTML='';
      var myHand = gs.hands[me]||[];
      myHand.forEach(function(card){
        var isPlayable = curName===me && isCardPlayable(card, gs);
        var c = buildCard(card, isPlayable ? function(){
          if(card.color==='wild'){
            window.BM_COLOR_PICK && window.BM_COLOR_PICK(function(color){
              ctx.emit('play-card',{cardId:card.id,chosenColor:color});
            });
          } else {
            ctx.emit('play-card',{cardId:card.id});
          }
        } : null, isPlayable, false);
        hand.appendChild(c);
      });
    },
    onEnded: function(){},
  };

  function isCardPlayable(card, gs){
    if(gs.pendingDraw>0) return card.type==='draw2'||card.type==='wild4';
    if(card.color==='wild') return true;
    var activeColor = gs.wildColor||gs.topCard.color;
    return card.color===activeColor||card.value===gs.topCard.value;
  }

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
