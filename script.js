// Approximate coordinates - verify on OSM and adjust if needed
const locations = [
  { name:"Ayub National Park", lat:33.6125, lng:73.0790, a:.0035, b:.0045, time:"6:00 AM - 10:00 PM",
    info:"Largest park of Rawalpindi", fac:"Jogging track, playground, lake, parking" },
  { name:"Jinnah Park", lat:33.5985, lng:73.0445, a:.0020, b:.0026, time:"6:00 AM - 10:00 PM",
    info:"Popular family park", fac:"Walking track, play area, benches" },
  { name:"Liaquat Bagh", lat:33.5990, lng:73.0570, a:.0018, b:.0024, time:"7:00 AM - 9:00 PM",
    info:"Historic public park", fac:"Gardens, open ground, seating" },
  { name:"Gulzar-e-Quaid Park", lat:33.6480, lng:73.0950, a:.0025, b:.0030, time:"6:00 AM - 9:00 PM",
    info:"Green recreational park", fac:"Jogging track, garden, parking" }
];
const profiles = { car:"routed-car", bike:"routed-bike", foot:"routed-foot" };
const colors   = { car:"#d32f2f", bike:"#1976d2", foot:"#f57c00" };
let mode = "car", userLatLng = null, userMarker, destMarker, routeLine, dest = null, customMarker;

// Base maps
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OSM &copy; CARTO'});
const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'&copy; OpenTopoMap'});
const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'});
let osmFailed=false;
osm.on('tileerror',()=>{ if(osmFailed) return; osmFailed=true; map.removeLayer(osm); voyager.addTo(map); });
const map = L.map('map',{layers:[osm]}).setView([33.60,73.06],12);
L.control.layers({"OpenStreetMap":osm,"OSM Voyager":voyager,"Satellite":sat,"Dark":dark,"Topographic":topo}).addTo(map);
L.control.scale().addTo(map);

const icon = (e)=>L.divIcon({html:`<div class="pin">${e}</div>`,className:'',iconSize:[30,30],iconAnchor:[15,28],popupAnchor:[0,-26]});

// Show all parks as markers initially
locations.forEach(l=>{
  // Park boundary polygon (approximate rectangle - replace with real boundary from geojson.io)
  l.poly = L.polygon([[l.lat+l.a,l.lng-l.b],[l.lat+l.a,l.lng+l.b],[l.lat-l.a,l.lng+l.b],[l.lat-l.a,l.lng-l.b]],
    {color:'#2e7d32',weight:1,fillColor:'#66bb6a',fillOpacity:.15}).addTo(map);
  l.marker = L.marker([l.lat,l.lng],{icon:icon('🌳')}).addTo(map).bindPopup(
    `<b>${l.name}</b><br>${l.info}<br>🕒 ${l.time}<br>🏞️ ${l.fac}<br>📐 Area: ~${Math.round(l.a*2*111000*l.b*2*93000/10000)} ha<br>📍 ${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`);
  l.marker.on('click',()=>select(l)); });

// Locate button (custom control)
const LocBtn = L.Control.extend({ onAdd(){ const b=L.DomUtil.create('button'); b.innerHTML='🎯 My Location';
  b.style.cssText='padding:8px 10px;background:#fff;border:2px solid #0004;border-radius:6px;cursor:pointer;font-weight:bold';
  L.DomEvent.on(b,'click',e=>{L.DomEvent.stop(e); locate(true);}); return b; }});
new LocBtn({position:'topleft'}).addTo(map);

function locate(zoom){
  if(!navigator.geolocation){ fallback(); return; }
  navigator.geolocation.getCurrentPosition(p=>{
    setUser([p.coords.latitude,p.coords.longitude],"📍 You are here (accuracy ±"+Math.round(p.coords.accuracy)+" m)",zoom);
  }, fallback, {enableHighAccuracy:true,timeout:10000});
}
function fallback(){ alert("Location access denied. Default start: Rawalpindi Saddar."); setUser([33.5973,73.0479],"Default location (Saddar)",true); }
function setUser(ll,txt,zoom){
  userLatLng=ll; if(userMarker) map.removeLayer(userMarker);
  userMarker=L.marker(ll,{icon:icon('🧍')}).addTo(map).bindPopup(txt);
  if(zoom) map.setView(ll,14); refreshList(); if(dest) route();
}

// Sidebar list (sorted by straight-line distance when location known)
function refreshList(){
  const term=document.getElementById('q').value.toLowerCase();
  const arr=locations.filter(l=>l.name.toLowerCase().includes(term));
  if(userLatLng) arr.sort((a,b)=>map.distance(userLatLng,[a.lat,a.lng])-map.distance(userLatLng,[b.lat,b.lng]));
  const box=document.getElementById('locList'); box.innerHTML='';
  arr.forEach((l,i)=>{ const b=document.createElement('button'); b.className='loc-btn'+(dest===l?' active':'');
    const d=userLatLng?`${(map.distance(userLatLng,[l.lat,l.lng])/1000).toFixed(1)} km away`+(i===0?' ⭐ nearest':''):l.info;
    b.innerHTML=`🌳 ${l.name}<small>${d}</small>`; b.onclick=()=>select(l); box.appendChild(b); });
}
document.getElementById('q').oninput=refreshList;

function select(l){ dest=l; advisor(l); locations.forEach(x=>x.poly.setStyle({fillOpacity:.15,weight:1})); if(l.poly) l.poly.setStyle({fillOpacity:.45,weight:3}); refreshList(); if(destMarker) map.removeLayer(destMarker);
  l.marker.openPopup(); if(userLatLng) route(); else document.getElementById('routeInfo').textContent="Waiting for your location..."; }

// Click on map = custom destination
map.on('click',e=>{ if(customMarker) map.removeLayer(customMarker);
  customMarker=L.marker(e.latlng,{icon:icon('📌')}).addTo(map).bindPopup("Custom destination").openPopup();
  dest={name:"Custom point",lat:e.latlng.lat,lng:e.latlng.lng}; advisor(dest); refreshList(); if(userLatLng) route(); });

document.querySelectorAll('.modes button[data-m]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.modes button[data-m]').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  mode=b.dataset.m; if(dest&&userLatLng) route(); });

// Routing
async function route(){
  const info=document.getElementById('routeInfo'); info.textContent="Calculating route...";
  const url=`https://routing.openstreetmap.de/${profiles[mode]}/route/v1/driving/${userLatLng[1]},${userLatLng[0]};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`;
  try{
    const r=(await (await fetch(url)).json()).routes[0];
    if(routeLine) map.removeLayer(routeLine);
    routeLine=L.geoJSON(r.geometry,{style:{color:colors[mode],weight:6,opacity:.85}}).addTo(map); lastGeo=r.geometry; elevProfile(r.geometry);
    map.fitBounds(routeLine.getBounds(),{padding:[50,50]});
    const km=(r.distance/1000).toFixed(2), min=Math.round(r.duration/60);
    const t=min>=60?`${Math.floor(min/60)} h ${min%60} min`:`${min} min`;
    info.innerHTML=`<b>To:</b> ${dest.name}<div class="stats"><div class="stat"><b>${km} km</b>Distance</div><div class="stat"><b>${t}</b>Est. time</div></div>`;
    const steps=r.legs[0].steps.filter(s=>s.maneuver.type!=='depart'||s.name);
    document.getElementById('steps').innerHTML=steps.map(s=>{
      const m=s.maneuver, mod=m.modifier?m.modifier+' ':''; const road=s.name?` on ${s.name}`:'';
      const txt=m.type==='arrive'?'Arrive at destination':m.type==='depart'?`Head${road}`:`${m.type==='roundabout'?'Take roundabout':'Turn '+mod.trim()}${road}`;
      return `<li>${txt} <small>(${Math.round(s.distance)} m)</small></li>`; }).join('');
  }catch(e){ info.textContent="Routing failed. Check internet connection."; }
}
function clearRoute(){ if(tourLine) map.removeLayer(tourLine); if(amenLayer) map.removeLayer(amenLayer); tour=[]; document.getElementById('tourOut').textContent='Select a park, press Add, repeat for 2+ parks, then Plan tour.'; if(isoLayer) map.removeLayer(isoLayer); if(routeLine) map.removeLayer(routeLine); if(customMarker) map.removeLayer(customMarker);
  dest=null; refreshList(); document.getElementById('routeInfo').textContent="Select a park to see the route.";
  document.getElementById('steps').innerHTML="<li>No route yet.</li>"; }


// ===== Smart Park Advisor: live weather + air quality => Visit Score =====
async function getScore(l){
  const [w,a]=await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${l.lat}&longitude=${l.lng}&current=temperature_2m,precipitation,wind_speed_10m&daily=sunset&timezone=auto`).then(r=>r.json()),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${l.lat}&longitude=${l.lng}&current=us_aqi,pm2_5`).then(r=>r.json())]);
  const t=w.current.temperature_2m, rain=w.current.precipitation, wind=w.current.wind_speed_10m, aqi=a.current.us_aqi||0;
  const sunset=new Date(w.daily.sunset[0]), minsLeft=Math.round((sunset-new Date())/60000);
  let sc=100, why=[];
  if(t<18||t>28){ const pen=Math.min(40,Math.abs(t<18?18-t:t-28)*3); sc-=pen; why.push(t>28?'too hot':'too cold'); }
  if(rain>0){ sc-=30; why.push('raining'); }
  if(wind>30){ sc-=10; why.push('windy'); }
  if(aqi>50){ sc-=Math.min(40,(aqi-50)*.4); why.push('poor air'); }
  if(minsLeft<60){ sc-=25; why.push(minsLeft<0?'after sunset':'sunset soon'); }
  sc=Math.max(0,Math.round(sc));
  return {l,sc,t,rain,wind,aqi,minsLeft,sunset,why};
}
const verdict=sc=>sc>=75?'🟢 Excellent time to visit':sc>=50?'🟡 Good, with some limits':'🔴 Not ideal right now';
async function advisor(l){
  const box=document.getElementById('advisor'); box.textContent='Checking live weather & air quality...';
  try{ const r=await getScore(l);
    box.innerHTML=`<b>${l.name}</b><div class="stats"><div class="stat"><b>${r.sc}/100</b>Visit score</div><div class="stat"><b>${r.t}°C</b>Temp</div></div>
    <p style="margin-top:8px">${verdict(r.sc)}${r.why.length?' ('+r.why.join(', ')+')':''}</p>
    <small>💨 ${r.wind} km/h · 🌫️ AQI ${r.aqi} · 🌧️ ${r.rain} mm<br>🌇 Sunset ${r.sunset.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} (${r.minsLeft>0?r.minsLeft+' min left':'passed'})</small>`;
  }catch(e){ box.textContent='Live data unavailable (check internet).'; }
}
async function rankAll(){
  const box=document.getElementById('advisor'); box.textContent='Ranking all parks with live data...';
  try{ const res=(await Promise.all(locations.map(getScore))).sort((a,b)=>b.sc-a.sc);
    box.innerHTML='<b>Best park to visit right now:</b><ol style="padding-left:18px;margin-top:6px">'+
      res.map((r,i)=>`<li>${['🥇','🥈','🥉',''][i]||''} ${r.l.name} - <b>${r.sc}</b> (${r.t}°C, AQI ${r.aqi})</li>`).join('')+'</ol>';
    select(res[0].l);
  }catch(e){ box.textContent='Live data unavailable (check internet).'; }
}

// ===== Voice navigation =====
function speak(){
  if(!('speechSynthesis' in window)) return alert('Voice not supported in this browser.');
  speechSynthesis.cancel();
  const items=[...document.querySelectorAll('#steps li')].map(li=>li.textContent.replace(/\(\d+ m\)/,'').trim());
  items.forEach(t=>speechSynthesis.speak(new SpeechSynthesisUtterance(t)));
}

// ===== Live tracking with arrival detection =====
let watchId=null, lastRoute=0;
function track(){
  const btn=document.getElementById('trackBtn'), live=document.getElementById('live');
  if(watchId!==null){ navigator.geolocation.clearWatch(watchId); watchId=null; btn.textContent='📡 Start Live Tracking'; live.style.display='none'; return; }
  if(!dest) return alert('Select a destination first.');
  btn.textContent='⏹ Stop Tracking'; live.style.display='block';
  watchId=navigator.geolocation.watchPosition(p=>{
    userLatLng=[p.coords.latitude,p.coords.longitude]; if(userMarker) userMarker.setLatLng(userLatLng);
    const d=map.distance(userLatLng,[dest.lat,dest.lng]);
    live.innerHTML=`📡 <b>Live:</b> ${d>1000?(d/1000).toFixed(2)+' km':Math.round(d)+' m'} remaining`;
    if(d<50){ live.innerHTML='🎉 <b>You have arrived at '+dest.name+'!</b>'; navigator.geolocation.clearWatch(watchId); watchId=null; btn.textContent='📡 Start Live Tracking'; }
    else if(Date.now()-lastRoute>30000){ lastRoute=Date.now(); route(); }
  },()=>alert('Tracking failed.'),{enableHighAccuracy:true});
}


// ===== Real parks from OpenStreetMap (Overpass API) =====
function ringArea(pts){ const kx=111320*Math.cos(pts[0][0]*Math.PI/180), ky=110540; let a=0;
  for(let i=0;i<pts.length;i++){ const [y1,x1]=pts[i],[y2,x2]=pts[(i+1)%pts.length]; a+=(x1*kx)*(y2*ky)-(x2*kx)*(y1*ky); }
  return Math.abs(a)/2; }
async function discover(){
  const btn=document.getElementById('discBtn'); btn.textContent='Loading parks from OSM...';
  const q='[out:json][timeout:25];way["leisure"="park"]["name"](33.52,72.98,33.70,73.14);out geom tags;';
  try{
    const data=await (await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q))).json();
    const found=data.elements.filter(e=>e.geometry&&e.geometry.length>3).map(e=>{
      const pts=e.geometry.map(g=>[g.lat,g.lon]);
      const lat=pts.reduce((x,p)=>x+p[0],0)/pts.length, lng=pts.reduce((x,p)=>x+p[1],0)/pts.length;
      return {name:e.tags.name,pts,lat,lng,area:ringArea(pts)};
    }).filter(f=>!locations.some(l=>l.name.toLowerCase().includes(f.name.toLowerCase())||f.name.toLowerCase().includes(l.name.toLowerCase())))
      .sort((a,b)=>b.area-a.area).slice(0,25);
    found.forEach(f=>{
      const ha=(f.area/10000).toFixed(1);
      const l={name:f.name,lat:f.lat,lng:f.lng,info:`OSM park · ${ha} ha`,time:'-',fac:'-'};
      l.poly=L.polygon(f.pts,{color:'#00695c',weight:1,fillColor:'#26a69a',fillOpacity:.15}).addTo(map);
      l.marker=L.marker([f.lat,f.lng],{icon:icon('🌲')}).addTo(map).bindPopup(`<b>${f.name}</b><br>Source: OpenStreetMap<br>📐 Area (from real boundary): ${ha} ha<br>📍 ${f.lat.toFixed(4)}, ${f.lng.toFixed(4)}`);
      l.marker.on('click',()=>select(l)); locations.push(l);
    });
    btn.textContent=`✅ ${found.length} real OSM parks added`; refreshList();
  }catch(e){ btn.textContent='🛰️ Discover Real Parks from OSM (retry)'; alert('Overpass server busy. Try again in a few seconds.'); }
}

// ===== Service area (isochrone) analysis via Valhalla =====
let isoLayer=null;
async function isochrone(){
  if(!dest) return alert('Select a park first.');
  const box=document.getElementById('iso'); box.style.display='block'; box.textContent='Computing reach zones...';
  const costing={car:'auto',bike:'bicycle',foot:'pedestrian'}[mode];
  const body={locations:[{lat:dest.lat,lon:dest.lng}],costing,contours:[{time:5},{time:10},{time:15}],polygons:true};
  try{
    const gj=await (await fetch('https://valhalla1.openstreetmap.de/isochrone?json='+encodeURIComponent(JSON.stringify(body)))).json();
    if(isoLayer) map.removeLayer(isoLayer);
    const col={5:'#2e7d32',10:'#f9a825',15:'#c62828'};
    isoLayer=L.geoJSON(gj,{style:f=>({color:col[f.properties.contour],weight:2,fillOpacity:.18})}).addTo(map);
    map.fitBounds(isoLayer.getBounds());
    const rows=gj.features.map(f=>{ const ring=f.geometry.type==='Polygon'?f.geometry.coordinates[0]:f.geometry.coordinates[0][0];
      return {t:f.properties.contour,km:ringArea(ring.map(c=>[c[1],c[0]]))/1e6}; }).sort((a,b)=>a.t-b.t);
    box.innerHTML=`<b>Reach zones around ${dest.name}</b> (${mode})<br>`+rows.map(r=>`<span style="color:${col[r.t]}">■</span> ${r.t} min: <b>${r.km.toFixed(1)} km²</b>`).join('<br>')+
      '<br><small>Area people can reach the park from within each time.</small>';
  }catch(e){ box.textContent='Service area server busy. Try again.'; }
}


// ===== Elevation profile (Open-Meteo elevation API) =====
let lastGeo=null, tripMarker=null, tripTimer=null;
async function elevProfile(g){
  const box=document.getElementById('elev'); box.textContent='Loading elevation...';
  const c=g.coordinates, n=Math.min(60,c.length), pts=Array.from({length:n},(_,i)=>c[Math.round(i*(c.length-1)/(n-1))]);
  try{
    const d=await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map(p=>p[1].toFixed(5)).join(',')}&longitude=${pts.map(p=>p[0].toFixed(5)).join(',')}`)).json();
    const e=d.elevation, mn=Math.min(...e), mx=Math.max(...e), rg=Math.max(1,mx-mn);
    let up=0; for(let i=1;i<e.length;i++) if(e[i]>e[i-1]) up+=e[i]-e[i-1];
    const line=e.map((v,i)=>`${(i/(e.length-1)*300).toFixed(1)},${(75-(v-mn)/rg*65).toFixed(1)}`).join(' ');
    box.innerHTML=`<svg id="elevSvg" viewBox="0 0 300 80" preserveAspectRatio="none"><polygon points="0,80 ${line} 300,80" fill="#66bb6a55"/><polyline points="${line}" fill="none" stroke="#2e7d32" stroke-width="2"/></svg>
      <small>⬇ Min ${Math.round(mn)} m · ⬆ Max ${Math.round(mx)} m · Total climb ${Math.round(up)} m</small>`;
  }catch(err){ box.textContent='Elevation data unavailable.'; }
}

// ===== Animate trip along the route =====
function animateTrip(){
  if(!lastGeo) return alert('Create a route first.');
  clearInterval(tripTimer); if(tripMarker) map.removeLayer(tripMarker);
  const c=lastGeo.coordinates, step=Math.max(1,Math.floor(c.length/200)); let i=0;
  tripMarker=L.marker([c[0][1],c[0][0]],{icon:icon({car:'🚗',bike:'🚴',foot:'🚶'}[mode])}).addTo(map);
  tripTimer=setInterval(()=>{ i+=step; if(i>=c.length){ i=c.length-1; clearInterval(tripTimer); }
    tripMarker.setLatLng([c[i][1],c[i][0]]); },40);
}

// ===== Export route as GeoJSON (opens in QGIS / geojson.io) =====
function exportGeo(){
  if(!lastGeo) return alert('Create a route first.');
  const fc={type:'FeatureCollection',features:[{type:'Feature',properties:{to:dest.name,mode},geometry:lastGeo}]};
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(fc,null,2)],{type:'application/geo+json'}));
  a.download=`route_${dest.name.replace(/\s+/g,'_')}.geojson`; a.click();
}


// ===== Theme toggle =====
function toggleTheme(){ document.body.classList.toggle('dark'); document.getElementById('themeBtn').textContent=document.body.classList.contains('dark')?'☀️':'🌙'; }

// ===== Buffer analysis: parks inside a radius around the user =====
let bufCircle;
function buffer(){
  if(!userLatLng) return alert('Waiting for your location...');
  const km=+document.getElementById('buf').value;
  if(bufCircle) map.removeLayer(bufCircle);
  bufCircle=L.circle(userLatLng,{radius:km*1000,color:'#6a1b9a',weight:2,fillColor:'#ab47bc',fillOpacity:.08}).addTo(map);
  map.fitBounds(bufCircle.getBounds());
  const inside=locations.map(l=>({l,d:map.distance(userLatLng,[l.lat,l.lng])})).filter(x=>x.d<=km*1000).sort((a,b)=>a.d-b.d);
  document.getElementById('bufOut').innerHTML=`<b>${inside.length}</b> park(s) within ${km} km`+
    (inside.length?'<ol style="padding-left:18px;margin-top:4px;font-size:13px">'+inside.slice(0,6).map(x=>`<li>${x.l.name} - ${(x.d/1000).toFixed(1)} km</li>`).join('')+'</ol>':'');
}

// ===== Download route report =====
function exportReport(){
  if(!dest) return alert('Select a destination first.');
  const t=id=>document.getElementById(id).innerText.replace(/\n+/g,' | ');
  const txt=`WEBGIS LAB 03 - ROUTE REPORT\nStudent: Nermeen Nasir\nARID: 24-ARID-2234\nCity: Rawalpindi\nDate: ${new Date().toLocaleString()}\n\nDestination: ${dest.name} (${dest.lat.toFixed(5)}, ${dest.lng.toFixed(5)})\nMode: ${mode}\nRoute: ${t('routeInfo')}\nAdvisor: ${t('advisor')}\n\nDirections:\n`+
    [...document.querySelectorAll('#steps li')].map((li,i)=>`${i+1}. ${li.innerText}`).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));
  a.download='Route_Report_'+dest.name.replace(/\W+/g,'_')+'.txt'; a.click();
}


// ===== Nearby amenities (Overpass) =====
let amenLayer;
async function amenities(type,emoji){
  if(!dest) return alert('Select a park first.');
  if(amenLayer) map.removeLayer(amenLayer); amenLayer=L.layerGroup().addTo(map);
  const q=`[out:json][timeout:25];nwr["amenity"="${type}"](around:1000,${dest.lat},${dest.lng});out center 40;`;
  try{
    const d=await (await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q))).json();
    d.elements.forEach(x=>{ const la=x.lat||x.center.lat, lo=x.lon||x.center.lon;
      L.marker([la,lo],{icon:icon(emoji)}).addTo(amenLayer).bindPopup(`<b>${x.tags&&x.tags.name||type}</b><br>${(map.distance([dest.lat,dest.lng],[la,lo])).toFixed(0)} m from ${dest.name}`); });
    if(!d.elements.length) alert('No '+type+' found within 1 km in OSM data.');
  }catch(e){ alert('Overpass busy. Try again.'); }
}

// ===== Multi-stop park tour (nearest-neighbour order) =====
let tour=[], tourLine;
function addTour(){ if(!dest||dest.name==='Custom point') return alert('Select a park first.');
  if(!tour.includes(dest)) tour.push(dest);
  document.getElementById('tourOut').innerHTML='Tour parks: <b>'+tour.map(t=>t.name).join(', ')+'</b>'; }
async function planTour(){
  if(tour.length<2) return alert('Add at least 2 parks.'); if(!userLatLng) return alert('Waiting for your location...');
  let cur=userLatLng, left=[...tour], order=[];
  while(left.length){ left.sort((a,b)=>map.distance(cur,[a.lat,a.lng])-map.distance(cur,[b.lat,b.lng])); const n=left.shift(); order.push(n); cur=[n.lat,n.lng]; }
  const wp=[userLatLng,...order.map(o=>[o.lat,o.lng])].map(c=>c[1]+','+c[0]).join(';');
  const box=document.getElementById('tourOut'); box.textContent='Planning tour...';
  try{
    const r=(await (await fetch(`https://routing.openstreetmap.de/${profiles[mode]}/route/v1/driving/${wp}?overview=full&geometries=geojson`)).json()).routes[0];
    if(tourLine) map.removeLayer(tourLine);
    tourLine=L.geoJSON(r.geometry,{style:{color:'#6a1b9a',weight:6,dashArray:'10 8'}}).addTo(map); map.fitBounds(tourLine.getBounds(),{padding:[40,40]});
    box.innerHTML=`<b>Best order:</b><ol style="padding-left:18px">${order.map(o=>`<li>${o.name}</li>`).join('')}</ol><b>${(r.distance/1000).toFixed(1)} km</b> · <b>${Math.round(r.duration/60)} min</b> total`;
  }catch(e){ box.textContent='Tour planning failed.'; }
}

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{ document.querySelectorAll('.tab,.pane').forEach(x=>x.classList.remove('on'));
  t.classList.add('on'); document.getElementById(t.dataset.t).classList.add('on'); });
refreshList(); locate(false);
