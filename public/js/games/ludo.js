// ludo.js — BlinkMeet Ludo renderer
(function () {
  'use strict';
  window.BM_GAMES = window.BM_GAMES || {};

  var COLORS = { red:'#c83030', blue:'#2060c8', green:'#28a048', yellow:'#c8a030' };
  var TOKEN_ICONS = { red:'🔴', blue:'🔵', green:'🟢', yellow:'🟡' };
  var ctx_, emit_, username_, state_, players_;

  // Board layout: 52 main squares + home columns
  // We render a simple SVG board
  function renderBoard(gs) {
    return buildBoardSVG(gs);
  }

  function buildBoardSVG(gs) {
    var W = 480;
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 ' + W + ' ' + W);
    svg.setAttribute('width',W);
    svg.setAttribute('height',W);
    svg.style.maxWidth = '100%';

    // Background
    rect(svg, 0, 0, W, W, '#1a1c24', 16);

    var CELL = W / 15;

    // Color zones (6x6 corners)
    var zones = [
      { color:'#c83030', x:0,    y:0    }, // red TL
      { color:'#2060c8', x:9,    y:0    }, // blue TR
      { color:'#28a048', x:0,    y:9    }, // green BL
      { color:'#c8a030', x:9,    y:9    }, // yellow BR
    ];
    zones.forEach(function (z) {
      rect(svg, z.x*CELL, z.y*CELL, 6*CELL, 6*CELL, z.color+'33', 10);
      // Inner base (4 token spots)
      rect(svg, (z.x+1)*CELL, (z.y+1)*CELL, 4*CELL, 4*CELL, z.color+'55', 8);
      // 4 token circles in base
      [[.5,.5],[2.5,.5],[.5,2.5],[2.5,2.5]].forEach(function (off) {
        circle(svg, (z.x+1+off[0])*CELL, (z.y+1+off[1])*CELL, CELL*.38, z.color+'99');
      });
    });

    // Center home
    rect(svg, 6*CELL, 6*CELL, 3*CELL, 3*CELL, '#22253a', 8);
    // home triangles
    triangle(svg, CELL, [6,6],[9,6],[7.5,7.5], '#c83030');
    triangle(svg, CELL, [9,6],[9,9],[7.5,7.5], '#2060c8');
    triangle(svg, CELL, [6,9],[9,9],[7.5,7.5], '#28a048');
    triangle(svg, CELL, [6,6],[6,9],[7.5,7.5], '#c8a030');

    // Draw board squares (simplified — colored rows)
    drawBoardPath(svg, CELL);

    // Draw tokens on board
    if (gs && gs.tokens) {
      gs.colors.forEach(function (color) {
        gs.tokens[color].forEach(function (tk, idx) {
          var pos = tk.pos;
          if (pos === -1) {
            // In base
            var zone = ['red','blue','green','yellow'].indexOf(color);
            var ox = [1,9,1,9][zone]*CELL, oy = [1,1,9,9][zone]*CELL;
            var bx = (idx%2)*2+.5, by = Math.floor(idx/2)*2+.5;
            tokenCircle(svg, ox+bx*CELL, oy+by*CELL, CELL*.35, COLORS[color], false);
          } else if (pos < 52) {
            var sq = squareCoord(pos, CELL);
            if (sq) tokenCircle(svg, sq.x, sq.y, CELL*.35, COLORS[color], false);
          } else if (pos === 58) {
            // home — center
            tokenCircle(svg, W/2, W/2, CELL*.25, COLORS[color], true);
          }
        });
      });
    }

    return svg;
  }

  function squareCoord(pos, CELL) {
    // 52 squares clockwise from red entry (bottom of left column)
    // Simplified layout
    var coords = [];
    // Left column going up (sq 0-5): col 5, rows 14 down to 9
    for (var i=0;i<6;i++) coords.push({x:(5.5)*CELL, y:(14.5-i)*CELL});
    // Left midrow going right (sq 6-8): col 6,7,8 row 9
    for (var i=0;i<3;i++) coords.push({x:(6.5+i)*CELL, y:8.5*CELL});
    // Top column going up (sq 9-14): col 8, rows 8 down to 2 -> 8.5 up to 0.5
    for (var i=0;i<6;i++) coords.push({x:8.5*CELL, y:(8.5-i)*CELL});
    // Top row going right (sq 15-20): row 0, cols 9..14
    for (var i=0;i<6;i++) coords.push({x:(9.5+i)*CELL, y:0.5*CELL});
    // Wait — this is getting complex; use a lookup table approach
    // Return approximate position
    coords = generateAllSquares(CELL);
    if (pos < coords.length) return coords[pos];
    return null;
  }

  function generateAllSquares(CELL) {
    // 52 squares: 13 on each side
    var sq = [];
    // Bottom-left to bottom going right then clockwise
    // Segment 1: col 5, rows 9-14 going up (6 squares)
    for(var r=14;r>=9;r--)  sq.push({x:5.5*CELL,y:(r+.5)*CELL});
    // Segment 2: row 8, cols 6-8 going right (3 squares)
    for(var c=6;c<=8;c++)   sq.push({x:(c+.5)*CELL,y:8.5*CELL});
    // Segment 3: col 8, rows 7-2 going up (6 squares)
    for(var r=7;r>=2;r--)   sq.push({x:8.5*CELL,y:(r+.5)*CELL});
    // Segment 4: row 1, cols 9-14 going right (6 squares)
    for(var c=9;c<=14;c++)  sq.push({x:(c+.5)*CELL,y:1.5*CELL});
    // right outer going down — mirrored
    // Segment 5: col 14, rows 2-7 (6)
    for(var r=2;r<=7;r++)   sq.push({x:13.5*CELL,y:(r+.5)*CELL});
    // Segment 6: row 8, cols 13-11 going left (3)
    for(var c=13;c>=11;c--) sq.push({x:(c+.5)*CELL,y:8.5*CELL});
    // Segment 7: col 9, rows 9-14 going down (6)
    for(var r=9;r<=14;r++)  sq.push({x:9.5*CELL,y:(r+.5)*CELL});
    // Segment 8: row 14, cols 8-3 going left (6)
    for(var c=8;c>=3;c--)   sq.push({x:(c+.5)*CELL,y:13.5*CELL});
    // Segment 9: col 3, rows 13-8 going up (6)
    for(var r=13;r>=8;r--)  sq.push({x:3.5*CELL,y:(r+.5)*CELL});
    // Segment 10: row 6, cols 2-0 going left (3 -- not needed, keep 52)
    for(var c=4;c>=2;c--)   sq.push({x:(c+.5)*CELL,y:6.5*CELL});
    // pad to 52
    while(sq.length<52) sq.push({x:0,y:0});
    return sq.slice(0,52);
  }

  function rect(svg,x,y,w,h,fill,r) {
    var el = document.createElementNS('http://www.w3.org/2000/svg','rect');
    el.setAttribute('x',x); el.setAttribute('y',y);
    el.setAttribute('width',w); el.setAttribute('height',h);
    el.setAttribute('fill',fill);
    if(r) el.setAttribute('rx',r);
    svg.appendChild(el); return el;
  }
  function circle(svg,cx,cy,r,fill) {
    var el = document.createElementNS('http://www.w3.org/2000/svg','circle');
    el.setAttribute('cx',cx); el.setAttribute('cy',cy);
    el.setAttribute('r',r); el.setAttribute('fill',fill);
    svg.appendChild(el); return el;
  }
  function tokenCircle(svg,cx,cy,r,fill,small) {
    var c = circle(svg,cx,cy,r,fill);
    c.setAttribute('stroke','#fff'); c.setAttribute('stroke-width', small?'1':'2');
    return c;
  }
  function triangle(svg,CELL,a,b,c,fill) {
    var el = document.createElementNS('http://www.w3.org/2000/svg','polygon');
    var pts = [a,b,c].map(function(p){return (p[0]*CELL)+','+(p[1]*CELL);}).join(' ');
    el.setAttribute('points',pts); el.setAttribute('fill',fill); el.setAttribute('opacity','0.6');
    svg.appendChild(el);
  }
  function drawBoardPath(svg,CELL) {
    // light grid squares for path
    var squares = generateAllSquares(CELL);
    squares.forEach(function(sq) {
      rect(svg, sq.x-CELL/2+1, sq.y-CELL/2+1, CELL-2, CELL-2, 'rgba(255,255,255,0.04)', 4);
    });
  }

  // ── Render ───────────────────────────────────────────────
  window.BM_GAMES.ludo = {
    render: function (container, roomState, ctx) {
      emit_ = ctx.emit; username_ = ctx.username; players_ = ctx.players;
      state_ = roomState.gameState;
      container.innerHTML = '';

      var gs = state_;
      var myColor = null;
      gs.playerMap.forEach(function(p){ if(p.username===username_) myColor=p.color; });

      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;';

      // Turn banner
      var cur = gs.playerMap[gs.currentColorIndex];
      var banner = document.createElement('div');
      banner.id = 'ludo-turn-banner';
      banner.className = 'turn-banner';
      banner.innerHTML = '<div class="turn-dot" style="background:'+COLORS[cur&&cur.color||'red']+'"></div><div class="turn-text">'+(cur&&cur.username===username_?'Your turn!':((cur&&cur.nickname||'?')+"'s turn"))+'</div>';
      wrap.appendChild(banner);

      // Dice result
      var diceLabel = document.createElement('div');
      diceLabel.id = 'ludo-dice-label';
      diceLabel.style.cssText = 'font-family:var(--font-mono);font-size:13px;color:var(--game-muted);min-height:18px;';
      if (gs.dice) diceLabel.textContent = 'Dice: ' + ['','⚀','⚁','⚂','⚃','⚄','⚅'][gs.dice];
      wrap.appendChild(diceLabel);

      // Board
      var boardWrap = document.createElement('div');
      boardWrap.className = 'ludo-board-wrap';
      boardWrap.id = 'ludo-board-wrap';
      boardWrap.appendChild(renderBoard(gs));
      wrap.appendChild(boardWrap);

      // Controls
      var controls = document.createElement('div');
      controls.className = 'ludo-controls';
      var isMyTurn = cur && cur.username === username_;

      var diceBtn = document.createElement('button');
      diceBtn.className = 'dice-btn';
      diceBtn.id = 'ludo-dice-btn';
      diceBtn.textContent = gs.dice ? ['','⚀','⚁','⚂','⚃','⚄','⚅'][gs.dice] : '🎲';
      diceBtn.disabled = !isMyTurn || gs.diceRolled;
      diceBtn.addEventListener('click', function () {
        diceBtn.classList.add('dice-roll-anim');
        setTimeout(function(){diceBtn.classList.remove('dice-roll-anim');},400);
        emit_('roll-dice');
      });
      controls.appendChild(diceBtn);

      // Token move buttons (shown when dice rolled and it's my turn)
      if (isMyTurn && gs.diceRolled && myColor) {
        var tokenRow = document.createElement('div');
        tokenRow.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';
        gs.tokens[myColor].forEach(function(tk,i){
          var btn = document.createElement('button');
          btn.style.cssText='padding:8px 14px;border-radius:8px;background:'+COLORS[myColor]+';color:#fff;border:none;font-size:14px;cursor:pointer;font-weight:600;';
          btn.textContent='Move Token '+(i+1);
          btn.addEventListener('click',function(){ emit_('move-token',{tokenIndex:i}); });
          tokenRow.appendChild(btn);
        });
        controls.appendChild(tokenRow);
      }

      wrap.appendChild(controls);

      // Score / players
      var scoreRow = document.createElement('div');
      scoreRow.style.cssText='display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
      gs.playerMap.forEach(function(p){
        var chip = document.createElement('div');
        chip.style.cssText='display:flex;align-items:center;gap:6px;background:'+COLORS[p.color]+'22;border:1px solid '+COLORS[p.color]+';border-radius:8px;padding:6px 12px;';
        chip.innerHTML='<span>'+TOKEN_ICONS[p.color]+'</span><span style="font-size:13px;font-weight:600;color:#ece8e0;">'+esc(p.nickname||p.username)+'</span>'+(gs.winners.includes(p.color)?'<span>🏠</span>':'');
        scoreRow.appendChild(chip);
      });
      wrap.appendChild(scoreRow);

      container.appendChild(wrap);
    },

    update: function (gs, ctx) {
      // Re-render board only
      var bw = document.getElementById('ludo-board-wrap');
      if (!bw) return;
      bw.innerHTML='';
      bw.appendChild(renderBoard(gs));
      // Update turn banner
      var cur = gs.playerMap[gs.currentColorIndex];
      var banner = document.getElementById('ludo-turn-banner');
      if (banner && cur) banner.innerHTML='<div class="turn-dot" style="background:'+COLORS[cur.color]+'"></div><div class="turn-text">'+(cur.username===ctx.username?'Your turn!':((cur.nickname||'?')+"'s turn"))+'</div>';
      // Update dice label
      var dl = document.getElementById('ludo-dice-label');
      if (dl) dl.textContent = gs.dice ? 'Dice: '+['','⚀','⚁','⚂','⚃','⚄','⚅'][gs.dice] : '';
      // Update dice button
      var db = document.getElementById('ludo-dice-btn');
      if (db) { db.textContent=gs.dice?['','⚀','⚁','⚂','⚃','⚄','⚅'][gs.dice]:'🎲'; db.disabled=!(cur&&cur.username===ctx.username)||gs.diceRolled; }
    },
    onEnded: function(){},
  };

  function esc(s){ var d=document.createElement('div');d.textContent=String(s||'');return d.innerHTML; }
})();
