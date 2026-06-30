// tictactoe.js — BlinkMeet Tic-Tac-Toe renderer
(function(){
  'use strict';
  window.BM_GAMES = window.BM_GAMES||{};

  var scores_ = {};

  window.BM_GAMES.tictactoe = {
    render: function(container, roomState, ctx){
      var gs = roomState.gameState;
      var me = ctx.username;
      scores_ = {};
      ctx.players.forEach(function(p){ scores_[p.username] = roomState.scores&&roomState.scores[p.username]||0; });
      container.innerHTML='';
      renderTTT(container, gs, ctx);
    },
    update: function(gs, ctx){
      var container = document.getElementById('ttt-container');
      if(!container) return;
      container.innerHTML='';
      renderTTT(container, gs, ctx);
    },
    onEnded: function(d){
      Object.keys(d.scores||{}).forEach(function(k){ scores_[k]=(d.scores[k]||0); });
    },
  };

  function renderTTT(container, gs, ctx){
    var me = ctx.username;
    var myIndex = gs.players.indexOf(me);
    var myMark = myIndex===0?'X':'O';
    var curName = gs.players[gs.currentIndex];
    var isMyTurn = curName===me && !gs.winner && !gs.draw;

    var wrap = document.createElement('div');
    wrap.id='ttt-container';
    wrap.style.cssText='display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;';

    // Scoreboard
    var score = document.createElement('div');
    score.className='ttt-score';
    ctx.players.slice(0,2).forEach(function(p,i){
      var s = document.createElement('div');
      s.className='ttt-score-item';
      var mark = i===0?'X':'O';
      s.innerHTML='<div style="font-size:14px;font-weight:600;color:#ece8e0;">'+esc(p.nickname||p.username)+' ('+mark+')</div>'
        +'<div class="score-num" style="color:'+(i===0?'var(--game-accent)':'var(--game-accent2)')+';">'+(scores_[p.username]||0)+'</div>';
      score.appendChild(s);
    });
    wrap.appendChild(score);

    // Turn
    var curP = ctx.players.find(function(p){return p.username===curName;});
    var tb = document.createElement('div');
    tb.className='turn-banner';
    tb.style.maxWidth='340px';
    if(gs.winner){
      var wp = ctx.players.find(function(p){return p.username===gs.winner;});
      tb.innerHTML='<div class="turn-dot" style="background:var(--game-yellow)"></div><div class="turn-text">🏆 '+(gs.winner===me?'You win!':esc((wp&&wp.nickname)||gs.winner)+' wins!')+'</div>';
    } else if(gs.draw){
      tb.innerHTML='<div class="turn-dot" style="background:var(--game-muted)"></div><div class="turn-text">It\'s a draw!</div>';
    } else {
      tb.innerHTML='<div class="turn-dot"></div><div class="turn-text">'+(isMyTurn?'Your turn ('+myMark+')':esc((curP&&curP.nickname)||curName)+"'s turn")+'</div>';
    }
    wrap.appendChild(tb);

    // Board
    var board = document.createElement('div');
    board.className='ttt-board';
    gs.board.forEach(function(val, i){
      var cell = document.createElement('div');
      cell.className='ttt-cell'+(val?' filled '+val:'');
      cell.textContent=val||'';
      if(!val && isMyTurn){
        cell.addEventListener('click', function(){ ctx.emit('place',{cell:i}); });
      }
      board.appendChild(cell);
    });
    wrap.appendChild(board);
    wrap.appendChild(board);
    container.appendChild(wrap);
  }

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
