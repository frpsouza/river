pico-8 cartridge // http://www.pico-8.com
version 43
__lua__
-- river - classic & modern (pico-8)
-- versao em cartucho dos modos classic - pico-8 e modern - pico-8 (js/render/pico.js)
-- classic: margens, ilhas e ponte matam; combustivel; 3 vidas.
-- modern: voa sobre a terra, paredoes de rocha, barra de vida e power-ups.
-- o mundo cresce para cima: linha de tela = 127-(y-scroll). um bloco = 32 linhas,
-- uma secao = 16 blocos (o ultimo e a ponte). o hud fica embaixo, sobre o mapa.
-- os pontos sao guardados em dezenas (o numero do pico-8 vai so ate 32767).

sprs="jet0 0 0 9 10|jet1 10 0 9 10|jet2 20 0 9 10|fuel 30 0 6 12|bomb 37 0 5 5|pu1 43 0 7 7|pu2 51 0 7 7|pu3 59 0 7 7|pu4 67 0 7 7|pu5 75 0 7 7|ship 83 0 20 6|heli0 104 0 14 8|heli1 0 13 14 8|plane 15 13 12 6|house1 28 13 18 9|house2 47 13 18 9|tank 66 13 10 5|bal0 77 13 10 12|bal1 88 13 10 12|tree 99 13 3 4|pine 103 13 3 5|cow 107 13 4 3"
sr={}
for s in all(split(sprs,"|")) do local a=split(s," ") sr[a[1]]=a end

function sp(n,x,y,f) local r=sr[n] sspr(r[2],r[3],r[4],r[5],x,y,r[4],r[5],f) end
function spb(n,cx,by,f) local r=sr[n] sp(n,cx-r[4]\2,by-r[5],f) end
function spc(n,cx,cy,f) local r=sr[n] sp(n,cx-r[4]\2,cy-r[5]\2,f) end
function rp() pal() palt(0,false) palt(14,true) end
function sm(t) return t*t*(3-2*t) end
function row(y) return 127-(y-scroll) end
function wy(o) return (o.b.g-org)*32+o.y end
function op(s,x,y,c) for i=0,8 do print(s,x+i%3-1,y+i\3-1,0) end print(s,x,y,c) end
function sc6(n) local s=n>0 and n.."0" or "0" while #s<6 do s="0"..s end return s end

pts={fuel=8,ship=3,heli=6,plane=10,tank=25,balloon=6}
fxc={ship={7,12,8,6},heli={9,5,10},plane={10,12,6},fuel={10,9,8,7},tank={4,5,3},balloon={8,7,9,14},bridge={4,5,6},player={10,9,5,7}}
dims={fuel={9,14},ship={21,7},heli={13,9},house={18,11},tank={9,5},balloon={12,18}}
pun=split"shield,triple shot,rapid fire,bomb!,+1 life"
puw=split".22,.28,.28,.14,.08"
puc=split"12,9,10,8,11"
pud=split"1,4,9,2,3"
modes=split"classic,modern"
mdesc={"land kills. watch your fuel!","fly over land. rock walls,\npower-ups and a health bar."}

function _init()
 rp() cartdata("river_pico8")
 menuitem(1,"main menu",function() st="title" end)
 st="title" md=1 fr=0 scroll=0
end

-- ---------- terreno ----------
function gb(g) g=max(g,0) while nb<=g do gen(nb) end return blk[g] end
function la(y) local g=flr(y/32) return gb(g+org),mid(0,flr(y-g*32),31) end

function gen(g)
 local b,s=g%16,g\16
 local p=blk[g-1] or {ec=64,ew=80,cl={},cr={}}
 local o={g=g,b=b,s=s,l={},r={},il={},ir={},cl={},cr={},wv={},br=b==15,lt=s%2==1,seed=rnd(0x7fff)}
 local d,tw,tc=min(s,8)/8
 if g==0 then tw,tc=80,64
 elseif o.br then tw,tc=32,p.ec
 else
  local wm=75-40*d
  tw=wm+(132-wm)*rnd()^(1+d)
  if(b==14) tw=47
  if(b<3) tw=max(tw,90)
  -- rio simetrico; de vez em quando um episodio de assimetria desvia o rio para um lado
  local pa,as=p.as
  if(pa and pa[1]>0) as={pa[1]-1,pa[2]}
  if(not as and b>=3 and b<13 and rnd()<.14+.12*d) as={flr(rnd(3)),sgn(rnd()-.5)*(14+rnd(22))}
  if(b>=13) as=nil
  o.as=as
  tc=mid(6+tw/2,64+(as and as[2] or 0),122-tw/2)
  local pl,pr,op=p.ec-p.ew/2,p.ec+p.ew/2,b<3 and 30 or 20
  local tl,tr=mid(pl-op,tc-tw/2,pl+20),mid(pr-20,tc+tw/2,pr+op)
  if b==14 and tr-tl>50 then local m=(tl+tr)/2 tl,tr=m-23,m+23 end
  local mw=b==14 and 32 or max(32,wm-20)
  if tr-tl<mw then local m=(tl+tr)/2 tl,tr=m-mw/2,m+mw/2 end
  tl=mid(6,tl,122-mw) tr=mid(tl+mw,tr,122)
  tc,tw=(tl+tr)/2,tr-tl
 end
 o.ec,o.ew=tc,tw
 local t0,sn=o.br and 0 or 1,o.br and 9 or b==0 and 16 or 30
 for i=0,31 do
  local t=sm(mid(0,(i-t0)/sn,1))
  local c,w=p.ec+(tc-p.ec)*t,p.ew+(tw-p.ew)*t
  o.l[i],o.r[i],o.il[i],o.ir[i],o.cl[i],o.cr[i]=c-w/2,c+w/2,-1,-1,0,0
  if(rnd()<.14) o.wv[i]=rnd()
 end
 -- ilha: rara no comeco, mais frequente com a dificuldade
 if not o.br and g>1 and b>=3 and tw>=75 and p.ew>=75 and rnd()<.1+.45*d then
  local mi=min(tw,p.ew)-48
  if mi>=8 then
   local iw,hl=8+rnd(min(mi,17+13*d)-8),6+rnd(5)
   for i=ceil(15.5-hl),flr(15.5+hl) do
    local u=(i-15.5)/hl
    local h,ic=iw/2*sqrt(max(0,1-u^4)),(o.l[i]+o.r[i])/2
    o.il[i],o.ir[i]=ic-h,ic+h
   end
  end
 end
 blk[g]=o nb=g+1
 if(md==2 and s>=2) cliffs(o,p,d)
 spawn(o)
end

-- paredoes de rocha (modern): faixa colada na agua, do lado da terra
function cliffs(o,p,d)
 local cl,sh=o.br or o.b==14
 for lf in all{true,false} do
  local arr,s0=lf and o.cl or o.cr,(lf and p.cl or p.cr)[31] or 0
  local k=(o.as or not sh) and {rnd(),7+rnd(6+9*d),rnd()} or sh
  if(not o.as and not sh) sh=k
  local function land(i) return lf and o.l[i] or 128-o.r[i] end
  local tg=0
  if(not cl and o.b>=3 and (s0>0 and k[1]<.75 or s0==0 and k[1]<.22+.4*d)) tg=min(k[2],land(31)-4)
  if(tg<4) tg=0
  for i=0,31 do
   local w=s0+(tg-s0)*sm(i/31)
   arr[i]=w<1 and 0 or mid(0,w+sin(i/62)*(sin(i*.3+k[3])+sin(i*.11+k[3]*2))*.08*w,max(0,land(i)-1))
  end
 end
end

function cliffhit(x0,x1,y0,y1)
 for y=y0,y1 do
  local b,i=la(y) local c,d=b.cl[i],b.cr[i]
  if(c>0 and x0<b.l[i] and x1>b.l[i]-c or d>0 and x1>b.r[i] and x0<b.r[i]+d) return true
 end
end

function wf(x0,x1,y0,y1)
 for y=y0,y1 do
  local b,i=la(y)
  if(x0<b.l[i]+1 or x1>b.r[i]-1 or b.ir[i]>b.il[i] and x1>b.il[i]-1 and x0<b.ir[i]+1) return false
 end
 return true
end

-- ---------- objetos (sempre os mesmos para o mesmo bloco: semente do bloco) ----------
function spawn(b)
 b.objs={}
 if(b.g<2) return
 local keep,base=rnd(0x7fff),(b.g-org)*32
 srand(b.seed)
 local function ad(o) o.b=b o.al=true add(b.objs,o) end
 local function dr() return rnd()<.5 and 1 or -1 end
 if b.br then
  -- tanque atravessando a ponte pela estrada
  if rnd()<.6 then local d=dr() ad{t="tank",road=true,x=d>0 and 2 or 117,y=12,w=9,h=5,dir=d,aim=d,vx=.25+min(b.s,8)*.025,mn=0,mx=119} end
 else
  local k=rnd()
  local t=k<.26 and "fuel" or k<.46 and "ship" or k<.66 and "heli" or k<.78 and "house" or k<.9 and "tank" or "balloon"
  local w,h=unpack(dims[t])
  -- zona de respiro depois da ponte: sem inimigos
  if b.b>=3 or t=="fuel" or t=="house" then
   for tr=1,30 do
    local yi=3+flr(rnd(26-h)) local y=base+yi
    if t=="house" or t=="tank" then
     local lf,lm,rm,x=rnd()<.5,999,-999
     for yy=y,y+h do local c,i=la(yy) lm,rm=min(lm,c.l[i]),max(rm,c.r[i]) end
     if lf and lm>=26 then x=3+rnd(lm-w-6) elseif not lf and 128-rm>=26 then x=rm+3+rnd(122-rm-w) end
     if x and not cliffhit(x-1,x+w+1,y,y+h) then
      if t=="house" then ad{t=t,x=x,y=yi,w=w,h=h,s=rnd()<.5 and "house1" or "house2"}
      else ad{t=t,x=x,y=yi,w=w,h=h,dir=dr(),aim=lf and 1 or -1,vx=.175,mn=lf and 2 or rm+3,mx=lf and lm-w-3 or 126-w,cool=40+rnd(80)} end
      break
     end
    else
     local x=7+rnd(114-w)
     if wf(x,x+w,y,y+h) then
      ad{t=t,x=x,y=yi,w=w,h=h,dir=dr(),vx=t=="balloon" and .125+rnd(.1) or t=="ship" and .3+min(b.s,10)*.03 or .45+min(b.s,10)*.04,
       mv=t!="fuel" and rnd()<.8,asp=.6+rnd(.8),aph=rnd(),hue=rnd()<.5,ph=rnd()}
      break
     end
    end
   end
  end
  -- aviao que cruza a tela quando o jogador se aproxima
  if(b.g>3 and b.b>=3 and rnd()<.18) ad{t="plane",x=-99,y=22,w=12,h=6,dir=dr(),vx=1.1+min(b.s,10)*.05}
  -- power-up (modern)
  if md==2 and rnd()<.16 then
   local k,kd=rnd(),5
   for j=1,5 do if k<puw[j] then kd=j break end k-=puw[j] end
   for tr=1,12 do
    local x,yi=5+rnd(111),4+rnd(20)
    if not cliffhit(x-2,x+9,base+yi,base+yi+7) then ad{t="pu",k=kd,x=x,y=yi,w=7,h=7,ph=rnd()} break end
   end
  end
 end
 srand(keep)
end

-- decoracao das margens: bosques, campos cercados com vacas, arvores soltas
function deco(b)
 if(b.dc) return b.dc
 local keep,d=rnd(0x7fff),{}
 srand(b.seed+.5)
 for lf in all{true,false} do
  local function lo(i) return lf and 2 or b.r[i]+5 end
  local function hi(i) return lf and b.l[i]-5 or 126 end
  local function tree(x,i)
   i=mid(1,flr(i+.5),30)
   if(not (b.br and i>=7 and i<=27) and x-3>=lo(i) and x+3<=hi(i)) add(d,{k=rnd()<.45 and "pine" or "tree",x=x,i=i})
  end
  local z=rnd()
  if z<.4 then
   local ci=6+rnd(20) local i0=flr(ci) local l,h=lo(i0),hi(i0)
   if h-l>=7 then
    local cx,s=l+rnd(h-l),min(h-l,30)
    for k=1,8+rnd(9) do tree(cx+(rnd()-.5)*s,ci+(rnd()-.5)*16) end
   end
  elseif z<.72 then
   local a=2+flr(rnd(12)) local t,x0,x1=min(29,a+8+flr(rnd(7))),-999,999
   for i=a,t do x0,x1=max(x0,lo(i)),min(x1,hi(i)) end
   local w=min(x1-x0,17+rnd(28))
   if w>=15 and not b.br then
    local fx=x0+rnd(x1-x0-w)
    add(d,{f=true,x=fx,x1=fx+w,i=a,i1=t})
    for k=1,1+rnd(min(4,w/8)) do add(d,{k="cow",x=fx+3+rnd(w-8),i=a+2+rnd(t-a-4),fl=rnd()<.5}) end
    tree(fx-2,t) tree(fx+w+2,a+2)
   end
  else
   for k=1,2+rnd(4) do local i=1+rnd(29) local j=flr(i) tree(lo(j)+rnd(max(0,hi(j)-lo(j))),i) end
  end
 end
 srand(keep)
 b.dc=d
 return d
end

-- ---------- partida ----------
function newgame()
 blk={} nb=0 org=0 score=0 lives=3 nextl=1000 cp=0
 respawn()
end

function respawn()
 for g=cp,nb-1 do local b=blk[g] if b then b.brk=false spawn(b) end end
 scroll=(cp-org)*32+(cp>0 and 20 or 0)
 py=15 safe=150 hp=100 hurtt=0 bank=0 bt=0 bs=0 fc=0 lk=btn(4)
 local b,i=la(scroll+py)
 px=(b.l[i]+b.r[i])/2-4.5
 fuel=100 mis={} fx={} sh={} vis={} pw={0,0,0} st="play"
end

function addsc(n)
 score+=n
 if score>=nextl then nextl+=1000 lives+=1 sfx(6) end
end

function hurt(d)
 if md==1 then kill() return true end
 if(hurtt>0 or safe>0) return
 hp-=d hurtt=45 sfx(8)
 if hp<=0 then hp=0 kill() return true end
end

function kill()
 if(st!="play") return
 st="dying" dying=70
 boom(px+4.5,scroll+py+5,"player")
end

function boom(x,y,k)
 local big=k=="player" or k=="bridge" or k=="fuel"
 local e={x=x,y=y,t=big and 60 or 40,r=big and 11 or 6,parts={}}
 e.life=e.t
 for j=1,big and 26 or 14 do
  local a,v=rnd(),.3+rnd(big and 1.6 or 1.1)
  add(e.parts,{x=0,y=0,vx=cos(a)*v,vy=sin(a)*v-.4,c=rnd(fxc[k] or fxc.heli)})
 end
 add(fx,e) sfx(big and 2 or 1)
end

function label(x,y,s,c) add(fx,{x=x,y=y,t=60,life=60,lab=s,c=c,parts={}}) end

function getpu(o)
 local k=o.k
 o.al=false
 if(k<4) pw[k]=k==1 and 480 or 600
 if(k==5) lives+=1 hp=100
 if(k==4) smart()
 addsc(5) sfx(5)
 label(o.x+3,wy(o)+3,pun[k],puc[k])
end

-- bomba: destroi todos os inimigos na tela
function smart()
 for o in all(vis) do
  local sy=row(wy(o)+o.h)
  if o.al and pts[o.t] and o.t!="fuel" and sy>-o.h and sy<128 and (o.t!="plane" or o.act) then
   o.al=false addsc(pts[o.t]) boom(o.x+o.w/2,wy(o)+o.h/2,o.t)
  end
 end
 sh={}
end

-- objetos dos blocos visiveis
function gather()
 vis={}
 local cg=flr(scroll/32)+org
 gb(cg+7)
 for g=max(cg-1,0),cg+5 do local b=blk[g] if b then for o in all(b.objs) do if o.al then add(vis,o) end end end end
end

function moveobj(o)
 local sy=row(wy(o)+o.h)
 if o.t=="plane" then
  if(not o.act and sy<75 and sy>0) o.act=true o.x=o.dir>0 and -12 or 128
  if o.act then o.x+=o.dir*o.vx if o.x<-14 or o.x>130 then o.al=false end end
 elseif o.t=="tank" then
  if sy>-15 and sy<128 then
   o.x+=o.dir*o.vx
   if o.x<o.mn or o.x>o.mx then o.dir=-o.dir o.x=mid(o.mn,o.x,o.mx) end
   if o.road then
    -- na ponte: cai junto com ela
    local b,cx=o.b,o.x+4.5
    o.aim=o.dir
    if b.brk and cx>b.l[16] and cx<b.r[16] then o.al=false boom(cx,wy(o)+2,"tank") end
   elseif st=="play" and sy>20 and sy<97 then
    o.cool-=1
    if o.cool<=0 then o.cool=110+rnd(90) add(sh,{x=o.aim>0 and o.x+10 or o.x-1,y=wy(o)+4,vx=o.aim*.9}) sfx(7) end
   end
  end
 elseif o.t=="balloon" then
  o.x+=o.dir*o.vx
  if(o.x<2 or o.x>126-o.w) o.dir=-o.dir
 elseif sy>-20 and sy<128 then
  if o.t=="heli" then
   -- altitude: o tamanho muda, o centro fica
   local cx,cy=o.x+o.w/2,o.y+o.h/2
   o.alt=.85+.3*sin(fr*.0016*o.asp+o.aph)
   o.w,o.h=13*o.alt,9*o.alt
   o.x,o.y=cx-o.w/2,cy-o.h/2
  end
  if o.mv then
   local nx,y=o.x+o.dir*o.vx,wy(o)
   if wf(nx,nx+o.w,y,y+o.h) then o.x=nx else o.dir=-o.dir end
  end
 end
end

-- ---------- passo ----------
function _update60()
 fr+=1
 if st=="title" then
  if(btnp(2) or btnp(3)) md=3-md
  if(btnp(4) or btnp(5)) newgame()
  return
 end
 for e in all(fx) do
  e.t-=1
  for p in all(e.parts) do p.x+=p.vx p.y+=p.vy p.vy+=.05 end
  if(e.t<=0) del(fx,e)
 end
 if st=="over" then
  overt+=1 scroll+=.4 gather() foreach(vis,moveobj)
  if(overt>40 and (btnp(4) or btnp(5))) st="title"
  return
 end
 if st=="dying" then
  dying-=1
  if dying<=0 then
   lives-=1
   if lives>0 then respawn() else
    st="over" overt=0 sh={} mis={}
    if(score>dget(md)) dset(md,score)
   end
  end
  return
 end
 play()
 -- o numero do pico-8 vai ate 32767: de tempos em tempos a origem do mundo anda 256 blocos
 if scroll>8192 then
  org+=256 scroll-=8192
  for l in all{mis,sh,fx} do for e in all(l) do e.y-=8192 end end
 end
 -- descarta os blocos que ficaram para tras
 if fr%60==0 then
  local lo=min(cp,flr(scroll/32)+org)-2
  for g,b in pairs(blk) do if g<lo then blk[g]=nil end end
 end
end

function play()
 local cg=flr(scroll/32)+org
 local lvl,vert,stx=1+min(cg\16,8)*.07,(btn(2) and 1 or 0)-(btn(3) and 1 or 0),(btn(1) and 1 or 0)-(btn(0) and 1 or 0)
 local spd
 if md==2 then
  -- modern: camera constante; o jato sobe e desce pela tela (sem entrar no hud)
  spd=.625*lvl py=mid(15,py+vert,100)
 else
  -- classic: o jato fica embaixo; cima acelera, baixo freia
  spd=(.55+(vert>0 and .4 or .25)*vert)*lvl
 end
 px+=stx bank+=(stx-bank)*.18 scroll+=spd
 for i=1,3 do pw[i]=max(pw[i]-1,0) end
 safe,hurtt,fc=max(safe-1,0),max(hurtt-1,0),max(fc-1,0)
 -- rajada: 10 tiros (um a cada 4 quadros) por no maximo 1 s; tiro rapido: 15 a cada 3
 if not btn(4) then bt,bs,lk=0,0,false
 elseif not lk then
  bt+=1
  if bt>60 or bs>=(pw[3]>0 and 15 or 10) then lk=true
  elseif fc<=0 then
   local x,y=px+4,scroll+py+10
   bs+=1 add(mis,{x=x,y=y,vx=0})
   if(pw[2]>0) add(mis,{x=x-1,y=y-1,vx=-.55}) add(mis,{x=x+1,y=y-1,vx=.55})
   fc=pw[3]>0 and 3 or 4 sfx(0)
  end
 end
 -- combustivel (classic)
 if md==1 then
  fuel-=spd>.75*lvl and .048 or .04
  if(fuel<25 and fr%20==0) sfx(4)
  if fuel<=0 then fuel=0 kill() return end
 end
 -- terreno
 local pb,pt=scroll+py,scroll+py+10
 if md==1 then
  for y=pb,pt do
   local b,i=la(y)
   if px<b.l[i] or px+9>b.r[i] or b.ir[i]>b.il[i] and px+9>b.il[i] and px<b.ir[i] or b.br and not b.brk and i>=10 and i<=21 then kill() return end
  end
 else
  px=mid(0,px,119)
  if cliffhit(px+1,px+8,pb+1,pt-1) then
   -- bater no paredao tira 40 de vida e empurra o jato para fora da rocha
   local b,i=la(pb+5) local cx,d=px+4.5,0
   if b.cl[i]>0 and cx<b.l[i]+9 then d=cx<b.l[i]-b.cl[i]/2 and -1 or 1
   elseif b.cr[i]>0 then d=cx>b.r[i]+b.cr[i]/2 and 1 or -1 end
   px=mid(0,px+d*4,119)
   if(hurt(40)) return
  end
 end
 -- checkpoint ao passar pela ponte
 local b,i=la(pb)
 if(b.br and i>21) cp=max(cp,b.g+1)
 -- objetos
 gather()
 for o in all(vis) do
  moveobj(o)
  local y=wy(o)
  if o.al and px+8>o.x+.5 and px+1<o.x+o.w-.5 and pt>y+.5 and pb<y+o.h-.5 and (o.t!="plane" or o.act) then
   if o.t=="fuel" then
    if md==1 then fuel=min(100,fuel+1) elseif hp<100 then hp=min(100,hp+.8) end
    if(fr%4==0) sfx(3)
   elseif o.t=="pu" then getpu(o)
   elseif safe>0 and o.t!="house" or md==2 and (o.t=="house" or o.t=="tank") then
   elseif o.t=="house" then kill() return
   else
    o.al=false boom(o.x+o.w/2,y+o.h/2,o.t)
    if pw[1]>0 then addsc(1) elseif hurt(35) then return end
   end
  end
 end
 -- tiros dos tanques
 for s in all(sh) do
  s.x+=s.vx
  if s.x>px+.5 and s.x<px+8.5 and s.y>pb and s.y<pt then
   del(sh,s)
   if(pw[1]<=0 and safe<=0 and hurt(12)) return
  elseif(s.x<-3 or s.x>131) then del(sh,s) end
 end
 -- misseis
 for m in all(mis) do
  m.y+=4.5 m.x+=m.vx
  local y0,y1=m.y,m.y+4
  local hit,b,i=m.y>scroll+128 or m.x<-2 or m.x>130,la(y1)
  if md==1 then
   if(m.x<b.l[i] or m.x>b.r[i] or b.ir[i]>b.il[i] and m.x>b.il[i] and m.x<b.ir[i]) hit=true
  elseif cliffhit(m.x,m.x+1,y1,y1) then hit=true end
  if not hit then
   for o in all(vis) do
    local y=wy(o)
    if o.al and pts[o.t] and (o.t!="plane" or o.act) and m.x+1>o.x and m.x<o.x+o.w and y1>y and y0<y+o.h then
     hit=true o.al=false addsc(pts[o.t]) boom(o.x+o.w/2,y+o.h/2,o.t)
     break
    end
   end
  end
  -- a ponte e testada depois dos objetos (o tanque sobre ela pode ser atingido)
  if not hit and b.br and not b.brk and i>=10 and i<=21 and m.x>b.l[16]-1.5 and m.x<b.r[16]+1.5 then
   b.brk,hit=true,true addsc(50) boom(b.ec,(b.g-org)*32+16,"bridge")
  end
  if(hit) del(mis,m)
 end
end

-- ---------- desenho ----------
function _draw()
 if(st=="title") return title()
 cls(12)
 -- terreno, uma linha de tela por linha do mapa
 for r=0,127 do
  local b,i=la(scroll+127-r)
  local land,edge,l,rr=b.lt and 11 or 3,b.lt and 3 or 1,flr(b.l[i]+.5),flr(b.r[i]+.5)
  if(b.wv[i]) line(l+3+b.wv[i]*(rr-l-8),r,l+5+b.wv[i]*(rr-l-8),r,7)
  line(0,r,l-1,r,land) line(rr,r,127,r,land)
  pset(l-1,r,edge) pset(rr,r,edge)
  local c,d=flr(b.cl[i]+.5),flr(b.cr[i]+.5)
  local k=b.wv[i] or .5
  if c>0 then line(l-c,r,l-1,r,5) pset(l-c-1,r,0) pset(l-1,r,6) pset(l-c+k*c,r,13) end
  if d>0 then line(rr,r,rr+d-1,r,5) pset(rr+d,r,0) pset(rr,r,6) pset(rr+k*d,r,13) end
  if b.ir[i]>b.il[i] then local a,e=flr(b.il[i]+.5),flr(b.ir[i]+.5) line(a,r,e-1,r,3) pset(a,r,1) pset(e-1,r,1) end
  if b.br and i>=10 and i<=21 then
   -- estrada e ponte
   local e=i==10 or i==21
   line(0,r,127,r,e and 6 or 5)
   if i==15 then
    for x=0,127,6 do if(x<l-2 or x>rr+1) line(x,r,x+2,r,10)
    end
   end
   if b.brk then line(l,r,rr-1,r,12) else line(l-1,r,rr,r,e and 0 or 4) end
  end
 end
 -- decoracao
 local cg=flr(scroll/32)+org
 for g=max(cg-1,0),cg+5 do
  local b=blk[g]
  if b then
   local base=row((g-org)*32)
   if(b.lt) pal(11,3)
   for d in all(deco(b)) do
    if d.f then
     rectfill(d.x,base-d.i1,d.x1,base-d.i,b.lt and 3 or 11)
     for x=d.x,d.x1,3 do pset(x,base-d.i1-1,4) pset(x,base-d.i+1,4) end
    else spb(d.k,d.x,base-d.i+1,d.fl) end
   end
   rp()
  end
 end
 -- objetos
 for o in all(vis) do
  local by,cx=row(wy(o))+1,o.x+o.w/2
  local t=o.t
  if(t=="fuel") spb("fuel",cx,by)
  if(t=="ship") spb("ship",cx,by,o.dir>0)
  if(t=="house") spb(o.s,cx,by)
  if(t=="tank") spb("tank",cx,by,o.aim<0)
  if(t=="balloon") spb(o.hue and "bal1" or "bal0",cx,by+flr(sin(fr*.008+o.ph)+.5))
  if(t=="plane" and o.act) spc("plane",cx,by-3,o.dir<0)
  if t=="pu" then
   if(fr%30<6) pal(pud[o.k],7)
   spc("pu"..o.k,cx,by-3+sin(fr*.013+o.ph)) rp()
  end
  if t=="heli" then
   local r,a=sr["heli"..fr\4%2],o.alt or 1
   sspr(r[2],r[3],14,8,cx-7*a,by-8*a,14*a,8*a,o.dir>0)
  end
 end
 -- tiros e misseis
 for s in all(sh) do rectfill(s.x-1,row(s.y)-1,s.x,row(s.y),fr%6<3 and 9 or 8) end
 for m in all(mis) do line(m.x,row(m.y+4),m.x,row(m.y+4)+3,10) end
 -- explosoes: bolas de fogo que esfriam (branco > amarelo > laranja > vermelho) e faiscas
 for e in all(fx) do
  local age,cx,cy=e.life-e.t,e.x,row(e.y)
  if e.r then
   local q=age/(e.life*.6)
   if q<1 then
    local rad=e.r*(.35-.65*sin(q/2))
    circfill(cx,cy,rad,({7,10,9,8,2})[flr(q*5)+1])
    if(q<.6) circfill(cx,cy,rad*.5,q<.3 and 7 or 10)
   end
  end
  for p in all(e.parts) do if e.t>8 or fr%2==0 then pset(cx+p.x,cy+p.y,p.c) end end
  if e.lab and (e.t>12 or fr%4<2) then
   local w=#e.lab*4-1
   op(e.lab,mid(1,cx-w/2,126-w),cy-9-age*.25,e.c)
  end
 end
 -- jato
 if st=="play" then
  local lv,jy=mid(-2,flr(bank*2+.5),2),118-py
  local n="jet"..abs(lv)
  if md==2 then
   -- sombra no chao; pisca quando protegido
   for c=1,15 do pal(c,1) end
   sp(n,px+4,jy+5,lv<0) rp()
  end
  if(md==1 or (safe==0 and hurtt==0) or fr%10>=5) sp(n,px,jy,lv<0)
  if(pw[1]>0 and (pw[1]>=90 or fr%10>=5)) circ(px+4.5,jy+5,7+fr\8%2,12)
 end
 hud()
end

function hud()
 op(sc6(score),2,115,7)
 -- vidas (o jato em jogo nao conta)
 local r=sr.jet0
 for k=1,min(lives-(st=="play" and 1 or 0),5) do sspr(r[2],r[3],9,10,126-k*7,115,6,6) end
 local f,c
 if md==1 then
  -- combustivel: e [barra] f, vermelho e piscando no fim
  f=mid(0,fuel/100,1) c=f<.25 and 8 or 10
  op("e",4,122,6) op("f",52,122,6)
 else
  f=mid(0,hp/100,1) c=f>.5 and 11 or f>.25 and 10 or 8
  op("♥",1,122,8)
  local x=60
  for k=1,3 do
   if pw[k]>0 then
    sp("pu"..k,x,119) line(x,127,x+6*pw[k]/(k==1 and 480 or 600),127,puc[k])
    x+=9
   end
  end
 end
 rect(9,121,49,127,0) rectfill(10,122,48,126,1)
 if(f>=.25 or fr%20<10) rectfill(10,122,10+38*f,126,c)
 op(modes[md],126-#modes[md]*4,122,13)
 if st=="over" then
  rectfill(14,34,113,78,0) rectfill(15,35,112,77,1)
  print("game over",46,40,10)
  print(sc6(score),52,49,7)
  print("best "..sc6(dget(md)),40,58,6)
  print("🅾️ back to menu",34,68,12)
 end
end

function title()
 cls(1)
 -- um rio de enfeite
 for r=0,127 do
  local c=64+sin(r/97+fr/900)*14+sin(r/41)*6
  line(0,r,c-30,r,3) line(c+30,r,127,r,3) pset(c-31,r,1) pset(c+30,r,1)
  line(c-29,r,c+29,r,12)
 end
 op("river",44,14,10) op("pico-8",76,14,8)
 for k=1,2 do
  local y=40+k*16
  rectfill(18,y-3,109,y+7,k==md and 0 or 1)
  op((k==md and "▶ " or "  ")..modes[k],22,y,k==md and 10 or 6)
  op(sc6(dget(k)),83,y,k==md and 7 or 13)
 end
 op(mdesc[md],8,90,7)
 op("⬆️⬇️ mode  🅾️ start",20,108,12)
 op("⬅️➡️ steer  🅾️ fire",22,116,6)
end
__gfx__
eeeeaeeeeeeeeeaeeeeeeeeeaeeeeee8888eeeeeaeee11111eee44444eee99999eee22222eee33333eeeeeeeeeeeee0eeeeeeeeeeeaaaaaaaaaaeeeeeeeeeeee
eeeeaeeeeeeeeeaeeeeeeeeeaeeeee888888ee888ee1c777c1e4797974e9aa7aa9e2888782e3bb7bb3eeeeeeeeee07770eeeeeeeeeeeee0eeeeeeeeeeeeeeeee
eeeaaaeeeeeeeaaaeeeeeeeaaaeeee777777e87888e1777771e4797974e9a777a9e2877782e3bb7bb3eee5eeeee0777770eeeeeeeee11111eeeeeeeeeeeeeeee
eeea1aeeeeeeeaa1eeeeeeeaa1eeee777777e88888e1777771e4797974e97a7a79e2777772e3777773e888888888888888888eeeee1cc11111111aeeeeeeeeee
eeaaaaaeeeeeaaaaaeeeeaaaaa9eee888888ee888ee1c777c1e4797974e9aa7aa9e2777772e3bb7bb3ee88222222222222888eeeee1c11111111eeeeeeeeeeee
e9aaaaaaeeeaaaaaa9eeaaaaaa9eee888888eeeeeee1cc7cc1e4797974e9a777a9e2877782e3bb7bb3eee2222222222222288eeeeee11111eeeeeeeeeeeeeeee
99aaaaaaaeaaaaaaa9eeaaaaaa9eee777777eeeeeeee11111eee44444eee99999eee22222eee33333eeeeeeeeeeeeeeeeeeeeeeeeee0eee0eeeeeeeeeeeeeeee
eeeaaaeeeeeeeaaaeeeeeeeaa9eeee777777eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee0000000eeeeeeeeeeeeeee
ee9aaa9eeeeeaaa9eeeeeeaaa9eeee888888eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eee8e8eeeeeee8e8eeeeeee8e8eeee888888eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeee777777eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeee7777eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeaaaaeeeeeeeeedeeeeeeeeeeeeeee111eeeeeeeeeeeeeeee888eeeeeeeeeeeee333eeeeeeee8888eeeeeee9999eeeeebeeebee777eeeeeeeeeeeeeeeeee
eeeeee0eeeeeeeeeeddeeeeeeeeeeeee1111111eeeeeeeeeeee8888888eeeeeeeeee3333300eeee877888eeeee9aa999eeebbbeebee707eeeeeeeeeeeeeeeeee
eee11111eeeeeeed66666666667eee11111111111eee3eeee88888888888eee3eee33333333eee88777888eee99aaa999eebbbebbbee5e5eeeeeeeeeeeeeeeee
ee1cc11111111aed66666666667ee1111111111111e333ee8888888888888e333e555555555eee88777888eee99aaa999eee4eebbbeeeeeeeeeeeeeeeeeeeeee
ee1c11111111eeeeeddeeeeeeeeeee7777777776eee333eee7777777776eee333ee0e0e0e0eeee88777888eee99aaa999eeeeeee4eeeeeeeeeeeeeeeeeeeeeee
eee11111eeeeeeeeeedeeeeeeeeeee7cc77c7776eee333eee7cc77c7776eee333eeeeeeeeeeeeee877888eeeee9aa999eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eee0eee0eeeeeeeeeeeeeeeeeeeeee7cc77c7776eeee4eeee7cc77c7776eeee4eeeeeeeeeeeeeeee8778eeeeeee9aa9eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
ee0000000eeeeeeeeeeeeeeeeeeeee777774477eeeee4eeee777774477eeeee4eeeeeeeeeeeeeeeee78eeeeeeeeea9eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeee777774477eeeee4eeee777774477eeeee4eeeeeeeeeeeeeeee5ee5eeeeeee5ee5eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee5ee5eeeeeee5ee5eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee4444eeeeeee4444eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee4444eeeeeee4444eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
__sfx__
000100002c33026323000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000300001e6501b6501864015640126300f6300c62009620000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000500001a67018670166601466012650106500e6400c6400a6300863006620046200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000100002803000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000400001a33000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00030000180401c0401f0402404500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00040000240502b050300503705500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200001632300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000200000e3500a343000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000c00001324010240132401024500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00090000166701567014670136701267011670106600f6600e6500d6500c6400b6400a63009630086200762000000000000000000000000000000000000000000000000000000000000000000000000000000000
000600001803124031280250000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000100003432000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
