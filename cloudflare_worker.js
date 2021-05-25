
async function readRequestBody(request) {
    return await request.text();
  }
  
  async function handleRequest(request) {
    const reqBody = await readRequestBody(request);
    // const reqBody = request.text();
    // const retBody = `The request body sent in was ${reqBody}`
    // return new Response(retBody)
    console.log(reqBody);
    var requestdict=JSON.parse(reqBody);
    var responsedict={"test":"test",
     "raw":JSON.stringify(requestdict)};
  
    var entryperpg=20;
    if ("action" in requestdict && requestdict["action"]=="put"){
      responsedict["status"]="ok";
      responsedict["author"]=requestdict["author"];
      responsedict["content"]=requestdict["content"];
      if (requestdict["content"].length>300 || requestdict["content"].length==0){
          return new Response(err.stack, { status: 500 });
      }
      responsedict["time"]=requestdict["time"];
      // MYBLOGKV.put(requestdict["room"], JSON.stringify(
      //   [requestdict["author"], requestdict["content"], requestdict["time"]]
      // ));
      var indexs_needupdate=false;
      console.log("GET "+requestdict["room"]+"-index");
      var indexs=await MYBLOGKV.get(requestdict["room"]+"-index");
      console.log("VALUE "+indexs)
      batchnum=1;
      // firstbatch=requestdict["room"]+"-batch-";
      if (!indexs){
        indexs=[batchnum];
        indexs_needupdate=true;
      }
      else{
        indexs=JSON.parse(indexs);
        batchnum=indexs[0];
      }
      batch=await MYBLOGKV.get(requestdict["room"]+"-batch-"+batchnum.toString());
      newkey=requestdict["time"];
      newentry=[requestdict["author"], requestdict["content"]];
      if(!batch){
        batch={};
      }else{
          batch=JSON.parse(batch);
      }
      if(Object.keys(batch).length>=entryperpg){
        batch={};
        batchnum+=1;
        indexs=[batchnum].concat(indexs);
        indexs_needupdate=true;
      }
      batch[newkey]=newentry;
      await MYBLOGKV.put(requestdict["room"]+"-batch-"+batchnum.toString(), JSON.stringify(batch));
      if(indexs_needupdate){
        await MYBLOGKV.put(requestdict["room"]+"-index", JSON.stringify(indexs));
      }
      responsedict["batchnum"]=batchnum;
      responsedict["indexs_needupdate"]=indexs_needupdate;
      // myblog-comments.put("hola","mundo");
    }
  
    if ("action" in requestdict && requestdict["action"]=="get") {
        var batchnum=0;
        if ("batchnum" in requestdict){
            batchnum=requestdict["batchnum"];
        }
        var res={};
        var indexs=await MYBLOGKV.get(requestdict["room"]+"-index");
        if (indexs){
            indexs=JSON.parse(indexs);
            if (batchnum<=indexs.length){
                targetbatch=indexs[batchnum];
                var batch=await MYBLOGKV.get(requestdict["room"]+"-batch-"+targetbatch.toString());
                responsedict["data"]=JSON.parse(batch);
            }
        }
    }
    
    return new Response(JSON.stringify(responsedict), {
        headers: { "Content-Type": "text/json" },
      });
  }
  
  addEventListener("fetch", event => {
    const { request } = event
    const { url } = request
  
    if (url.includes("form")) {
      return event.respondWith(rawHtmlResponse(someForm))
    }
    if (request.method === "POST") {
      return event.respondWith(handleRequest(request))
    }
    else if (request.method === "GET") {
      return event.respondWith(new Response(`The request was a GET`))
    }
  })
  