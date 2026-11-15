/* Live Chromium integration: real requests go directly to Open-Meteo; no interception. */
const http=require('http'),fs=require('fs'),path=require('path'),puppeteer=require('puppeteer');
const ROOT=path.resolve(__dirname,'..'),MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png'};
const cases=[
 {query:'Haripur',city:'Haripur',country:'Pakistan'},
 {query:'Lahore',city:'Lahore',country:'Pakistan',region:'Punjab'},
 {query:'Karachi',city:'Karachi',country:'Pakistan',region:'Sindh'},
 {query:'Mirpur, Azad Kashmir',city:'Mirpur',country:'Pakistan',region:'Azad Kashmir'},
 {query:'London',city:'London',country:'United Kingdom'},
 {query:'Tokyo',city:'Tokyo',country:'Japan'},
 {query:'Dubai',city:'Dubai',country:'United Arab Emirates'},
 {query:'Paris, Texas',city:'Paris',country:'United States',region:'Texas'}
];
let server,browser,passes=0,failures=0,blocked=false;const errors=[];
function check(ok,msg){if(ok){passes++;console.log(`PASS - ${msg}`)}else{failures++;console.error(`FAIL - ${msg}`)}}
function localServer(){return http.createServer((req,res)=>{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/')pathname='/index.html';const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return}res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream'});res.end(b)})}).listen(0,'127.0.0.1')}
(async()=>{
 try{
  server=localServer();await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  const page=await browser.newPage();await page.setViewport({width:1280,height:900});page.on('console',m=>{if(m.type()==='error')errors.push(`console: ${m.text()}`)});page.on('pageerror',e=>errors.push(`page: ${e.message}`));page.on('requestfailed',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')errors.push(`request: ${r.url()} ${r.failure()?.errorText}`)});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  for(const c of cases){
   const geo=[],weather=[];
   const onResponse=async r=>{const u=new URL(r.url());if(u.hostname==='geocoding-api.open-meteo.com'){try{geo.push({url:u.toString(),status:r.status(),body:await r.json()})}catch(e){geo.push({url:u.toString(),status:r.status(),error:e.message})}}if(u.hostname==='api.open-meteo.com'&&u.pathname.includes('/v1/forecast')){try{weather.push({url:u.toString(),status:r.status(),body:await r.json()})}catch(e){weather.push({url:u.toString(),status:r.status(),error:e.message})}}};
   page.on('response',onResponse);
   await page.$eval('#city-input',(e,v)=>{e.value=v},c.query);await page.click('#search-btn');
   try{await page.waitForFunction(()=>{const t=document.querySelector('#status').textContent;return t.startsWith('Weather updated for ')||t.startsWith('Multiple locations match')||t.includes('No reliable match')||t.includes('Unable to reach')||t.includes('unavailable')||t.includes('Invalid response')},{timeout:25000})}catch{}
   await new Promise(r=>setTimeout(r,700));page.off('response',onResponse);
   let state=await page.evaluate(()=>({hidden:document.querySelector('#weather-card').hidden,status:document.querySelector('#status').textContent,city:document.querySelector('#city-name').textContent.trim(),place:document.querySelector('#city-country').textContent.trim(),temperature:document.querySelector('#temperature').textContent.trim(),localTime:document.querySelector('#local-time').textContent.trim(),hourly:!document.querySelector('#hourly-section').hidden,daily:!document.querySelector('#daily-section').hidden,unit:document.querySelector('#temperature').textContent.includes('°C')?'°C':document.querySelector('#temperature').textContent.includes('°F')?'°F':null}));
   console.log(`LIVE ${c.query}:`,JSON.stringify({state,geocoding:geo.map(x=>({url:x.url,status:x.status,error:x.error,bodyKeys:Object.keys(x.body||{}),apiReason:x.body?.reason,apiError:x.body?.error,results:x.body?.results?.map(p=>({name:p.name,admin1:p.admin1,country:p.country,country_code:p.country_code,latitude:p.latitude,longitude:p.longitude,timezone:p.timezone,feature_code:p.feature_code,population:p.population}))})),weather:weather.map(x=>({url:x.url,status:x.status,latitude:x.body?.latitude,longitude:x.body?.longitude,timezone:x.body?.timezone,current:x.body?.current}))}));
   if(!weather.length&&state.status.startsWith('Multiple locations match')){
    if(c.query!=='Haripur'){failures++;console.error(`FAIL - ${c.query}: actual geocoder returned ambiguous matches (${state.status})`);continue}
    check(state.status.includes('Haripur'),'unqualified Haripur is not silently assigned to another same-name place');
    c.query='Haripur, Khyber Pakhtunkhwa';c.region='Khyber Pakhtunkhwa';geo.length=0;weather.length=0;page.on('response',onResponse);
    await page.$eval('#city-input',(e,v)=>{e.value=v},c.query);await page.click('#search-btn');
    try{await page.waitForFunction(()=>{const t=document.querySelector('#status').textContent;return t.startsWith('Weather updated for ')||t.startsWith('Multiple locations match')||t.includes('No reliable match')||t.includes('Unable to reach')||t.includes('unavailable')||t.includes('Invalid response')},{timeout:25000})}catch{}
    await new Promise(r=>setTimeout(r,700));page.off('response',onResponse);
    state=await page.evaluate(()=>({hidden:document.querySelector('#weather-card').hidden,status:document.querySelector('#status').textContent,city:document.querySelector('#city-name').textContent.trim(),place:document.querySelector('#city-country').textContent.trim(),temperature:document.querySelector('#temperature').textContent.trim(),localTime:document.querySelector('#local-time').textContent.trim(),hourly:!document.querySelector('#hourly-section').hidden,daily:!document.querySelector('#daily-section').hidden,unit:document.querySelector('#temperature').textContent.includes('°C')?'°C':document.querySelector('#temperature').textContent.includes('°F')?'°F':null}));
    console.log(`LIVE ${c.query}:`,JSON.stringify({state,geocoding:geo.map(x=>({url:x.url,status:x.status,error:x.error,results:x.body?.results?.map(p=>({name:p.name,admin1:p.admin1,country:p.country,country_code:p.country_code,latitude:p.latitude,longitude:p.longitude,timezone:p.timezone}))})),weather:weather.map(x=>({url:x.url,status:x.status,latitude:x.body?.latitude,longitude:x.body?.longitude,timezone:x.body?.timezone,current:x.body?.current}))}));
   }
   if(!geo.length||!weather.length){blocked=true;console.error(`BLOCKED - ${c.query}: live geocoding or weather request did not complete (${state.status})`);continue}
   check(geo.every(x=>x.status===200),`${c.query}: actual geocoding request returned HTTP 200`);
   const selected=weather[0],wurl=new URL(selected.url),actual=geo.flatMap(x=>x.body?.results||[]).find(p=>p.name.toLowerCase()===c.city.toLowerCase()&&p.latitude===Number(wurl.searchParams.get('latitude'))&&p.longitude===Number(wurl.searchParams.get('longitude')));
   check(state.city===c.city,`${c.query}: selected city`);check(state.place.includes(c.country),`${c.query}: rendered country`);if(c.region)check(state.place.toLowerCase().includes(c.region.toLowerCase()),`${c.query}: rendered region ${c.region}`);
   check(!!actual,`${c.query}: exact latitude/longitude sent to forecast match the selected geocoding candidate`);check(selected.status===200,`${c.query}: real weather response HTTP 200`);check(Number.isFinite(selected.body?.latitude)&&Number.isFinite(selected.body?.longitude),`${c.query}: real response includes provider grid coordinates`);
   check(state.unit==='°C'&&Number.isFinite(selected.body?.current?.temperature_2m)&&state.temperature===`${Math.round(selected.body.current.temperature_2m)} °C`,`${c.query}: rendered temperature and Celsius units match live payload`);
   check(!!selected.body?.timezone&&state.localTime.length>0,`${c.query}: local timezone/time rendered (${selected.body?.timezone||'missing'})`);check(state.hourly&&state.daily,`${c.query}: hourly and daily forecasts rendered`);
  }
  check(errors.length===0,`no browser console/page/network errors (${errors.length})`);if(errors.length)console.error('BROWSER ERRORS:',JSON.stringify(errors));
  console.log(`LIVE BROWSER RESULT: ${passes} passed, ${failures} failed${blocked?`, blocked cases present`:''}`);process.exitCode=blocked?2:failures?1:0;
 }catch(e){console.error(`BLOCKED/FAILED LIVE BROWSER: ${e.stack||e}`);process.exitCode=2}
 finally{if(browser)await browser.close();if(server)server.close()}
})();
