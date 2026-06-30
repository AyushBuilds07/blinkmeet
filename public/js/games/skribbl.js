// skribbl.js — BlinkMeet Draw & Guess renderer
(function(){
  'use strict';
  window.BM_GAMES = window.BM_GAMES||{};

  var canvas_, ctx2d_, drawing_ = false, lastX_=0, lastY_=0;
  var brushColor_='#e8463a', brushSize_=4;
  var emit_, isDrawer_;
  var timerInterval_ = null;

  var COLORS=['#e8463a','#4c9fe8','#5fd99a','#f0c048','#c86de8','#ffffff','#000000','#f07850'];

  function initCanvas(canvas, canDraw){
    canvas_=canvas;
    ctx2d_=canvas.getContext('2d');
    ctx2d_.lineCap='round';
    ctx2d_.lineJoin='round';
    if(!canDraw) return;

    function getPos(e){
      var r=canvas.getBoundingClientRect();
      var src=e.touches?e.touches[0]:e;
      return{x:(src.clientX-r.left)*(canvas.width/r.width),y:(src.clientY-r.top)*(canvas.height/r.height)};
    }
    function start(e){ e.preventDefault(); drawing_=true; var p=getPos(e); lastX_=p.x; lastY_=p.y; }
    function move(e){ e.preventDefault(); if(!drawing_)return; var p=getPos(e); drawLine(lastX_,lastY_,p.x,p.y,brushColor_,brushSize_); emit_('draw',{x0:lastX_/canvas.width,y0:lastY_/canvas.height,x1:p.x/canvas.width,y1:p.y/canvas.height,color:brushColor_,size:brushSize_}); lastX_=p.x; lastY_=p.y; }
    function end(){ drawing_=false; }
    canvas.addEventListener('mousedown',start);
    canvas.addEventListener('mousemove',move);
    canvas.addEventListener('mouseup',end);
    canvas.addEventListener('mouseleave',end);
    canvas.addEventListener('touchstart',start,{passive:false});
    canvas.addEventListener('touchmove',move,{passive:false});
    canvas.addEventListener('touchend',end);
  }

  function drawLine(x0,y0,x1,y1,color,size){
    if(!ctx2d_)return;
    ctx2d_.strokeStyle=color;
    ctx2d_.lineWidth=size;
    ctx2d_.beginPath();
    ctx2d_.moveTo(x0,y0);
    ctx2d_.lineTo(x1,y1);
    ctx2d_.stroke();
  }

  function replayDrawData(drawData){
    if(!ctx2d_||!canvas_) return;
    ctx2d_.clearRect(0,0,canvas_.width,canvas_.height);
    ctx2d_.fillStyle='#fff';
    ctx2d_.fillRect(0,0,canvas_.width,canvas_.height);
    (drawData||[]).forEach(function(d){
      drawLine(d.x0*canvas_.width,d.y0*canvas_.height,d.x1*canvas_.width,d.y1*canvas_.height,d.color||'#000',d.size||4);
    });
  }

  function buildWordMask(word){
    return word.split('').map(function(c){return c===' '?' ':'_';}).join(' ');
  }

  function startLocalTimer(seconds){
    clearInterval(timerInterval_);
    var left=seconds;
    var el=document.getElementById('skribbl-timer-val');
    if(el) el.textContent=left+'s';
    timerInterval_=setInterval(function(){
      left--;
      var el=document.getElementById('skribbl-timer-val');
      if(el){ el.textContent=left+'s'; if(left<=10) el.style.color='var(--game-red)'; else el.style.color='var(--game-yellow)'; }
      if(left<=0) clearInterval(timerInterval_);
    },1000);
  }

  window.BM_GAMES.skribbl = {
    render: function(container, roomState, ctx){
      var gs = roomState.gameState;
      emit_ = ctx.emit;
      var me = ctx.username;
      var drawer = gs.players[gs.currentDrawerIndex];
      isDrawer_ = drawer===me;

      container.innerHTML='';
      clearInterval(timerInterval_);

      var wrap = document.createElement('div');
      wrap.className='skribbl-layout';

      // Header: round + scores
      var header = document.createElement('div');
      header.style.cssText='display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';
      header.innerHTML='<div style="font-family:var(--game-font);font-size:16px;font-weight:700;color:#ece8e0;">Round '+gs.round+'/'+gs.totalRounds+'</div>';
      var scoresHtml = ctx.players.map(function(p){ return '<span style="font-size:13px;color:#ece8e0;">'+esc(p.nickname||p.username)+': <b style="color:var(--game-yellow)">'+(gs.scores&&gs.scores[p.username]||0)+'</b></span>'; }).join(' &nbsp; ');
      header.innerHTML+='<div>'+scoresHtml+'</div>';
      wrap.appendChild(header);

      // Timer + word display
      var topBar = document.createElement('div');
      topBar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;';
      var timerEl = document.createElement('div');
      timerEl.className='skribbl-timer';
      timerEl.innerHTML='<span id="skribbl-timer-val" style="color:var(--game-yellow);">'+(gs.timeLeft||80)+'s</span>';
      var wordEl = document.createElement('div');
      wordEl.className='skribbl-word-display';
      wordEl.id='skribbl-word-display';
      if(gs.phase==='drawing'){
        wordEl.textContent = isDrawer_ ? gs.currentWord : buildWordMask(gs.currentWord||'');
      } else if(gs.phase==='choosing'){
        wordEl.textContent = isDrawer_ ? 'Choose a word!' : (esc(ctx.players.find(function(p){return p.username===drawer;})||{nickname:drawer}).nickname||drawer)+' is choosing…';
      } else {
        wordEl.textContent = 'Word was: '+(gs.currentWord||'—');
      }
      topBar.appendChild(timerEl);
      topBar.appendChild(wordEl);
      wrap.appendChild(topBar);

      // Canvas
      var canvasWrap = document.createElement('div');
      canvasWrap.className='skribbl-canvas-wrap';
      var canvas = document.createElement('canvas');
      canvas.width=800; canvas.height=600;
      canvasWrap.appendChild(canvas);
      wrap.appendChild(canvasWrap);

      // Word choosing phase (drawer picks)
      if(gs.phase==='choosing' && isDrawer_){
        var overlay = document.createElement('div');
        overlay.style.cssText='position:absolute;inset:0;background:rgba(10,11,15,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;border-radius:12px;z-index:10;';
        overlay.innerHTML='<p style="font-family:var(--game-font);font-size:20px;color:#ece8e0;margin:0;">Pick a word to draw:</p>';
        var optRow = document.createElement('div');
        optRow.style.cssText='display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';
        (gs.wordOptions||[]).forEach(function(w){
          var btn = document.createElement('button');
          btn.className='word-option-btn';
          btn.textContent=w;
          btn.addEventListener('click',function(){ emit_('choose-word',{word:w}); overlay.remove(); });
          optRow.appendChild(btn);
        });
        overlay.appendChild(optRow);
        canvasWrap.style.position='relative';
        canvasWrap.appendChild(overlay);
      }

      // Drawing tools (drawer only)
      if(isDrawer_ && gs.phase==='drawing'){
        var tools = document.createElement('div');
        tools.className='skribbl-tools';
        COLORS.forEach(function(c){
          var sw = document.createElement('div');
          sw.className='tool-color'+(c===brushColor_?' active':'');
          sw.style.background=c;
          sw.style.border='2px solid rgba(255,255,255,0.2)';
          sw.addEventListener('click',function(){
            brushColor_=c;
            document.querySelectorAll('.tool-color').forEach(function(el){el.classList.remove('active');});
            sw.classList.add('active');
          });
          tools.appendChild(sw);
        });
        var sizes=[3,6,12];
        var szRow = document.createElement('div');
        szRow.className='tool-size';
        sizes.forEach(function(sz){
          var btn=document.createElement('button');
          btn.className='sz-btn';
          btn.style.cssText='width:'+sz*2+'px;height:'+sz*2+'px;border-radius:50%;';
          btn.addEventListener('click',function(){brushSize_=sz;});
          szRow.appendChild(btn);
        });
        tools.appendChild(szRow);
        var clrBtn=document.createElement('button');
        clrBtn.className='clear-btn';
        clrBtn.textContent='Clear';
        clrBtn.addEventListener('click',function(){
          ctx2d_.clearRect(0,0,canvas.width,canvas.height);
          ctx2d_.fillStyle='#fff';
          ctx2d_.fillRect(0,0,canvas.width,canvas.height);
          emit_('clear-canvas',{});
        });
        tools.appendChild(clrBtn);
        wrap.appendChild(tools);
      }

      // Guess form (non-drawer)
      if(!isDrawer_ && gs.phase==='drawing'){
        var gf = document.createElement('form');
        gf.className='skribbl-guess-form';
        var gi = document.createElement('input');
        gi.type='text'; gi.placeholder='Type your guess…'; gi.autocomplete='off';
        var gb = document.createElement('button');
        gb.type='submit'; gb.textContent='Guess!';
        gf.appendChild(gi); gf.appendChild(gb);
        gf.addEventListener('submit',function(e){ e.preventDefault(); var g=gi.value.trim(); if(!g)return; emit_('guess',{guess:g}); gi.value=''; });
        wrap.appendChild(gf);
      }

      container.appendChild(wrap);

      // Init canvas
      initCanvas(canvas, isDrawer_ && gs.phase==='drawing');
      // Replay existing draw data
      if(gs.drawData && gs.drawData.length){
        ctx2d_.fillStyle='#fff'; ctx2d_.fillRect(0,0,canvas.width,canvas.height);
        replayDrawData(gs.drawData);
      } else {
        ctx2d_.fillStyle='#fff'; ctx2d_.fillRect(0,0,canvas.width,canvas.height);
      }

      if(gs.phase==='drawing') startLocalTimer(gs.timeLeft||80);
    },

    update: function(gs, ctx){
      var me = ctx.username;
      var drawer = gs.players[gs.currentDrawerIndex];
      isDrawer_ = drawer===me;
      // Update word display
      var wd = document.getElementById('skribbl-word-display');
      if(wd){
        if(gs.phase==='drawing') wd.textContent=isDrawer_?gs.currentWord:buildWordMask(gs.currentWord||'');
        else if(gs.phase==='revealed') wd.textContent='Word was: '+(gs.currentWord||'—');
      }
      // Replay draw data
      if(gs.drawData) replayDrawData(gs.drawData);
      if(gs.phase==='drawing' && gs.timeLeft) startLocalTimer(gs.timeLeft);
    },
    onEnded: function(){},
  };

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
