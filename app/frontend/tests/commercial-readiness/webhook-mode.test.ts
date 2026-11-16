Deno.test("signed webhook rejects wrong or missing mode before database access", async () => {
 const serve=Deno.serve, fetchOriginal=globalThis.fetch;
 const keys=["AMANAH_ENV","SUPABASE_URL","APP_11941c8fec_LEMONSQUEEZY_WEBHOOK_SECRET"];
 const previous=keys.map(k=>Deno.env.get(k));
 let handler:(r:Request)=>Response|Promise<Response>;
 try {
  Deno.env.set(keys[1],"https://stagingfixture.supabase.co");
  Deno.env.set(keys[2],"fixture-secret");
  Deno.serve=((h:typeof handler)=>{handler=h;return {};}) as typeof Deno.serve;
  globalThis.fetch=(()=>{throw Error("Unexpected network access");}) as typeof fetch;
  await import("../../supabase/functions/app_11941c8fec_lemonsqueezy_webhook/index.ts");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode("fixture-secret"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  for(const [env,mode,attribute] of [["staging",false,false],["production",true,true],["staging",undefined,undefined],["staging",true,false]]){
   Deno.env.set(keys[0],String(env));
   const body=JSON.stringify({meta:{event_name:"subscription_created",test_mode:mode},data:{attributes:{test_mode:attribute}}});
   const sig=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(body)))).map(x=>x.toString(16).padStart(2,"0")).join("");
   const res=await handler!(new Request("http://localhost/webhook",{method:"POST",headers:{"X-Signature":sig},body}));
   if(res.status!==400 || (await res.json()).error!=="webhook_environment_mismatch") throw Error("Expected environment rejection");
  }
 } finally {Deno.serve=serve;globalThis.fetch=fetchOriginal;keys.forEach((k,i)=>previous[i]===undefined?Deno.env.delete(k):Deno.env.set(k,previous[i]!));}
});
