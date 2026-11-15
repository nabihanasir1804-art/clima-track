/* Reproducible direct Open-Meteo smoke matrix; checks provider metadata and current weather availability. */
const https=require('https');
const cases=[
  {
    "query": "Haripur",
    "name": "Haripur",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 33.99783,
    "longitude": 72.93493,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Mansehra",
    "name": "Mansehra",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.33023,
    "longitude": 73.19679,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Abbottabad",
    "name": "Abbottabad",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.1463,
    "longitude": 73.21168,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Peshawar",
    "name": "Peshawar",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.008,
    "longitude": 71.57849,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Mardan",
    "name": "Mardan",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.19794,
    "longitude": 72.04965,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Mingora",
    "name": "Mingora",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.7795,
    "longitude": 72.36265,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Nowshera",
    "name": "Nowshera",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.01583,
    "longitude": 71.98123,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Kohat",
    "name": "Kohat",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 33.58196,
    "longitude": 71.44929,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Bannu",
    "name": "Bannu",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 32.98527,
    "longitude": 70.60403,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Dera Ismail Khan",
    "name": "Dera Ismail Khan",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 31.83129,
    "longitude": 70.9017,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Chitral",
    "name": "Chitral",
    "region": "Khyber Pakhtunkhwa",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 35.8518,
    "longitude": 71.78636,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Lahore",
    "name": "Lahore",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 31.558,
    "longitude": 74.35071,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Faisalabad",
    "name": "Faisalabad",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 31.41554,
    "longitude": 73.08969,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Rawalpindi",
    "name": "Rawalpindi",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 33.59733,
    "longitude": 73.0479,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Multan",
    "name": "Multan",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 30.19679,
    "longitude": 71.47824,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Gujranwala",
    "name": "Gujranwala",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 32.15567,
    "longitude": 74.18705,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Sialkot",
    "name": "Sialkot",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 32.49268,
    "longitude": 74.53134,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Bahawalpur",
    "name": "Bahawalpur",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 29.39779,
    "longitude": 71.6752,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Sargodha",
    "name": "Sargodha",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 32.08586,
    "longitude": 72.67418,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Karachi",
    "name": "Karachi",
    "region": "Sindh",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 24.8608,
    "longitude": 67.0104,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Hyderabad",
    "name": "Hyderābād",
    "region": "Sindh",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 25.39689,
    "longitude": 68.37718,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Sukkur",
    "name": "Sukkur",
    "region": "Sindh",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 27.70323,
    "longitude": 68.85889,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Larkana",
    "name": "Larkana",
    "region": "Sindh",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 27.55898,
    "longitude": 68.21204,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Quetta",
    "name": "Quetta",
    "region": "Balochistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 30.18414,
    "longitude": 67.00141,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Gwadar",
    "name": "Gwadar",
    "region": "Balochistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 25.12163,
    "longitude": 62.32541,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Turbat",
    "name": "Turbat",
    "region": "Balochistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 26.00122,
    "longitude": 63.04849,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Khuzdar",
    "name": "Khuzdar",
    "region": "Balochistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 27.81193,
    "longitude": 66.61096,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Islamabad",
    "name": "Islamabad",
    "region": "Islamabad",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 33.72148,
    "longitude": 73.04329,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Muzaffarabad",
    "name": "Muzaffarabad",
    "region": "Azad Kashmir",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 34.37002,
    "longitude": 73.47082,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Mirpur",
    "name": "Mirpur",
    "region": "Punjab",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 32.24068,
    "longitude": 75.34309,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Gilgit",
    "name": "Gilgit",
    "region": "Gilgit-Baltistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 35.91869,
    "longitude": 74.31245,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Skardu",
    "name": "Skardu",
    "region": "Gilgit-Baltistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 35.29787,
    "longitude": 75.63372,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "Hunza",
    "name": "Hunza",
    "region": "Gilgit-Baltistan",
    "country": "Pakistan",
    "code": "PK",
    "latitude": 36.26667,
    "longitude": 74.68333,
    "timezone": "Asia/Karachi"
  },
  {
    "query": "London",
    "name": "London",
    "region": "England",
    "country": "United Kingdom",
    "code": "GB",
    "latitude": 51.50853,
    "longitude": -0.12574,
    "timezone": "Europe/London"
  },
  {
    "query": "Tokyo",
    "name": "Tokyo",
    "region": "Tokyo",
    "country": "Japan",
    "code": "JP",
    "latitude": 35.6895,
    "longitude": 139.69171,
    "timezone": "Asia/Tokyo"
  },
  {
    "query": "Dubai",
    "name": "Dubai",
    "region": "Dubai",
    "country": "United Arab Emirates",
    "code": "AE",
    "latitude": 25.07725,
    "longitude": 55.30927,
    "timezone": "Asia/Dubai"
  },
  {
    "query": "New York",
    "name": "New York",
    "region": "New York",
    "country": "United States",
    "code": "US",
    "latitude": 40.71427,
    "longitude": -74.00597,
    "timezone": "America/New_York"
  },
  {
    "query": "Sydney",
    "name": "Sydney",
    "region": "New South Wales",
    "country": "Australia",
    "code": "AU",
    "latitude": -33.86785,
    "longitude": 151.20732,
    "timezone": "Australia/Sydney"
  },
  {
    "query": "Toronto",
    "name": "Toronto",
    "region": "Ontario",
    "country": "Canada",
    "code": "CA",
    "latitude": 43.70643,
    "longitude": -79.39864,
    "timezone": "America/Toronto"
  },
  {
    "query": "Singapore",
    "name": "Singapore",
    "region": "-",
    "country": "Singapore",
    "code": "SG",
    "latitude": 1.28967,
    "longitude": 103.85007,
    "timezone": "Asia/Singapore"
  },
  {
    "query": "Paris, France",
    "name": "Paris",
    "region": "Île-de-France Region",
    "country": "France",
    "code": "FR",
    "latitude": 48.85341,
    "longitude": 2.3488,
    "timezone": "Europe/Paris"
  },
  {
    "query": "Paris, Texas",
    "name": "Paris",
    "region": "Texas",
    "country": "United States",
    "code": "US",
    "latitude": 33.66094,
    "longitude": -95.55551,
    "timezone": "America/Chicago"
  }
];
function getJson(url){return new Promise((resolve,reject)=>{const req=https.get(url,{timeout:18000},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>{if(res.statusCode!==200)return reject(Error(`HTTP ${res.statusCode}`));try{const data=JSON.parse(body);if(data?.error) return reject(Error(data.reason||'provider returned an error'));resolve(data)}catch(e){reject(e)}})});req.on('timeout',()=>req.destroy(Error('request timed out')));req.on('error',reject)})}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
async function check(c){
 const g=new URL('https://geocoding-api.open-meteo.com/v1/search');g.search=new URLSearchParams({name:c.query,count:'10',language:'en',format:'json'});if(c.code==='PK'&&!c.query.includes(','))g.searchParams.set('countryCode','PK');
 const gd=await getJson(g);const results=Array.isArray(gd.results)?gd.results:[];
 const p=results.find(x=>norm(x.name)===norm(c.name)&&Math.abs(x.latitude-c.latitude)<0.00006&&Math.abs(x.longitude-c.longitude)<0.00006&&x.country_code===c.code&&norm(x.country)===norm(c.country)&&(!c.region||c.region==='-'||norm(x.admin1)===norm(c.region)));
 if(!p)throw Error(`expected candidate not returned (results ${results.length})`);
 const w=new URL('https://api.open-meteo.com/v1/forecast');w.search=new URLSearchParams({latitude:String(p.latitude),longitude:String(p.longitude),current:'temperature_2m,apparent_temperature',timezone:'auto',temperature_unit:'celsius'});
 const d=await getJson(w);if(!Number.isFinite(d.current?.temperature_2m)||!Number.isFinite(d.current?.apparent_temperature))throw Error('weather values missing');if(d.timezone!==c.timezone)throw Error(`timezone ${d.timezone} != ${c.timezone}`);
 return {query:c.query,match:p.name,region:p.admin1,country:p.country,latitude:p.latitude,longitude:p.longitude,timezone:d.timezone,temperature:d.current.temperature_2m};
}
(async()=>{let pass=0,fail=0;for(let i=0;i<cases.length;i+=4){const group=cases.slice(i,i+4);const rows=await Promise.all(group.map(async c=>{try{const r=await check(c);pass++;console.log(`PASS - ${r.query} -> ${r.match} (${r.region||'-'}, ${r.country}), ${r.latitude},${r.longitude}, ${r.timezone}, ${r.temperature}°C`)}catch(e){fail++;console.error(`FAIL - ${c.query}: ${e.message}`)}}));}console.log(`LIVE MATRIX RESULT: ${pass}/${cases.length} passed, ${fail} failed`);process.exitCode=fail?1:0})().catch(e=>{console.error(`BLOCKED LIVE MATRIX: ${e.message}`);process.exitCode=2});
