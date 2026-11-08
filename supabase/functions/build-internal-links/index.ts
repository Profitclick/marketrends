// Bounded full-corpus reconciliation, followed by change-queue processing.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireAdmin, unauthorized } from "../_shared/admin-auth.ts";
const bodySchema = z.object({limit:z.number().int().min(1).max(500).default(250),batches:z.number().int().min(1).max(20).default(1),reset:z.boolean().default(false),dry_run:z.boolean().default(false)});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 const gate=await requireAdmin(req);if(!gate.ok)return unauthorized(corsHeaders);
 const db=gate.supabase;
 const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
 try {
  const parsed=bodySchema.safeParse(await req.json().catch(()=>({})));if(!parsed.success)return json({error:parsed.error.flatten()},400);
  const input=parsed.data;
  const before=await db.rpc('phase7c_link_audit');if(before.error)throw before.error;
  if(input.dry_run)return json({ok:true,dry_run:true,before:before.data});
  const references=await db.rpc('phase7c_reference_links');if(references.error)throw references.error;
  let progress:{processed_batch?:number;complete?:boolean;queued?:number}={};let processed=0;
  for(let i=0;i<input.batches;i++){
   const result=await db.rpc('phase7c_link_batch',{p_limit:input.limit,p_reset:i===0&&input.reset});
   if(result.error)throw result.error;progress=result.data;processed+=progress.processed_batch as number;
   if(progress.processed_batch===0 || (progress.complete && progress.queued===0))break;
  }
  const after=await db.rpc('phase7c_link_audit');if(after.error)throw after.error;
  return json({ok:true,processed_articles:processed,progress,before:before.data,after:after.data,reference_links:references.data});
 } catch(e){return json({error:e instanceof Error?e.message:typeof e==='object'&&e!==null?JSON.stringify(e):String(e)},500);}
});
