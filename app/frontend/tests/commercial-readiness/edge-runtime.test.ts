// Isolated HTTP test: real Edge handler and Supabase SDK, fake local auth/database.
Deno.test("coach denies unauthorized and free users before external AI calls", async () => {
  const oldFetch = globalThis.fetch;
  const oldServe = Deno.serve;
  const oldUrl = Deno.env.get("SUPABASE_URL");
  const oldKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let handler: (req: Request) => Response | Promise<Response>;
  let tier = "free";
  let status = "active";
  let invalid = false;
  let externalCalls = 0;
  try {
    Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "isolated-test-key");
    Deno.serve = ((h: typeof handler) => { handler = h; return {}; }) as typeof Deno.serve;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname !== "127.0.0.1") { externalCalls++; throw Error("External network forbidden"); }
      if (url.pathname === "/auth/v1/user" && invalid) return Response.json({message:"invalid token"},{status:401});
      if (url.pathname === "/auth/v1/user") return Response.json({id:"00000000-0000-0000-0000-000000000001",aud:"authenticated",role:"authenticated"});
      if (url.pathname.includes("/rest/v1/app_11941c8fec_subscriptions")) return Response.json({tier,status,trial_used:false,trial_started_at:null,trial_expires_at:null});
      throw Error("Unexpected request");
    }) as typeof fetch;
    await import("../../supabase/functions/app_11941c8fec_ai_life_coach/index.ts");
    const request = (auth: boolean) => new Request("http://localhost/coach",{method:"POST",headers:auth?{Authorization:"Bearer isolated-token","Content-Type":"application/json"}:{"Content-Type":"application/json"},body:"{}"});
    for (const [auth,plan,expected] of [[false,"free",401],[true,"free",403],[true,"balanced",400],[true,"family",400]] as const) {
      tier=plan;
      const res=await handler!(request(auth));
      if(res.status!==expected) throw Error(plan+": expected "+expected+", got "+res.status);
    }
    for (const load of [
      () => import("../../supabase/functions/app_11941c8fec_ai_search/index.ts"),
      () => import("../../supabase/functions/app_11941c8fec_receipt_scan/index.ts")
    ]) {
      await load();
      for (const [plan,state,expected] of [["free","active",403],["family","expired",403],["balanced","active",400],["family","active",400]] as const) {
        tier=plan; status=state;
        const res=await handler!(request(true));
        if(res.status!==expected) throw Error(plan+"/"+state+": "+res.status);
      }
      invalid=true;
      if((await handler!(request(true))).status!==401) throw Error("Invalid token accepted");
      invalid=false;
    }
    await import("../../supabase/functions/app_11941c8fec_family_invite/index.ts");
    status="active";
    for(const plan of ["free","balanced"]) {
      tier=plan;
      const res=await handler!(new Request("http://localhost/invite",{method:"POST",headers:{Authorization:"Bearer isolated-token","Content-Type":"application/json"},body:JSON.stringify({action:"send",email:"test@example.invalid"})}));
      if(res.status!==403) throw Error("Family gate: "+res.status);
    }
    await import("../../supabase/functions/app_11941c8fec_paddle_checkout/index.ts");
    const flag=Deno.env.get("AMANAH_ENABLE_PADDLE_NEW_CHECKOUT");
    try {
      Deno.env.delete("AMANAH_ENABLE_PADDLE_NEW_CHECKOUT");
      if((await handler!(request(true))).status!==403) throw Error("Paddle not disabled");
    } finally { if(flag!==undefined) Deno.env.set("AMANAH_ENABLE_PADDLE_NEW_CHECKOUT",flag); }
    if(externalCalls!==0) throw Error("Unexpected external call");
  } finally {
    globalThis.fetch=oldFetch; Deno.serve=oldServe;
    if(oldUrl===undefined) Deno.env.delete("SUPABASE_URL"); else Deno.env.set("SUPABASE_URL",oldUrl);
    if(oldKey===undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY"); else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY",oldKey);
  }
});
