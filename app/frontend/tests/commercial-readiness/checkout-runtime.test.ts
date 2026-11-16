Deno.test("Lemon checkout authenticates, maps variants and fails closed", async () => {
 const originalFetch=globalThis.fetch, originalServe=Deno.serve;
 const env:Record<string,string>={SUPABASE_URL:"http://127.0.0.1:54321",SUPABASE_SERVICE_ROLE_KEY:"test-only",LEMONSQUEEZY_API_KEY:"test-only",APP_11941c8fec_LEMONSQUEEZY_STORE_ID:"test-store"};
 for(const tier of ["BALANCED","FAMILY"]) for(const billing of ["MONTHLY","YEARLY"]) env["APP_11941c8fec_LEMONSQUEEZY_"+tier+"_"+billing+"_VARIANT_ID"]=tier+"-"+billing;
 const previous=Object.fromEntries(Object.keys(env).map(k=>[k,Deno.env.get(k)]));
 let handler:(r:Request)=>Response|Promise<Response>;
 let used=false, lookupError=false, providerError=false, calls=0, payload:any;
 try {
  for(const [k,v] of Object.entries(env)) Deno.env.set(k,v);
  Deno.serve=((h:typeof handler)=>{handler=h;return {};}) as typeof Deno.serve;
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=new URL(input instanceof Request?input.url:String(input));
   if(url.hostname==="127.0.0.1" && url.pathname==="/auth/v1/user") return Response.json({id:"00000000-0000-0000-0000-000000000001",email:"test@example.invalid",aud:"authenticated",role:"authenticated"});
   if(url.hostname==="127.0.0.1" && url.pathname.includes("/rest/v1/app_11941c8fec_subscriptions")) return lookupError?Response.json({message:"test error"},{status:500}):Response.json({trial_used:used});
   if(url.href==="https://api.lemonsqueezy.com/v1/checkouts"){calls++;payload=JSON.parse(input instanceof Request?await input.text():String(init?.body));return providerError?Response.json({error:"test"},{status:502}):Response.json({data:{id:"test",attributes:{url:"https://example.invalid/checkout"}}});}
   throw Error("Unexpected network request");
  }) as typeof fetch;
  await import("../../supabase/functions/app_11941c8fec_lemonsqueezy_checkout/index.ts");
  const request=(body:unknown,auth=true)=>new Request("http://localhost/checkout",{method:"POST",headers:auth?{Authorization:"Bearer test","Content-Type":"application/json"}:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const check=(actual:unknown,expected:unknown)=>{if(actual!==expected)throw Error(JSON.stringify({actual,expected}));};
  check((await handler!(request({},false))).status,401);
  check((await handler!(request({tier:"free",billing:"monthly"}))).status,400);
  check(calls,0);
  for(const tier of ["balanced","family"]) for(const billing of ["monthly","yearly"]) {
   used=billing==="yearly";
   check((await handler!(request({tier,billing,successUrl:"https://evil.invalid",user_id:"forged"}))).status,200);
   check(payload.data.relationships.variant.data.id,tier.toUpperCase()+"-"+billing.toUpperCase());
   check(payload.data.attributes.checkout_data.custom.user_id,"00000000-0000-0000-0000-000000000001");
   check(payload.data.attributes.checkout_options.skip_trial,used);
   check(payload.data.attributes.product_options.redirect_url,undefined);
  }
  lookupError=true;
  check((await handler!(request({tier:"balanced",billing:"monthly"}))).status,503);check(calls,4);
  lookupError=false;providerError=true;
  check((await handler!(request({tier:"balanced",billing:"monthly"}))).status,502);
 } finally {
  globalThis.fetch=originalFetch;Deno.serve=originalServe;
  for(const [k,v] of Object.entries(previous)) if(v===undefined) Deno.env.delete(k);else Deno.env.set(k,v);
 }
});
