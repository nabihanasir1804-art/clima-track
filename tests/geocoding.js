/* Controlled tests for the actual getCoordinates implementation and API requests. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { assert, assertEqual, report } = require("./assert");
const code = fs.readFileSync(path.resolve(__dirname, "../js/app.js"), "utf8");
const fakeEl = { addEventListener() {}, textContent:"", className:"", classList:{add(){},remove(){}}, hidden:true, disabled:false, value:"", focus(){}, setAttribute(){}, append(){}, appendChild(){} };
const calls = [];
let responses = [];
const sandbox = {
  document:{getElementById:()=>fakeEl,createElement:()=>fakeEl,createDocumentFragment:()=>({appendChild(){}})},
  console, setTimeout, clearTimeout, AbortController, URL, URLSearchParams,
  fetch: async (url, options={}) => {
    calls.push({url:new URL(url), options});
    const result=responses.shift();
    if (result instanceof Error) throw result;
    return {ok:true,status:200,json:async()=>result};
  }
};
vm.runInNewContext(code,sandbox);
const place=(name,country,code,region,lat,lon,feature="PPL")=>({name,country,country_code:code,admin1:region,latitude:lat,longitude:lon,feature_code:feature,population:10000,timezone:"Asia/Karachi"});
const lahore=place("Lahore","Pakistan","PK","Punjab",31.558,74.35071,"PPLA");
const london=place("London","United Kingdom","GB","England",51.50853,-0.12574,"PPLC");
const parisTX=place("Paris","United States","US","Texas",33.66094,-95.55551,"PPLA2");
async function run(){
  // Normal Pakistan-first match returns one documented shape.
  calls.length=0; responses=[{results:[lahore]}];
  const normal=await sandbox.getCoordinates("Lahore");
  assertEqual(normal.place.name,"Lahore","Pakistan result returns { place }");
  assertEqual(normal.place.latitude,31.558,"normal return retains numeric coordinates");
  assertEqual(calls[0].url.searchParams.get("countryCode"),"PK","Pakistan filter uses documented countryCode parameter");
  assertEqual(calls.length,1,"reliable Pakistan match does not need global request");

  // No Pakistani result triggers an unrestricted global search.
  calls.length=0; responses=[{generationtime_ms:0},{results:[london]}];
  const fallback=await sandbox.getCoordinates("London");
  assertEqual(fallback.place.country,"United Kingdom","valid no-match response without results selects London, UK");
  assertEqual(calls.length,2,"global fallback is actually requested");
  assertEqual(calls[0].url.searchParams.get("countryCode"),"PK","first request is Pakistan filtered");
  assertEqual(calls[1].url.searchParams.has("countryCode"),false,"second request is unrestricted");

  // Ambiguous Pakistan candidates are preserved for a user choice; a global
  // lookup must not replace the relevant Pakistani candidates with unrelated cities.
  const p1=place("Twin","Pakistan","PK","Punjab",31,70), p2=place("Twin","Pakistan","PK","Sindh",25,68);
  calls.length=0; responses=[{results:[p1,p2]}];
  try { await sandbox.getCoordinates("Twin"); assert(false,"ambiguous result must not resolve silently"); }
  catch(e){ assert(Array.isArray(e.candidates),"ambiguous query exposes candidate array"); assert(e.candidates.some(p=>p.admin1==="Punjab")&&e.candidates.some(p=>p.admin1==="Sindh"),"ambiguous candidates preserve distinct Pakistani regions"); }
  assertEqual(calls.length,1,"ambiguous Pakistan match does not replace candidates with global results");

  // No reliable match after both requests is an honest error.
  calls.length=0; responses=[{results:[]},{results:[]}];
  let unresolved=false; try { await sandbox.getCoordinates("Unknown settlement"); } catch(e){ unresolved=e.message.includes("No reliable match"); }
  assert(unresolved,"unresolved query fails after global fallback");
  assertEqual(calls.length,2,"unresolved query attempted both endpoints searches");

  // Explicit region + country query performs no PK-only request and validates both tokens.
  calls.length=0; responses=[{results:[parisTX]}];
  const explicit=await sandbox.getCoordinates("Paris, Texas, USA");
  assertEqual(explicit.place.admin1,"Texas","explicit region is enforced");
  assertEqual(explicit.place.country_code,"US","explicit country alias is enforced");
  assertEqual(calls.length,1,"explicit query performs one unrestricted lookup");
  assertEqual(calls[0].url.searchParams.has("countryCode"),false,"qualified query omits PK filter");
  assertEqual(calls[0].url.searchParams.get("name"),"Paris, Texas","API receives city and first-level region qualifier");

  calls.length=0; responses=[{results:[parisTX]}];
  let contradiction=false; try { await sandbox.getCoordinates("Paris, Texas, France"); } catch(e){ contradiction=e.message.includes("No reliable match"); }
  assert(contradiction,"contradictory country/region context is rejected");
  // Mirpur has distinct Pakistani candidates; never silently accept one by name alone.
  const mirpurAJK=place("Mirpur","Pakistan","PK","Azad Kashmir",33.148,73.751,"PPL");
  const mirpurPunjab=place("Mirpur","Pakistan","PK","Punjab",32.24068,75.34309,"PPL");
  calls.length=0; responses=[{results:[mirpurAJK,mirpurPunjab]}];
  let mirpurAmbiguous=false;
  try { await sandbox.getCoordinates("Mirpur"); } catch(e) { mirpurAmbiguous=Array.isArray(e.candidates)&&e.candidates.some(p=>p.admin1==="Azad Kashmir")&&e.candidates.some(p=>p.admin1==="Punjab"); }
  assert(mirpurAmbiguous,"unqualified Mirpur reports both Azad Kashmir and Punjab candidates");
  assertEqual(calls.length,1,"ambiguous Mirpur keeps the Pakistan-filtered results");

  calls.length=0; responses=[{results:[mirpurAJK,mirpurPunjab]}];
  let mirpurPakistanAmbiguous=false;
  try { await sandbox.getCoordinates("Mirpur, Pakistan"); } catch(e) { mirpurPakistanAmbiguous=Array.isArray(e.candidates); }
  assert(mirpurPakistanAmbiguous,"Mirpur, Pakistan remains ambiguous without a region");
  assertEqual(calls.length,1,"country-qualified Mirpur uses one unrestricted request");

  for (const query of ["Mirpur, Azad Kashmir","Mirpur, Azad Kashmir, Pakistan"]) {
    calls.length=0; responses=[{results:[mirpurAJK,mirpurPunjab]}];
    const selected=await sandbox.getCoordinates(query);
    assertEqual(selected.place.admin1,"Azad Kashmir",`${query} selects Azad Kashmir`);
    assertEqual(selected.place.country_code,"PK",`${query} selects Pakistan`);
    assertEqual(calls[0].url.searchParams.get("name"),"Mirpur, Azad Kashmir",`${query} sends city and region to geocoder`);
    assertEqual(calls[0].url.searchParams.has("countryCode"),false,`${query} uses unrestricted geocoder`);
  }

}
run().then(report).catch(e=>{console.error(e);process.exitCode=1;});
