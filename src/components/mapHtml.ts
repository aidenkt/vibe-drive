export const mapHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.css">
<style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0;overflow:hidden;background:#f7f7f5}
.maplibregl-canvas{image-rendering:crisp-edges;image-rendering:pixelated}
.maplibregl-ctrl-attrib,.maplibregl-ctrl-logo{display:none!important}
.attrib{position:absolute;left:0;right:0;bottom:2px;text-align:center;font:7px/1.4 monospace;color:#8a8a8a;pointer-events:none;z-index:5;letter-spacing:.2px}
.car{width:40px;height:40px;filter:drop-shadow(3px 4px 0 #14110f55)}
.car svg{width:40px;height:40px;display:block}
.pin{width:14px;height:14px;border-radius:50%;background:#F2EADB;border:3px solid #14110F}
</style></head><body>
<div id="map"></div><div class="attrib">OpenFreeMap &copy; OpenMapTiles &copy; OpenStreetMap</div>
<script src="https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.js"></script>
<script>
(function(){
'use strict';
var STYLE='https://tiles.openfreemap.org/styles/positron';
var DEM='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
var LAND='#fbf8f2',PARK='#eef3e6',WATER='#4fb3d9',SHORE='#a6e3f2',TRAIL='#f2e3c2',TRAIL_EDGE='#b08d63';
var carSvg='<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><path d="M4 1h8v1h1v2h1v9h-1v2H3v-2H2V4h1V2h1z" fill="#293c43"/><path d="M4 2h8v3h1v7h-1v2H4v-2H3V5h1z" fill="#ffbd47"/><path d="M5 4h6v3H5z" fill="#b9ebeb"/><path d="M5 4h2v3H5z" fill="#eff9df"/><path d="M4 8h8v3H4z" fill="#f5853c"/><path d="M5 11h6v2H5z" fill="#4b7880"/><path d="M3 3h2v2H3zm8 0h2v2h-2z" fill="#fff7c4"/><path d="M3 12h2v2H3zm8 0h2v2h-2z" fill="#e95467"/></svg>';
var map=null,ready=false,pending=null,fast=[],vibe=[],pins=[],car=null,drawAnim=null,playback=null;

function post(o){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}}

function scaleWidth(w,f){
  var mul=function(v){return typeof v==='number'?v*f:['*',f,v]};
  if(w==null)return f;
  if(typeof w==='number')return w*f;
  if(Array.isArray(w)){
    if(/^interpolate/.test(w[0])){var o=w.slice(0,3);for(var i=3;i<w.length;i+=2)o.push(w[i],mul(w[i+1]));return o}
    if(w[0]==='step'){var o2=[w[0],w[1],mul(w[2])];for(var j=3;j<w.length;j+=2)o2.push(w[j],mul(w[j+1]));return o2}
    return ['*',f,w];
  }
  if(w.stops)return {base:w.base,stops:w.stops.map(function(st){return [st[0],st[1]*f]})};
  return w;
}
function roadFactor(id){return /motorway|trunk/.test(id)?2.5:/primary|secondary/.test(id)?2:1.5}
function restyle(style){
  style.layers=style.layers.filter(function(l){
    var sl=l['source-layer'];
    return l.type!=='symbol'&&l.type!=='raster'&&l.type!=='fill-extrusion'&&sl!=='building'&&!/^boundary/.test(l.id)&&!/railway/.test(l.id)&&!/casing/.test(l.id);
  });
  var roads=[],casings=[];
  style.layers.forEach(function(l){
    var p=l.paint=l.paint||{};var sl=l['source-layer'];
    if(l.type==='background'){p['background-color']=LAND;return}
    if(sl==='water'&&l.type==='fill'){p['fill-color']=WATER;p['fill-opacity']=1;p['fill-antialias']=false;delete p['fill-outline-color'];return}
    if(sl==='waterway'){p['line-color']=WATER;p['line-opacity']=1;return}
    if(l.type==='fill'){p['fill-color']=(sl==='park'||sl==='landcover')?PARK:LAND;p['fill-opacity']=1;delete p['fill-outline-color'];return}
    if(l.type==='line'&&(sl==='transportation'||sl==='aeroway')){
      var f=roadFactor(l.id),w=p['line-width'];
      p['line-color']=TRAIL;p['line-opacity']=1;p['line-width']=scaleWidth(w,f);
      var c=JSON.parse(JSON.stringify(l));c.id=l.id+'-edge';c.paint['line-color']=TRAIL_EDGE;c.paint['line-width']=scaleWidth(w,f*1.7);delete c.paint['line-dasharray'];
      casings.push(c);roads.push(l);
    }
  });
  style.layers=style.layers.filter(function(l){return roads.indexOf(l)<0});
  var water=style.layers.filter(function(l){return l['source-layer']==='water'});
  style.layers=style.layers.filter(function(l){return l['source-layer']!=='water'});
  var shore=water.length?[{id:'shoreline',type:'line',source:water[0].source,'source-layer':'water',paint:{'line-color':SHORE,'line-width':2}}]:[];
  style.sources.demTerrain={type:'raster-dem',tiles:[DEM],encoding:'terrarium',tileSize:256,maxzoom:14};
  style.sources.demShade={type:'raster-dem',tiles:[DEM],encoding:'terrarium',tileSize:256,maxzoom:14};
  var shade={id:'hillshade',type:'hillshade',source:'demShade',paint:{'hillshade-shadow-color':'#7f8fc7','hillshade-highlight-color':'#ffffff','hillshade-accent-color':'#a9b6e6','hillshade-exaggeration':0.9,'hillshade-illumination-direction':300}};
  style.layers=style.layers.concat([shade],water,shore,casings,roads);
  style.terrain={source:'demTerrain',exaggeration:2.2};
  style.sky={'sky-color':'#9fd3ff','horizon-color':'#fff1d6','fog-color':'#fff6e8','sky-horizon-blend':0.7,'horizon-fog-blend':0.6,'fog-ground-blend':0.92,'atmosphere-blend':0};
  return style;
}

function flatStyle(){return {version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':LAND}}]}}

function emptyLine(){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}}
function lineOf(pts){return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:pts.map(function(p){return [p[1],p[0]]})}}}
function gradient(t,c){t=Math.max(0.0001,Math.min(0.9999,t));return ['step',['line-progress'],c||'#ff5a1f',t,'rgba(255,255,255,0)']}
function reveal(t){reveal(t);map.setPaintProperty('vibe-casing','line-gradient',gradient(t,'#ffffff'))}

function addRouteLayers(){
  map.addSource('fast',{type:'geojson',data:emptyLine()});
  map.addSource('vibe',{type:'geojson',data:emptyLine(),lineMetrics:true});
  map.addLayer({id:'fast-line',type:'line',source:'fast',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#8a8fa3','line-width':4,'line-dasharray':[2,1.5]}});
  map.addLayer({id:'vibe-casing',type:'line',source:'vibe',layout:{'line-join':'round','line-cap':'round'},paint:{'line-width':11,'line-gradient':gradient(1,'#ffffff')}});
  map.addLayer({id:'vibe-line',type:'line',source:'vibe',layout:{'line-join':'round','line-cap':'round'},paint:{'line-width':7,'line-gradient':gradient(1)}});
}

function create(style){
  try{
    map=new maplibregl.Map({container:'map',style:style,center:[-117.1611,32.7157],zoom:11,pitch:62,bearing:-20,maxPitch:85,pixelRatio:0.5,attributionControl:false,antialias:false,fadeDuration:0});
  }catch(e){map=null;post({type:'ready'});return}
  map.on('error',function(e){if(window.console)console.warn('map error',e&&e.error&&e.error.message)});
  map.on('load',function(){
    try{addRouteLayers()}catch(e){}
    ready=true;post({type:'ready'});
    if(pending){var d=pending;pending=null;draw(d)}
  });
}

function valid(points){return Array.isArray(points)?points.filter(function(p){return Array.isArray(p)&&p.length>=2&&isFinite(p[0])&&isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180}).map(function(p){return [+p[0],+p[1]]}):[]}

function pin(p){var el=document.createElement('div');el.className='pin';pins.push(new maplibregl.Marker({element:el,opacityWhenCovered:'1'}).setLngLat([p[1],p[0]]).addTo(map))}

function placeCar(p,heading){
  if(!car){var el=document.createElement('div');el.className='car';el.innerHTML=carSvg;car=new maplibregl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'viewport',opacityWhenCovered:'1'}).setLngLat([p[1],p[0]]).addTo(map)}
  car.setLngLat([p[1],p[0]]);if(heading!=null)car.setRotation(heading);
}

function fit(){
  var all=fast.concat(vibe);if(!all.length)return;
  var b=new maplibregl.LngLatBounds();all.forEach(function(p){b.extend([p[1],p[0]])});
  try{map.fitBounds(b,{padding:{top:170,bottom:380,left:40,right:40},pitch:55,bearing:-20,maxZoom:14,duration:1200})}catch(e){map.fitBounds(b,{padding:40})}
}

function rad(d){return d*Math.PI/180}
function dist(a,b){var dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)*Math.sin(dLng/2);return 12742000*Math.asin(Math.sqrt(h))}
function bearing(a,b){var y=Math.sin(rad(b[1]-a[1]))*Math.cos(rad(b[0]));var x=Math.cos(rad(a[0]))*Math.sin(rad(b[0]))-Math.sin(rad(a[0]))*Math.cos(rad(b[0]))*Math.cos(rad(b[1]-a[1]));return (Math.atan2(y,x)*180/Math.PI+360)%360}

function draw(data){
  playback=null;if(drawAnim)cancelAnimationFrame(drawAnim);drawAnim=null;map.stop();
  fast=valid(data.fast);vibe=valid(data.vibe);
  pins.forEach(function(m){m.remove()});pins=[];
  if(map.getSource('fast'))map.getSource('fast').setData(fast.length?lineOf(fast):emptyLine());
  if(map.getSource('vibe'))map.getSource('vibe').setData(vibe.length?lineOf(vibe):emptyLine());
  var route=vibe.length?vibe:fast;
  var wps=data.drive&&Array.isArray(data.drive.waypoints)?valid(data.drive.waypoints.map(function(p){return p&&[p.lat,p.lng]})):[];
  if(wps.length){pin(wps[0]);pin(wps[wps.length-1])}
  if(route.length){pin(route[route.length-1]);placeCar(route[0],route.length>1?bearing(route[0],route[Math.min(route.length-1,5)]):0)}
  fit();
  if(map.getLayer('vibe-line')){
    var start=performance.now();
    var step=function(now){var t=Math.min(1,(now-start)/1200);reveal(t);drawAnim=t<1?requestAnimationFrame(step):null};
    reveal(0);drawAnim=requestAnimationFrame(step);
  }
}

function at(p,d){
  while(p.seg<p.cum.length-1&&p.cum[p.seg]<d)p.seg++;
  var i=p.seg,len=p.cum[i]-p.cum[i-1],t=len?(d-p.cum[i-1])/len:1,a=vibe[i-1],b=vibe[i];
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}

function play(){
  if(!map||vibe.length<2)return;
  var cum=[0];for(var i=1;i<vibe.length;i++)cum.push(cum[i-1]+dist(vibe[i-1],vibe[i]));
  var total=cum[cum.length-1];if(!total)return;
  if(drawAnim){cancelAnimationFrame(drawAnim);drawAnim=null;reveal(1)}
  map.stop();
  var startBearing=bearing(vibe[0],vibe[Math.min(vibe.length-1,5)]);
  placeCar(vibe[0],startBearing);
  var token={};playback=token;
  var zoom=Math.max(10.5,Math.min(14.5,14-Math.log(total/15000)/Math.LN2));
  map.easeTo({center:[vibe[0][1],vibe[0][0]],zoom:zoom,pitch:65,bearing:startBearing,duration:1200});
  setTimeout(function(){
    if(playback!==token)return;
    var p={cum:cum,seg:1},la={cum:cum,seg:1},cam=startBearing,t0=performance.now(),look=Math.min(600,total*0.04);
    var frame=function(now){
      if(playback!==token)return;
      var prog=Math.min(1,(now-t0)/20000),d=total*prog;
      var pos=at(p,d),ahead=at(la,Math.min(total,d+look));
      var hd=dist(pos,ahead)>1?bearing(pos,ahead):cam;
      cam=(cam+(((hd-cam+540)%360)-180)*0.05+360)%360;
      placeCar(pos,hd);
      map.jumpTo({center:[pos[1],pos[0]],bearing:cam,pitch:65,zoom:zoom});
      if(prog<1)requestAnimationFrame(frame);else playback=null;
    };
    requestAnimationFrame(frame);
  },1250);
}

function receive(event){
  var data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data}catch(e){return}
  if(!data||typeof data!=='object')return;
  if(data.type==='play'){if(ready)play();return}
  if(!Array.isArray(data.fast)&&!Array.isArray(data.vibe))return;
  if(!ready){pending=data;return}
  draw(data);
}
window.addEventListener('message',receive);document.addEventListener('message',receive);

var gl=null;try{var c=document.createElement('canvas');gl=c.getContext('webgl2')||c.getContext('webgl')}catch(e){}
if(!window.maplibregl||!gl){post({type:'ready'});return}
fetch(STYLE).then(function(r){return r.json()}).then(function(s){var out;try{out=restyle(s)}catch(e){out=flatStyle()}create(out)}).catch(function(){create(flatStyle())});
})();
</script></body></html>`;
