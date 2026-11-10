import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";
function selectedOrigin(value:string) {
  const origin=new URL(value);
  if(!["https:","http:"].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=="/"||origin.search||origin.hash)throw new Error("INVALID_PUBLIC_SUPABASE_ORIGIN");
  return origin;
}
export function contentSecurityPolicy(value:string) {
  return "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self' "+selectedOrigin(value).origin+"; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
}
export function hostingHeaders(env:Record<string,string|undefined>) {
  const origin=selectedOrigin(env.VITE_SUPABASE_URL??"invalid");
  if(env.NETLIFY==="true"){
    if(origin.protocol!=="https:")throw new Error("HOSTED_HTTPS_REQUIRED");
    if(env.CONTEXT!=="production"&&(env.LOVER_PREVIEW_ISOLATED!=="true"||!env.LOVER_PRODUCTION_SUPABASE_ORIGIN||origin.origin===env.LOVER_PRODUCTION_SUPABASE_ORIGIN))throw new Error("ISOLATED_PREVIEW_CONFIGURATION_REQUIRED");
  }
  return "/*\n  Content-Security-Policy: "+contentSecurityPolicy(origin.origin)+"\n  Cache-Control: no-store\n";
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  writeFileSync("dist/_headers",hostingHeaders({...loadEnv("production",process.cwd(),"VITE_"),...process.env}));
  console.log("Hosting headers generated for selected public origin; no privileged configuration included.");
}
