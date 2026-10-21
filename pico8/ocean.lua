-- ocean (pico-8)
-- versao em cartucho do modo ocean - pico-8 (js/ocean/* e js/render/pico-ocean.js)
-- mar aberto com ilhas, navios, helicopteros, balsas de reparo, porta-avioes, esquadrilhas
-- acrobaticas e um chefe a cada duas secoes (bombardeiro, canhoneira, dirigivel,
-- interceptador). o voo alterna entre rasante e acima das nuvens, com looping e mergulho.
-- uma vida so: vale a barra de vida. o hud fica embaixo, sobre o mar.
-- mundo cresce para cima (linha de tela = 127-(y-scroll)); avioes e chefe vivem em
-- coordenadas de tela. pontos guardados em dezenas.

--#sprs
sr={}
for s in all(split(sprs,"|")) do local a=split(s," ") sr[a[1]]=a end

function sp(n,x,y,f) local r=sr[n] sspr(r[2],r[3],r[4],r[5],x,y,r[4],r[5],f) end
function spc(n,cx,cy,f) local r=sr[n] sp(n,cx-r[4]\2,cy-r[5]\2,f) end
function rp() pal() palt(0,false) palt(14,true) end
function row(y) return 127-(y-scroll) end
function wld(sy) return scroll+127-sy end
function wy(o) return (o.b.g-org)*32+o.y end
function op(s,x,y,c) for i=0,8 do print(s,x+i%3-1,y+i\3-1,0) end print(s,x,y,c) end
function sc6(n) local s=n>0 and n.."0" or "0" while #s<6 do s="0"..s end return s end
function pick(w) local k=rnd() for j=1,5 do if k<w[j] then return j end k-=w[j] end return 5 end
function dr() return rnd()<.5 and 1 or -1 end

pts={fuel=8,ship=3,heli=6,balloon=6,carrier=80}
fxc={ship=split"7,12,8,6",plane=split"10,12,6",fuel=split"10,9,8,7",balloon=split"8,7,9,14"}
pun=split"shield,triple shot,rapid fire,bomb +1,full repair"
puw=split".2,.2,.16,.32,.12"
dw=split".2,.2,.14,.34,.12"
puc=split"12,9,10,8,11"
pud=split"1,4,9,2,3"
-- ilhas: comprimento min/max (linhas), largura min/max, ondulacao da largura, freq. e amplitude do centro
isl={split"70,160,20,45,.28,.51,13",split"90,150,13,23,0,0,17",split"40,64,40,65,0,.32,3",split"22,40,20,50,.12,1.7,0"}
sqk=split"loop,vee,sweep,spiral,eight,pincer,dive,zigzag"
sqz={loop={5,14},vee={5,0},sweep={6,16},spiral={4,0},eight={5,16},pincer={6,10},dive={4,6},zigzag={5,0}}
bkind=split"bomber,gunship,airship,interceptor"
bhp=split"60,80,50,70"
brx=split"30,28,33,15"
bry=split"7,11,13,13"
-- patrulha dos chefes: x=64+sin(t*a)*b, y=c+sin(t*d)*e
bmv={split".0019,27,40,.0033,7",split".0016,29,45,.0032,10",split".00095,24,45,0,0"}
-- formas dos chefes (r = retangulo, o = oval): tipo,x0,y0,x1,y1,cor
bshp=split("r,-31,-4,31,1,5/r,-31,-4,31,-3,6/r,-13,-20,13,-17,5/r,-4,-20,4,20,6/r,-2,20,2,22,13/r,-1,13,1,16,12/r,-23,0,-21,3,0/r,-13,0,-11,3,0/r,11,0,13,3,0/r,21,0,23,3,0|o,-28,-11,28,11,5/o,-22,-8,22,8,13/o,-6,-5,6,5,1/r,-2,1,2,4,12/r,-15,8,-13,14,0/r,13,8,15,14,0|r,-37,-3,-31,3,5/o,-33,-13,33,13,6/r,-28,-1,28,1,13/r,-8,8,8,13,5|r,-14,-13,14,-9,13/r,-10,-9,10,-3,13/r,-6,-3,6,4,13/r,-3,4,3,10,13/r,-1,10,1,13,13/r,-1,0,1,5,12/r,-6,-15,-3,-13,8/r,3,-15,6,-13,8","|")

function _init()
 rp() cartdata("river_ocean_pico8")
 menuitem(1,"main menu",function() st="title" end)
 st="title" fr=0 scroll=0
end

-- ---------- mar e ilhas ----------
function gb(g) g=max(g) while nb<=g do gen(nb) end return blk[g] end
function la(y) local g=flr(y/32) return gb(g+org),mid(0,flr(y-g*32),31) end

-- a ilha em curso passa de um bloco para o seguinte, entao pode ser bem comprida:
-- longa (espinha sinuosa), arquipelago (ilhotas em zigue-zague), atol (lagoa) e redonda
function gen(g)
 local o={g=g,b=g%16,s=g\16,il={},ir={},lg={},wv={},seed=rnd(0x7fff),objs={}}
 local p,at=blk[g-1],-1
 local st=p and p.isle
 if(not st and g>=2 and o.b>=3 and rnd()<.42) at=flr(rnd(32))
 for i=0,31 do
  o.il[i],o.ir[i],o.lg[i]=-1,-1,0
  if(rnd()<.12) o.wv[i]=rnd()
  if not st and i==at then
   local k=rnd(split"1,1,2,3,4,4")
   local t=isl[k]
   local w=t[3]+rnd(t[4]-t[3])
   st={k=k,t=0,len=t[1]+rnd(t[2]-t[1]),w=w,cx=w/2+3+rnd(122-w),ph=rnd(),n=3+flr(rnd(3))}
  end
  if st then
   local t,u=isl[st.k],st.t/st.len
   local e=max(0,1-abs(2*u-1)^2.2)^.6
   local h=st.w/2*e*(1-t[5]+t[5]*sin(u*1.11+st.ph))
   if(st.k==2) h=st.w/2*max(0,(abs(sin(u*st.n/2))-.28)/.72)*(.6+.4*e) t={0,0,0,0,0,st.n/4,17}
   local c=st.cx+sin(u*t[6]+st.ph)*t[7]
   if h>.75 then
    o.il[i],o.ir[i]=c-h,c+h
    if(st.k==3) o.lg[i]=max(0,h*.62-st.w*.1)
   end
   st.t+=1
   if(st.t>st.len) st=nil
  end
 end
 o.isle=st
 if(rnd()<.45) o.cd={x=rnd(128),y=rnd(32),r=4+rnd(5)}
 blk[g]=o nb=g+1
 spawn(o)
end

function wf(x0,x1,y0,y1)
 for y=y0,y1 do
  local b,i=la(y)
  if(b.ir[i]>b.il[i] and x1>b.il[i]-1 and x0<b.ir[i]+1) return
 end
 return true
end

function spawn(b)
 if(b.g<2) return
 local keep,base=rnd(0x7fff),(b.g-org)*32
 srand(b.seed)
 local function ad(o) o.b=b o.al=true o.ph=rnd() o.dir=dr() add(b.objs,o) end
 local k=rnd()
 local t=k<.26 and "fuel" or k<.46 and "ship" or k<.66 and "heli" or k<.9 and "ship" or "balloon"
 local w,h=unpack(({fuel={7,12},ship={14,6},heli={11,9},balloon={8,8}})[t])
 -- zona de respiro no comeco da secao: so balsas
 for tr=1,(b.b>=3 or t=="fuel") and 30 or 0 do
  local y,x=3+flr(rnd(26-h)),7+rnd(114-w)
  if wf(x,x+w,base+y,base+y+h) then ad{t=t,x=x,y=y,w=w,h=h,hue=flr(rnd(2))} break end
 end
 if(rnd()<.32) ad{t="pu",k=pick(puw),x=5+rnd(111),y=4+rnd(20),w=7,h=7}
 -- porta-avioes: lanca cacas e aguenta varios tiros
 for tr=1,(b.b>=3 and b.b<11 and rnd()<.16) and 10 or 0 do
  local x,y=4+rnd(72),2+rnd(14)
  if wf(x-6,x+54,base+y,base+y+14) then ad{t="carrier",x=x,y=y,w=48,h=14,hp=10,cool=90+rnd(60),fl=0} break end
 end
 srand(keep)
end

-- ---------- partida ----------
function newgame()
 blk={} nb=0 org=0 score=0 nextl=1000 scroll=0
 py=20 px=59.5 safe=150 hp=100 hurtt=0 bank=0 fc=0 lk=true
 mis={} fx={} sh={} vis={} fl={} sqs={} sqid=0 pw={0,0,0} bombs=3 bq={} boss=nil done={}
 alt=0 altg=0 altm=840 amsg=0 man=nil sqt=240 frz=0 shk=0 bfl=0
 st="play"
end

function addsc(n)
 score+=n
 if(score>=nextl) nextl+=1000 hp=min(100,hp+30) sfx(6)
end

function hurt(d)
 if(hurtt>0 or safe>0 or man) return
 hp-=d hurtt=45 sfx(8)
 if hp<=0 and st=="play" then
  hp=0 st="dying" dying=80 boom(px+4.5,scroll+py+5,"player")
  return true
 end
end

function puff(x,y,c,n,v,t,g)
 local e={x=x,y=y,t=t,life=t,parts={}}
 for j=1,n do local a,s=rnd(),rnd(v) add(e.parts,{x=0,y=0,vx=cos(a)*s,vy=sin(a)*s-(g and 0 or .4),c=rnd(c),g=g}) end
 add(fx,e)
 return e
end
function boom(x,y,k)
 local big=k=="player" or k=="fuel" or k=="carrier"
 puff(x,y,fxc[k] or fxc.plane,big and 26 or 14,big and 1.9 or 1.4,big and 60 or 40).r=big and 11 or 6
 sfx(big and 2 or 1)
end
function smoke(x,sy) puff(x,wld(sy),{5,13,1},1,.15,40,0).sm=true end
function ping(x,sy) puff(x,wld(sy),{7},5,1,10) sfx(12) end
function label(x,y,s,c) add(fx,{x=x,y=y,t=60,life=60,lab=s,c=c,parts={}}) end

-- power-up de recompensa (chefe, esquadrilha inteira, porta-avioes afundado)
function drop(x,y,k)
 local b=gb(flr(y/32)+org)
 add(b.objs,{t="pu",k=k or pick(dw),x=mid(3,x,118),y=y-(b.g-org)*32,w=7,h=7,ph=rnd(),b=b,al=true})
 sfx(12)
end

function aim(sx,sy,s,d)
 local y=wld(sy)
 bsh(sx,sy,atan2(px+4.5-sx,scroll+py+5-y)+(d or 0),s)
end
function bsh(x,sy,a,s) add(sh,{x=x,y=wld(sy),vx=cos(a)*s,vy=sin(a)*s}) end

-- ---------- esquadrilhas: cada padrao da, para o membro k, t -> x,y na tela ----------
function path(n,k,s)
 local d,x0,y0=s.sd,s.x,s.y
 return function(t)
  if n=="loop" then
   if(t<57) return x0,t*1.5-10
   local a=t-57
   if(a<105) local th=(d>0 and .5 or 0)-d*a/105 return x0+d*21+21*cos(th),75+21*sin(th)
   return x0,a*1.6-93
  elseif n=="vee" then
   local y=t-20-abs(k-2)*7
   return x0+(k-2)*9+sin(t*.0048)*12+mid(-1,k-2,1)*max(y-85)*.9,y
  elseif n=="sweep" then return d>0 and t*1.2-10 or 138-t*1.2,y0+sin(t*.008)*18+t*.175
  elseif n=="spiral" then local th,r=t*.011+k/4,4+t*.25 return x0+r*cos(th),t*.55-10+r*sin(th)*.6
  elseif n=="eight" then return x0+40*sin(t*.0048),t*.45-10+18*sin(t*.0095)
  elseif n=="takeoff" then return x0+d*(t*.7+t*t*.003),y0+max(t-35)*.55+sin(t*.008)*4
  elseif n=="pincer" then return k%2==1 and t*1.3-10 or 138-t*1.3,15+k\2*13+t*.45+sin(t*.0095)*9
  elseif n=="dive" then
   local x1=x0+(k-1.5)*11
   if(t<70) return x1+(s.tx-x1)*(t/70)^2*.8,t*1.5-10
   local a=t-70
   return x1+(s.tx-x1)*.8+d*a*1.2,95-a*.7+a*a*.006
  end
  return x0+(2*abs(t/40%2-1)-1)*35+(k-2)*7,t*.8-10-k*5
 end
end

function squad(n,s,c,dl)
 sqid+=1 sqs[sqid]={n=c,k=0}
 for k=0,c-1 do add(fl,{p=path(n,k,s),t=-k*dl,sq=sqid,x=-99,y=-99,a=.75,al=true,cool=60+rnd(120)}) end
end

function kfl(f,by)
 f.al=false del(fl,f)
 local y=wld(f.y)
 boom(f.x,y,"plane")
 if(not by) return
 addsc(12)
 local q=sqs[f.sq]
 q.k+=1
 -- esquadrilha inteira: bonus e um power-up
 if(q.k==q.n and q.n>2) addsc(50) label(f.x,y,"squadron +500",10) drop(f.x-3,y-3,rnd()<.5 and 4) sfx(6)
end

-- ---------- altitude: rasante <-> acima das nuvens, com looping (sobe) e mergulho (desce) ----------
function setalt(v)
 if(altg==v) return
 altg=v altm=v==1 and 600 or 840 amsg=150
 if(st=="play") man={k=v,t=0,d=v==1 and 96 or 84}
 sfx(11)
end
-- pose do jato na manobra: deslocamento vertical e escalas x/y
function pose()
 if(not man) return 0,1,1
 local u=man.t/man.d
 local q=sin(u/2)
 if(man.k==1) return q*23,1-.4*q,(1-.4*q)*cos(u)
 return -q*11,(1+.25*q)*cos(u),(1+.25*q)*(1+.7*q)
end

-- ---------- chefes ----------
function bhit(x,y)
 local B=boss
 local dx,dy=x-B.x,y-B.y
 local ax=abs(dx)
 if(B.k==1) return ax<31 and abs(dy+1)<6 or ax<5 and abs(dy)<21 or ax<13 and abs(dy+18)<3
 return (dx/brx[B.k])^2+(dy/bry[B.k])^2<1
end
-- dirigivel: as torres blindam o nucleo; devolve a primeira torre de pe
function armd()
 for u in all(boss.tu) do
  if(u.hp>0) return u
 end
end

-- missil chegando no chefe: true se foi consumido
function bshot(mx,sy)
 local B=boss
 if(not B or B.dy or B.t<60 or not bhit(mx,sy)) return
 -- defesas: interceptador intocavel na investida, escudo frontal, torres que blindam o nucleo
 if B.k==4 and B.m==3 or B.k==2 and B.shd>0 and sy>B.y-2 then ping(mx,sy) return true end
 local u=armd()
 if u then
  u.hp-=1 u.fl=4 addsc(1)
  if(u.hp<=0) boom(B.x+u.dx,wld(B.y+u.dy),"tank") addsc(30)
  return true
 end
 B.hp-=1 B.fl=4 addsc(1)
 puff(mx,wld(sy),{10},4,1,10)
 if(B.hp<=0) B.dy=true sh={}
 return true
end

function bupd(d,cg)
 local s=cg\16
 if not boss then
  if(cg%16<11 or done[s] or s%2==0) return
  local k=(s-1)\2%4+1
  local hp=bhp[k]+15*min(s,8)
  boss={k=k,sec=s,x=64,y=-45,hp=hp,mx=hp,t=0,fl=0,atk=0,m=1,mt=0,shd=0,tr={},tu={}}
  if(k==3) for j,v in pairs{-23,-10,10,23} do add(boss.tu,{dx=v,dy=abs(v)<20 and 9 or 4,hp=8+2*min(s,6),cool=40+j*20,fl=0}) end
  sfx(9)
 end
 local B=boss
 B.t+=1 B.fl=max(B.fl-1)
 if B.dy then
  -- queda: fumaca, explosoes, deriva e encolhe ate o respingo no mar
  B.f=B.f or {t=0,vx=dr()*(.15+rnd(.2))}
  local F=B.f
  F.t+=1
  B.x+=F.vx B.y+=.12+F.t/500
  if(F.t%2==0) smoke(B.x+rnd(40)-20,B.y)
  if(F.t%18==0 and F.t<105) boom(B.x+rnd(40)-20,wld(B.y),"fuel")
  if F.t>=150 then
   local y=wld(B.y)
   boom(B.x,y,"carrier") shk=30
   addsc(300+100*min(B.sec,5)) done[B.sec]=true hp=min(100,hp+40)
   label(B.x,y,"boss down! +40",10) sfx(6)
   boss=nil setalt(0)
  end
  return
 end
 if B.t<140 then B.y=-45+85*B.t/140 return end
 local spd,pcx,t,v=.75+.15*d,px+4.5,B.t,bmv[B.k]
 local T=t-140
 if(T%300==150) drop(15+rnd(91),wld(75+rnd(30)))
 if(v) B.x=64+sin(t*v[1])*v[2] B.y=v[3]+sin(t*v[4])*v[5]
 if B.k==1 then
  -- bombardeiro: leque, rajadas mirando e lancamento de cacas
  if t%max(50,80-5*min(B.sec,6))==0 then
   local a=B.atk%3
   B.atk+=1
   for j=-3,3 do
    if(a==0) bsh(B.x,B.y+20,.25+j*.035,spd)
    if(a==1 and j%3==0) aim(B.x-15,B.y+3,spd+.15,j*.007) aim(B.x+15,B.y+3,spd+.15,j*.007)
    if(a==2 and j%6==3) squad("takeoff",{x=B.x+j*8,y=B.y+2,sd=sgn(j)},1,0)
   end
  end
 elseif B.k==2 then
  -- canhoneira: espiral, muralha com brecha, foguetes teleguiados; escudo de tempos em tempos
  if(T%420==0) B.shd=180 sfx(11)
  B.shd=max(B.shd-1)
  local ph,lc,gp=T\150%3,T%150,1+flr(rnd(8))
  if(ph==0 and lc<90 and lc%4==0) bsh(B.x,B.y+5,t*.029,spd) bsh(B.x,B.y+5,t*.029+.5,spd)
  if ph==1 and lc%60==20 then
   for j=0,10 do
    if(j!=gp and j!=gp+1) bsh(6+j*11.6,B.y+10,.25,spd*.9)
   end
  end
  if(ph==2 and lc%20==10) aim(B.x-20,B.y+4,spd,.02) aim(B.x+20,B.y+4,spd,-.02)
 elseif B.k==3 then
  -- dirigivel: quatro torres que miram, minas flutuantes e escoltas
  for u in all(B.tu) do
   u.fl=max(u.fl-1) u.cool-=1
   if(u.hp>0 and u.cool<=0) u.cool=85-20*d+rnd(30) aim(B.x+u.dx,B.y+u.dy,spd)
  end
  if(T%140==70) for j=0,7 do bsh(B.x,B.y+15,j/8,.4) end
  if(T%420==300) squad("pincer",{x=64,y=0,sd=1},4,10)
 else
  -- interceptador: segue o jato, rajadas, investida em mergulho e onda de choque
  add(B.tr,{B.x,B.y})
  if(#B.tr>8) deli(B.tr,1)
  B.mt=(B.mt+1)%346
  local m=B.mt
  B.m=m<220 and 1 or m<252 and 2 or m<286 and 3 or 4
  if B.m==1 then
   B.x=mid(20,B.x+(pcx+sin(t*.0048)*30-B.x)*.02,108) B.y=40+sin(t*.008)*4
   if(m%50==0) for j=-1,1 do aim(B.x,B.y+10,spd+.2,j*.016) end
   B.vx,B.vy=(pcx-B.x)/34,(mid(70,122-py,98)-B.y)/34
  elseif B.m==2 then
   B.x+=sin(m*.27)*.6
   if(m==220) sfx(9)
  elseif B.m==3 then
   B.x+=B.vx B.y+=B.vy
   if(m==285) for j=0,13 do bsh(B.x,B.y,j/14,spd) end
  else B.y+=(40-B.y)*.06 end
 end
end

-- bomba: apaga os tiros e a onda de choque derruba, do mais perto ao mais longe, os avioes e
-- (no rasante) os inimigos da superficie; fere porta-avioes (6) e o chefe (15, torres antes)
function usebomb()
 if(bombs<=0) sfx(12) return
 bombs-=1
 sh={}
 local pcx,pcy=px+4.5,122-py
 local function later(x,y,f) add(bq,{t=(abs(x-pcx)+abs(y-pcy))/3,f=f}) end
 for f in all(fl) do
  if(f.t>=0 and f.y>-5 and f.y<128) later(f.x,f.y,function() if f.al then kfl(f,true) end end)
 end
 for o in all(alt<.25 and vis or {}) do
  local sy=row(wy(o)+o.h)
  if pts[o.t] and o.t!="fuel" and sy>-o.h and sy<128 then
   later(o.x+o.w/2,sy+o.h/2,function()
    if(not o.al) return
    o.hp=(o.hp or 1)-6 o.fl=8
    if(o.hp<=0) o.al=false kobj(o)
   end)
  end
 end
 if boss and not boss.dy and boss.t>140 then
  later(boss.x,boss.y,function()
   local B=boss
   if(not B or B.dy) return
   for j=1,15 do local u=armd() if u then u.hp-=1 u.fl=6 else B.hp=max(1,B.hp-1) end end
   B.fl=8 boom(B.x+rnd(30)-15,wld(B.y),"fuel")
  end)
 end
 -- o espetaculo: pausa de impacto, clarao, tremor e ondas de choque
 frz=7 shk=48 bfl=12
 add(fx,{x=pcx,y=wld(pcy),t=60,life=60,rg=3,c=7,parts={}})
 add(fx,{x=pcx,y=wld(pcy),t=50,life=50,rg=2.4,c=10,parts={}})
 sfx(10)
end
-- inimigo da superficie derrubado; porta-avioes afundado solta uma bomba e mais um power-up
function kobj(o)
 addsc(pts[o.t]) boom(o.x+o.w/2,wy(o)+o.h/2,o.t)
 if(o.t=="carrier") drop(o.x+o.w/2-10,wy(o)+7,4) drop(o.x+o.w/2+3,wy(o)+12)
end

-- ---------- passo ----------
function gather()
 vis={}
 local cg=flr(scroll/32)+org
 gb(cg+7)
 for g=max(cg-7),cg+5 do
  for o in all(blk[g] and blk[g].objs or {}) do
   if(o.al) add(vis,o)
  end
 end
end

function _update60()
 fr+=1
 if st=="title" then
  if(btnp(4) or btnp(5)) newgame()
  return
 end
 shk=max(shk-1) bfl=max(bfl-1)
 if(frz>0) frz-=1 return
 for e in all(fx) do
  e.t-=1
  for p in all(e.parts) do p.x+=p.vx p.y+=p.vy p.vy+=p.g or .05 end
  if(e.t<=0) del(fx,e)
 end
 if st=="over" then
  overt+=1 scroll+=.3 gather()
  if(overt>40 and (btnp(4) or btnp(5))) st="title"
 elseif st=="dying" then
  dying-=1
  if(dying<=0) st="over" overt=0 sh={} mis={} fl={} boss=nil dset(0,max(score,dget(0)))
 else play() end
 if scroll>8192 then
  org+=256 scroll-=8192
  for l in all{mis,sh,fx} do for e in all(l) do e.y-=8192 end end
 end
 for g,b in pairs(blk) do
  if(g<flr(scroll/32)+org-8) blk[g]=nil
 end
end

function play()
 local cg=flr(scroll/32)+org
 local d=min(cg\16,8)/8
 local stx=tonum(btn(1))-tonum(btn(0))
 -- a camera anda constante (quase para no chefe); rasante parece mais rapido
 camsp=(boss and .15 or .625*(1.15-.3*alt))*(1+d*.56)
 py=mid(15,py+tonum(btn(2))-tonum(btn(3)),108) px=mid(0,px+stx,119)
 bank+=(stx-bank)*.18 scroll+=camsp
 for i=1,3 do pw[i]=max(pw[i]-1) end
 safe,hurtt,fc=max(safe-1),max(hurtt-1),max(fc-1)
 if man then
  man.t+=1
  -- rastros de condensacao nas pontas das asas
  local dy,sx=pose()
  if(man.t%2==0) for s=-1,1,2 do puff(px+4.5+s*4*abs(sx),scroll+py+5-dy,{7},1,.05,28,0) end
  if(man.t>=man.d) man=nil
 end
 if(btnp(5)) usebomb()
 -- rajada: 10 tiros (um a cada 4 quadros) por no maximo 1 s; tiro rapido: 15 a cada 3
 if not btn(4) then bt,bs,lk=0,0,false
 elseif not lk and not man then
  bt+=1
  if bt>60 or bs>=(pw[3]>0 and 15 or 10) then lk=true
  elseif fc<=0 then
   local x,y=px+4,scroll+py+10
   bs+=1 add(mis,{x=x,y=y,vx=0})
   if(pw[2]>0) add(mis,{x=x-1,y=y-1,vx=-.55}) add(mis,{x=x+1,y=y-1,vx=.55})
   fc=pw[3]>0 and 3 or 4 sfx(0)
  end
 end
 -- altitude
 if(boss) setalt(1)
 altm-=1
 if(altm<=0 and not boss) setalt(1-altg)
 alt+=mid(-1/150,altg-alt,1/150)
 amsg=max(amsg-1)
 local high=alt>.25
 for q in all(bq) do
  q.t-=1
  if(q.t<=0) q.f() del(bq,q)
 end
 -- novas esquadrilhas (nao durante o chefe nem na zona de respiro); la em cima vem em dobro
 sqt-=high and 2 or 1
 if not boss and cg%16>=3 and sqt<=0 then
  local n=rnd(sqk)
  local c,dl=unpack(sqz[n])
  squad(n,{x=35+rnd(58),y=20+rnd(50),sd=dr(),tx=px+4.5},c,dl)
  sqt=300-120*d+rnd(120)
 end
 -- superficie: navios navegam e atiram, helicopteros perseguem, baloes vao com o vento
 gather()
 local pb,pt,pcx,pcy=scroll+py,scroll+py+10,px+4.5,122-py
 for o in all(vis) do
  local t,sy=o.t,row(wy(o)+o.h)
  local gx,gy,fire=o.x+o.w/2,sy+o.h/2
  if t=="ship" and sy>-30 and sy<158 then
   -- navio: rumo que oscila em torno da horizontal, meia-volta na ilha ou na borda; canhao na proa
   local nx,y=o.x+o.dir*.3,wy(o)
   if nx>-5 and nx<133-o.w and wf(nx,nx+o.w,y,y+o.h) then o.x=nx else o.dir=-o.dir end
   gx+=o.dir*4 fire=170-70*d
  elseif t=="heli" and sy>-20 and sy<128 then
   -- helicoptero: pega carona na camera e persegue o jato pelos lados
   local tx=pcx+sin(fr*.0032+o.ph)*30-o.w/2
   o.x+=mid(-.55,tx-o.x,.55) o.dir=tx>o.x and 1 or -1
   if(sy<64) o.y+=camsp*.75
   fire=150-50*d
  elseif t=="balloon" then o.x+=sin(fr*.0016+o.ph)*.2 o.y+=.075
  elseif t=="carrier" then
   o.fl=max(o.fl-1)
   if(sy>10 and sy<83) o.cool-=1
   if(o.cool<=0) o.cool=170-50*d+rnd(60) squad("takeoff",{x=o.dir>0 and o.x+o.w or o.x,y=gy,sd=o.dir},1,0)
  end
  if fire and not high and gy>5 and gy<108 then
   o.gc=(o.gc or 40+rnd(80))-1
   if(o.gc<=0) o.gc=fire+rnd(80) aim(gx,gy,.75+.15*d) sfx(7)
  end
  local y=wy(o)
  if o.al and px+8>o.x+.5 and px+1<o.x+o.w-.5 and pt>y+.5 and pb<y+o.h-.5 then
   if t=="pu" then
    local k=o.k
    o.al=false
    if(k<4) pw[k]=k==1 and 480 or 600
    if(k==4) bombs=min(9,bombs+1)
    if(k==5) hp=100
    addsc(5) sfx(5) label(o.x+3,y+3,pun[k],puc[k])
   elseif high then
   elseif t=="fuel" then
    -- balsa: recupera a vida
    if(hp<100 and fr%4==0) sfx(3)
    hp=min(100,hp+.8)
   elseif safe>0 or man or t=="carrier" or t=="ship" then
   else
    o.al=false boom(gx,y+o.h/2,t)
    if pw[1]>0 then addsc(1) elseif hurt(35) then return end
   end
  end
 end
 bupd(d,cg)
 -- avioes: seguem o caminho, apontam o nariz para onde vao e atiram no jogador
 for f in all(fl) do
  f.t+=1
  if f.t>=0 then
   local nx,ny=f.p(f.t)
   if(f.sn) f.a=atan2(nx-f.x,ny-f.y)
   f.x,f.y=nx,ny
   f.sn=f.sn or ny>-5 and ny<128 and nx>-5 and nx<133
   f.cool-=1
   if(ny>5 and ny<73 and f.cool<=0) f.cool=150-60*d+rnd(120) aim(nx,ny,.8+.2*d)
   if f.t>40 and (ny>140 or nx<-30 or nx>158 or ny<-80) then del(fl,f)
   elseif abs(nx-pcx)<6.5 and abs(ny-pcy)<6 and safe+hurtt<=0 and not man then
    kfl(f,pw[1]>0)
    if(pw[1]<=0 and hurt(30)) return
   end
  end
 end
 if(boss and not boss.dy and boss.t>140 and bhit(pcx,pcy) and hurt(50)) return
 -- tiros inimigos
 for s in all(sh) do
  s.x+=s.vx s.y+=s.vy
  if s.x>px+.5 and s.x<px+8.5 and s.y>pb and s.y<pt then
   del(sh,s)
   if(pw[1]<=0 and hurt(12)) return
  end
  if(abs(s.x-64)>68 or abs(row(s.y)-64)>76) del(sh,s)
 end
 -- misseis: avioes, foguetes e minas, chefe e (no rasante) a superficie
 for m in all(mis) do
  m.y+=4.5 m.x+=m.vx
  local y0,y1,mx=m.y,m.y+4,m.x+.5
  local top,bot=row(y1),row(y0)
  local hit=top<-4 or m.x<-2 or m.x>130
  for f in all(fl) do
   if(not hit and f.t>=0 and abs(mx-f.x)<5.5 and f.y>top-4 and f.y<bot+4) kfl(f,true) hit=true
  end
  hit=hit or bshot(mx,top)
  for o in all(high and {} or vis) do
   local y=wy(o)
   if not hit and o.al and pts[o.t] and m.x+1>o.x and m.x<o.x+o.w and y1>y and y0<y+o.h then
    hit=true o.hp=(o.hp or 1)-1 o.fl=4
    if(o.hp>0) addsc(1)
    if(o.hp<=0) o.al=false kobj(o)
   end
  end
  if(hit) del(mis,m)
 end
end

-- ---------- desenho ----------
function cloud(b,g,col)
 local c=b and b.cd
 if c then
  local x,y=c.x,row((g-org)*32+c.y)
  circfill(x,y,c.r,col) circfill(x+c.r,y+1,c.r*.7,col) circfill(x-c.r,y+1,c.r*.7,col)
 end
end

function _draw()
 if(st=="title") return title()
 local k=shk>0 and 2 or 0
 camera(rnd(2*k)-k,rnd(2*k)-k)
 cls(12)
 -- mar com marolas e ilhas (areia, mato e a lagoa do atol), linha a linha
 for r=0,127 do
  local b,i=la(scroll+127-r)
  local a,e,l=b.il[i],b.ir[i],b.lg[i]
  if(b.wv[i]) line(b.wv[i]*124,r,b.wv[i]*124+2,r,7)
  if e>a then
   line(a,r,e,r,15)
   if(e-a>5) line(a+2,r,e-2,r,11)
   if(e-a>12) line(a+5,r,e-5,r,3)
   if(l>0) line((a+e)/2-l-1,r,(a+e)/2+l+1,r,15) line((a+e)/2-l,r,(a+e)/2+l,r,12)
  end
 end
 local cg=flr(scroll/32)+org
 -- superficie
 for o in all(vis) do
  local cx,cy,t=o.x+o.w/2,row(wy(o)+o.h/2),o.t
  if t=="carrier" then
   -- porta-avioes visto de cima: casco, conves com pista, ilha de comando
   local x,y,w,c=o.x,cy-7,o.w,o.fl>0 and 7 or 5
   rectfill(x,y+1,x+w-1,y+12,c)
   rectfill(x+2,y+3,x+w-3,y+10,o.fl>0 and 7 or 6)
   for s=x+4,x+w-10,6 do line(s,y+7,s+2,y+7,7) end
   rectfill(x+26,y+8,x+32,y+11,13)
  elseif t=="fuel" then spc("fuel",cx,cy)
  elseif t=="pu" then
   if(fr%30<6) pal(pud[o.k],7)
   spc("pu"..o.k,cx,cy+sin(fr*.013+o.ph)) rp()
  else
   line(cx+2,cy+5,cx+5,cy+5,1)
   spc(t=="ship" and "shipt" or t=="heli" and "htop"..fr\4%2 or "bt"..o.hue..fr\8%2,cx,cy,(o.dir<0)==(t=="ship"))
  end
 end
 -- no alto: nevoa sobre o mar e as nuvens abaixo do jato
 if alt>.05 then
  fillp(alt<.5 and 0b1111110111110111.1 or 0b0111110101111101.1)
  rectfill(0,0,127,127,7) fillp()
  for g=cg-1,cg+5 do
   if(alt>.5) cloud(blk[g],g,7)
  end
 end
 -- ar: cacas, chefe, tiros e misseis
 for f in all(fl) do
  if(f.t>=0) spc("f"..flr(f.a*16+.5)%16,f.x,f.y)
 end
 if boss then
  local B=boss
  local s=B.f and 1-B.f.t/215 or 1
  if(B.fl>0 and fr%4<2) for c=0,15 do pal(c,7) end
  if(B.k==4 and B.m==3) for p in all(B.tr) do circ(p[1],p[2],3,2) end
  if(B.k==4 and B.m==2 and fr%4<2) pal(13,8)
  for c in all(split(bshp[B.k],"/")) do
   local a=split(c)
   ;(a[1]=="o" and ovalfill or rectfill)(B.x+a[2]*s,B.y+a[3]*s,B.x+a[4]*s,B.y+a[5]*s,a[6])
  end
  for u in all(B.tu) do
   circfill(B.x+u.dx*s,B.y+u.dy*s,2*s,u.hp<=0 and 4 or u.fl>0 and 7 or 0)
  end
  if(B.k==2 and B.shd>0 and fr%4<3) oval(B.x-31*s,B.y-4*s,B.x+31*s,B.y+15*s,12)
  rp()
 end
 for s in all(sh) do spc("bul"..fr\4%2,s.x,row(s.y)) end
 for m in all(mis) do local y=row(m.y+4) line(m.x,y,m.x,y+2,pw[3]>0 and 7 or 10) pset(m.x,y,7) end
 -- explosoes, fumaca, rastros e ondas de choque
 for e in all(fx) do
  local age,cx,cy=e.life-e.t,e.x,row(e.y)
  local q=age/(e.life*.6)
  if e.r and q<1 then
   local rad=e.r*(.35-.65*sin(q/2))
   circfill(cx,cy,rad,({7,10,9,8,2})[flr(q*5)+1])
   if(q<.6) circfill(cx,cy,rad*.5,q<.3 and 7 or 10)
  end
  if(e.rg) circ(cx,cy,age*e.rg,e.c)
  for p in all(e.parts) do
   if(e.sm) circfill(cx+p.x,cy+p.y,1+age/14,p.c)
   if(e.t>6 or fr%2==0) pset(cx+p.x,cy+p.y,p.c)
  end
 end
 -- jato: sombra (mais longe quanto mais alto), looping/mergulho, escudo
 if st=="play" then
  local lv,jx,jy=mid(-2,flr(bank*2+.5),2),px+4.5,123-py
  local r,dy,sx,sy=sr["jet"..abs(lv)],pose()
  local w,h=9*sx,10*sy
  for c=1,15 do pal(c,1) end
  sspr(r[2],r[3],9,10,jx-1.5+11*alt,jy-1+17*alt,9,10,lv<0) rp()
  if(safe+hurtt==0 or fr%10>=5) sspr(r[2],r[3],9,10,jx-abs(w)/2,jy+dy-abs(h)/2,abs(w),abs(h),(w<0)!=(lv<0),h<0)
  if(pw[1]>0 and (pw[1]>=90 or fr%10>=5)) circ(jx,jy+dy,7+fr\8%2,12)
 end
 if(bfl>4) rectfill(0,0,127,127,7)
 camera()
 for e in all(fx) do
  local w=#(e.lab or "")*4-1
  if(e.lab and (e.t>12 or fr%4<2)) op(e.lab,mid(1,e.x-w/2,126-w),row(e.y)-9-(e.life-e.t)*.25,e.c)
 end
 -- hud
 if boss then
  local B=boss
  rectfill(2,1,125,4,0) rectfill(3,2,3+121*max(B.hp)/B.mx,3,8)
  op(bkind[B.k]..(B.dy and " down!" or ""),3,8,B.dy and 10 or 7)
 end
 local t=altg==1 and "⬆️ above the clouds" or "⬇️ low-level flight"
 if(amsg>0 and fr%8<6) op(t,60-#t*2,24,altg==1 and 12 or 10)
 op(sc6(score),2,115,7)
 -- bombas: alinhadas a direita
 for j=1,bombs do sp("bomb",128-j*6,116) end
 local f=mid(0,hp/100,1)
 op("♥",1,122,8)
 rect(9,121,49,127,0) rectfill(10,122,48,126,1)
 if(f>=.25 or fr%20<10) rectfill(10,122,10+38*f,126,f>.5 and 11 or f>.25 and 10 or 8)
 local x=56
 for k=1,3 do
  if(pw[k]>0) sp("pu"..k,x,119) line(x,127,x+6*pw[k]/(k==1 and 480 or 600),127,puc[k]) x+=9
 end
 if st=="over" then
  rectfill(14,34,113,78,0) rectfill(15,35,112,77,1)
  print("game over\n\n"..sc6(score).."\n\nbest "..sc6(dget(0)).."\n\n🅾️ back to menu",34,40,7)
 end
end

function title()
 cls(12)
 for r=0,127 do
  local c,h=40+sin(r/150+fr/1200)*30,18*sin(r/128)
  if(h>1) line(c-h,r,c+h,r,15) line(c-h+2,r,c+h-2,r,11)
 end
 op("ocean",44,14,12) op("pico-8",70,14,8)
 op("best "..sc6(dget(0)),40,30,7)
 op("open sea, islands, carriers,\nsquadrons and a boss every\nother section. one life:\nwatch the health bar!",8,44,7)
 op("🅾️ start",46,84,10)
 op("⬅️➡️⬆️⬇️ fly",38,100,6)
 op("🅾️ fire  ❎ bomb",32,108,6)
end
