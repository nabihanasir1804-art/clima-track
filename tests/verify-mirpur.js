/* Live Open-Meteo diagnostic; no fixtures or response replacement. */
const https = require('https');
const queries = ["Mirpur", "Mirpur, Pakistan", "Mirpur, Azad Kashmir", "Mirpur, Azad Kashmir, Pakistan"];
function getJson(url) {
  return new Promise((resolve, reject) => {
    const req=https.get(url,{timeout:12000},res=>{let body="";res.setEncoding("utf8");res.on("data",c=>body+=c);res.on("end",()=>{if(res.statusCode!==200)return reject(Error(`HTTP ${res.statusCode}`));try{resolve(JSON.parse(body))}catch(e){reject(e)}})});
    req.on("timeout",()=>req.destroy(Error("request timed out")));req.on("error",reject);
  });
}
(async()=>{
  try {
    for (const query of queries) {
      const u=new URL("https://geocoding-api.open-meteo.com/v1/search");
      u.search=new URLSearchParams({name:query,count:"10",language:"en",format:"json"});
      const data=await getJson(u); const results=data.results||[];
      console.log(JSON.stringify({query,results:results.map(x=>({name:x.name,admin1:x.admin1,country:x.country,country_code:x.country_code,latitude:x.latitude,longitude:x.longitude,feature_code:x.feature_code,population:x.population,timezone:x.timezone}))}));
      if (query.includes("Azad Kashmir") && !results.some(x=>x.name.toLowerCase()==="mirpur"&&/azad kashmir/i.test(x.admin1||"")&&x.country_code==="PK")) throw Error(`${query}: Open-Meteo did not return Mirpur in Azad Kashmir, Pakistan`);
    }
    console.log("LIVE MIRPUR RESULT: all four geocoding queries completed.");
  } catch(e) { console.error(`BLOCKED/FAILED LIVE MIRPUR: ${e.message}`); process.exitCode=2; }
})();
