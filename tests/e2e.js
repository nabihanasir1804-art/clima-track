/* Real Chromium page flow with deterministic fixtures for the two Open-Meteo APIs. */
const {spawn}=require("child_process");
const path=require("path");
const fs=require("fs");
const ROOT=path.resolve(__dirname,"..");
const http=require("http");
const puppeteer=require("puppeteer");
const PORT=18773, BASE=`http://127.0.0.1:${PORT}`;
let server,browser,page,passes=0,failures=0;
const consoleErrors=[],pageErrors=[],failedRequests=[],apiLog=[];
function check(ok,label){if(ok){passes++;console.log(`PASS - ${label}`)}else{failures++;console.error(`FAIL - ${label}`)}}
function eq(a,b,label){check(String(a)===String(b),`${label} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`)}
const locations={
  Haripur:{name:"Haripur",latitude:33.99783,longitude:72.93493,feature_code:"PPLA2",country_code:"PK",country:"Pakistan",admin1:"Khyber Pakhtunkhwa",timezone:"Asia/Karachi",population:100000},
  Lahore:{name:"Lahore",latitude:31.558,longitude:74.35071,feature_code:"PPLA",country_code:"PK",country:"Pakistan",admin1:"Punjab",timezone:"Asia/Karachi",population:13000000},
  London:{name:"London",latitude:51.50853,longitude:-0.12574,feature_code:"PPLC",country_code:"GB",country:"United Kingdom",admin1:"England",timezone:"Europe/London",population:8900000},
  Tokyo:{name:"Tokyo",latitude:35.6895,longitude:139.69171,feature_code:"PPLC",country_code:"JP",country:"Japan",admin1:"Tokyo",timezone:"Asia/Tokyo",population:9000000},
  Karachi:{name:"Karachi",latitude:24.8608,longitude:67.0104,feature_code:"PPLA",country_code:"PK",country:"Pakistan",admin1:"Sindh",timezone:"Asia/Karachi",population:11000000},
  Paris:{name:"Paris",latitude:48.8534,longitude:2.3488,feature_code:"PPLC",country_code:"FR",country:"France",admin1:"Île-de-France Region",timezone:"Europe/Paris",population:2100000},
  ParisTX:{name:"Paris",latitude:33.66094,longitude:-95.55551,feature_code:"PPLA2",country_code:"US",country:"United States",admin1:"Texas",timezone:"America/Chicago",population:24000}
};
function json(res,obj,status=200){res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*"});res.end(JSON.stringify(obj))}
function result(place){return {results:[place]}}
function weather(place){
 const currentTime="2026-11-15T12:00";
 const hourlyTimes=Array.from({length:24},(_,i)=>`2026-11-15T${String(i).padStart(2,"0")}:00`);
 return {latitude:place.latitude,longitude:place.longitude,timezone:place.timezone,timezone_abbreviation:"GMT",utc_offset_seconds:0,
 current_units:{time:"iso8601",interval:"seconds",temperature_2m:"°C",relative_humidity_2m:"%",apparent_temperature:"°C",is_day:"",weather_code:"wmo code",wind_speed_10m:"km/h",pressure_msl:"hPa"},
 current:{time:currentTime,interval:900,temperature_2m:24.3,relative_humidity_2m:52,apparent_temperature:25.1,is_day:1,weather_code:2,wind_speed_10m:13.2,pressure_msl:1008.7},
 hourly_units:{time:"iso8601",temperature_2m:"°C",weather_code:"wmo code"},hourly:{time:hourlyTimes,temperature_2m:hourlyTimes.map((_,i)=>24+i/10),weather_code:hourlyTimes.map(()=>2)},
 daily_units:{time:"iso8601",weather_code:"wmo code",temperature_2m_max:"°C",temperature_2m_min:"°C"},daily:{time:Array.from({length:7},(_,i)=>`2026-11-${String(15+i).padStart(2,"0")}`),weather_code:Array(7).fill(2),temperature_2m_max:Array(7).fill(28),temperature_2m_min:Array(7).fill(18)}};
}
(async()=>{
 try{
  server=spawn("python3",["-m","http.server",String(PORT),"--bind","127.0.0.1"],{cwd:ROOT,stdio:"ignore"});
  let ready=false;
  for(let i=0;i<40;i++){try{await new Promise((resolve,reject)=>{const r=http.get(`${BASE}/`,x=>{x.resume();resolve()});r.on("error",reject)});ready=true;break}catch{await new Promise(r=>setTimeout(r,100))}}
  check(ready,"local server ready before browser launch"); if(!ready)throw Error("local server not ready");
  browser=await puppeteer.launch({executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||(fs.existsSync("/usr/bin/chromium")?"/usr/bin/chromium":undefined),headless:"new",args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]});
  page=await browser.newPage(); await page.setViewport({width:1280,height:900}); await page.setRequestInterception(true);
  page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text())}); page.on("pageerror",e=>pageErrors.push(e.message));
  page.on("requestfailed",r=>failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on("response",r=>{if(r.url().includes("open-meteo.com"))apiLog.push({url:r.url(),status:r.status()})});
  page.on("request",req=>{
   const u=new URL(req.url());
   if(u.hostname==="geocoding-api.open-meteo.com"){
    const q=u.searchParams.get("name").split(",")[0].trim();
    let place=locations[q]||null;
    if(q==="Paris"&&u.searchParams.get("name").includes("Texas"))place=locations.ParisTX;
    if(q==="London"&&u.searchParams.has("countryCode")){req.respond({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"*"},body:JSON.stringify({results:[]})});return}
    const data=place?result(place):{results:[]}; req.respond({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"*"},body:JSON.stringify(data)});return;
   }
   if(u.hostname==="api.open-meteo.com"){
    const lat=Number(u.searchParams.get("latitude")),lon=Number(u.searchParams.get("longitude"));
    const place=Object.values(locations).find(x=>x.latitude===lat&&x.longitude===lon);
    
    if(!place){req.respond({status:400,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"*"},body:JSON.stringify({error:true})});return}
    req.respond({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"*"},body:JSON.stringify(weather(place))});return;
   }
   req.continue();
  });
  await page.goto(`${BASE}/`,{waitUntil:"networkidle0"});
  check(await page.$eval("#weather-card",e=>e.hidden),"welcome state shows no weather card");
  await page.screenshot({path:path.join(__dirname,"assets","e2e-welcome.png"),fullPage:true});
  async function search(query){await page.$eval("#city-input",(e,v)=>{e.value=v},query);await page.click("#search-btn");}
  async function waitCity(name){await page.waitForFunction(n=>!document.querySelector("#weather-card").hidden&&document.querySelector("#city-name").textContent.trim()===n,{timeout:5000},name)}
  await search("Haripur");await waitCity("Haripur");
  eq(await page.$eval("#city-country",e=>e.textContent),"Khyber Pakhtunkhwa, Pakistan","Haripur place rendered");
  eq(await page.$eval("#temperature",e=>e.textContent),"24 °C","temperature presentation matches fixture raw value");
  const weatherUrl=apiLog.find(x=>x.url.includes("api.open-meteo.com/v1/forecast"))?.url;
  const hu=new URL(weatherUrl);eq(hu.searchParams.get("latitude"),String(locations.Haripur.latitude),"weather request uses selected Haripur latitude");eq(hu.searchParams.get("longitude"),String(locations.Haripur.longitude),"weather request uses selected Haripur longitude");
  check(await page.$eval("#hourly-section",e=>!e.hidden),"hourly forecast rendered");check(await page.$eval("#daily-section",e=>!e.hidden),"daily forecast rendered");
  await page.screenshot({path:path.join(__dirname,"assets","e2e-haripur.png"),fullPage:true});
  await page.click("#unit-btn");eq(await page.$eval("#temperature",e=>e.textContent),"76 °F","unit toggle converts raw Celsius once");
  await search("London");await waitCity("London");check((await page.$eval("#city-country",e=>e.textContent)).includes("England, United Kingdom"),"London global fallback resolves UK");
  const londonCalls=apiLog.filter(x=>x.url.includes("geocoding-api")&&x.url.includes("name=London"));check(londonCalls.length===2,"London performs PK-filtered and unrestricted geocoding");
  await search("Paris, Texas");await page.waitForFunction(()=>document.querySelector("#city-name").textContent.trim()==="Paris"&&document.querySelector("#city-country").textContent.includes("Texas"),{timeout:5000});check((await page.$eval("#city-country",e=>e.textContent)).includes("United States"),"Paris, Texas respects region and country");
  for(const width of [320,360,375,390,430,768,1024,1280,1440]){await page.setViewport({width,height:900});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);check(!overflow,`${width}px viewport has no horizontal overflow with weather visible`)}
  await search("NoSuchTown");await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("No reliable match"),{timeout:5000});check(await page.$eval("#weather-card",e=>e.hidden),"failed query clears previous result");
  await page.$eval("#city-input",e=>e.value="   ");await page.click("#search-btn");await page.waitForFunction(()=>document.querySelector("#status").textContent.includes("Please enter"),{timeout:2000});check(true,"empty query shows validation message");
  check(consoleErrors.length===0,`no browser console errors (${consoleErrors.length})`);check(pageErrors.length===0,`no page errors (${pageErrors.length})`);check(failedRequests.length===0,`no failed network requests (${failedRequests.length})`);
  console.log("API requests:",JSON.stringify(apiLog,null,2)); console.log("RESULT:",`${passes} passed, ${failures} failed`); console.log("Screenshots: assets/e2e-welcome.png, assets/e2e-haripur.png");
  process.exitCode=failures?1:0;
 }catch(e){console.error("E2E failure:",e);if(page){try{console.error("Page state:",await page.evaluate(()=>({status:document.querySelector("#status")?.textContent,cardHidden:document.querySelector("#weather-card")?.hidden,city:document.querySelector("#city-name")?.textContent,input:document.querySelector("#city-input")?.value,buttonDisabled:document.querySelector("#search-btn")?.disabled})));}catch{}}console.error("API log:",JSON.stringify(apiLog));console.error("Browser errors:",JSON.stringify({consoleErrors,pageErrors,failedRequests}));process.exitCode=2}
 finally{if(browser)await browser.close();if(server)server.kill()}
})();
