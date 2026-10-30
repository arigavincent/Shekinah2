// One configured backend for JSON, encrypted uploads, PDFs and media ranges.
// The destination is server configuration, never a caller-supplied URL.
export async function forwardBackend(request: Request): Promise<Response> {
  const base = (process.env.BACKEND_API_BASE_URL || process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!base) return Response.json({message:"Set BACKEND_API_BASE_URL for the admin server."},{status:503});
  const source = new URL(request.url);
  if(!source.pathname.startsWith("/api/v1/")) return Response.json({message:"Unknown API route"},{status:404});
  const headers = new Headers();
  for(const key of ["accept","authorization","content-type","range","if-range","x-receipt-token","upload-offset","content-length"]) {
    const value=request.headers.get(key);if(value)headers.set(key,value);
  }
  const init: RequestInit & {duplex?: "half"} = {method:request.method,headers,redirect:"manual",signal:request.signal};
  if(!["GET","HEAD"].includes(request.method)){init.body=request.body;init.duplex="half";}
  try {
    const upstream=await fetch(base+source.pathname+source.search,init);
    const responseHeaders=new Headers();
    for(const key of ["content-type","content-disposition","content-range","accept-ranges","etag","last-modified"]) {
      const value=upstream.headers.get(key);if(value)responseHeaders.set(key,value);
    }
    responseHeaders.set("Cache-Control","private, no-store");
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  } catch {return Response.json({message:"The ministry API is temporarily unavailable."},{status:502});}
}
