import { Condition, ConditionalOperator, FlattenObject, FlattenSelector, HttpHeader } from "./interfaces";



const AllowedConditionalOperators = new Set<string>(["$lt","$lte","$eq","$ne","$gte","$gt","$exists","$within","$nwithin","$regex","$in","$nin"]);



export class Utils {

    /**
     * 
     * @param value 
     * @param condition {$gt :5}
     * @returns true if value matches the condition else returns false
     */
    static checkIfValuePassesConditions(value:any, condition:Condition):boolean{
        const valueType = Utils.toType(value);
        const op=Object.keys(condition)[0];
        //@ts-ignore
        const opValue=condition[op];
        const opValueType=Utils.toType(opValue);

        switch(op){
            case "$lt":{
                if(value<opValue){
                    return true;
                }
                break;
            }
            case "$lte":{
                if(value<=opValue){
                    return true;
                }
                break;
            }
            case "$eq":{
                if(value===opValue){
                    return true;
                }
                break;
            }
            case "$gte":{
                if(value>=opValue){
                    return true;
                }
                break;
            }
            case "$gt":{
                if(value>opValue){
                    return true;
                }
                break;
            }
            case "$exists":{
                if(opValueType==="boolean"){
                    if(opValue){
                        //value should exist
                        if(valueType !== "undefined"){
                            return true;
                        }
                    }else{
                        //value should not exist
                        if(valueType === "undefined"){
                            return true;
                        }
                    }
                }
                break;
            }
            case "$within":{
                if(opValueType==="array" && opValue.length==2){
                    if(value>=opValue[0] && value<=opValue[1]){
                        return true;
                    }
                }
                break;
            }
            case "$nwithin":{
                if(opValueType==="array" && opValue.length==2){
                    if(value<opValue[0] && value>opValue[1]){
                        return true;
                    }
                }
                break;
            }
            case "$regex":{
                if(opValueType==="regexp"){
                    return (opValue as RegExp).test(value);
                }
                break;
            }
            case "$in":{
                if(opValueType==="array"){
                    return opValueType.includes(value);
                }
                break;
            }
            case "$nin":{
                if(opValueType==="array"){
                    return !opValueType.includes(value);
                }
                break;
            }
        }
        //"$lt"|"$lte"|"$eq"|"$ne"|"$gte"|"$gt"|"$exists"|"$within"|"$nwithin"|"$regex"|"$in"|"$nin";
        return false;
    }

    static toType(obj: any): "number" | "null" | "undefined" | "array" | "object" | "string" | "date" | "boolean"|"regexp" {
        //@ts-ignore
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
    }

    /**
     * While calling only obj needs to be provided, rest all values are used by recursion.
     * @param selector which needs to be flattened 
     * @param result do not provide when calling this function outside recursion
     * @param ongoingkey do not provide when calling this function outside recursion
     * 
     * console.log(Utils.selectorFlatter({name:"User1",info:{age: {$gt: 30},isDev: true}}));
     * ```
     *  {
     *   "name":{$eq: "User1"},
     *   "info.age":{$gt : 30},
     *   "info.isDev": {$eq: true}
     *  }
     * ```
     * 
console.log(flatter({
    name:"User1",
    info:{
        age: {$gt: 30, help: {color: "red"}},
        isDev: true
    }
}))

```
 {
  name: { "$eq": "User1" },
  "info.age.$gt": { "$eq": 30 },
  "info.age.help.color": { "$eq": "red" },
  "info.isDev": { "$eq": true }
}
```
     * 
     */
    static selectorFlatter(selector:any, result:{[key:string]:FlattenObject}={}, ongoingkey:string=""):FlattenSelector{
        let t = Utils.toType(selector);
        switch(t){
           case "object":
                const keys=Object.keys(selector);
                if(keys.length==1){
                    const k = keys[0];
                    if(AllowedConditionalOperators.has(k)){
                        //key is conditional operator
                        result[ongoingkey.substring(1)]=selector;
                        return selector;
                    }else{
                        Utils.selectorFlatter(selector[k],result,`${ongoingkey}.${k}`)
                    }
                }else{
                    for(let k in selector){
                        Utils.selectorFlatter(selector[k],result,`${ongoingkey}.${k}`);
                    }
                }
                break;
           default:
               result[ongoingkey.substring(1)]={$eq: selector};
               break;
        }
        return result;
    }

    /**
     * Only pass obj, do not pass other arguments, they are used by recursion.
     * @param obj 
     * @param result 
     * @param ongoingkey 
     */
    static flattenObjects(obj:any, result:{[key:string]:{[op:string]:any}}={}, ongoingkey:string=""):FlattenObject{
        let t = Utils.toType(obj);
        switch(t){
           case "object":
                for(let k in obj){
                    Utils.flattenObjects(obj[k],result,`${ongoingkey}.${k}`);
                }
                break;
           default:
               result[ongoingkey.substring(1)]=obj;
               break;
        }
        return result;
    }

    /**
     * * build_path("https://my.com/proxy/db","/some1/db?a=12") > "https://my.com/proxy/db/some1/db?a=12"
     * * build_path("https://my.com/proxy/db/","/some1/db?a=12") > "https://my.com/proxy/db/some1/db?a=12"
     * @param args 
     */
    static build_path(...args:string[]):string{
        return args.map((part, i) => {
          if (i === 0) {
            return part.trim().replace(/[\/]*$/g, '')
          } else {
            return part.trim().replace(/(^[\/]*|[\/]*$)/g, '')
          }
        }).filter(x=>x.length).join('/')
    }

    static combine_headers(...headers:HttpHeader[]):HttpHeader{
        return headers.reduce((p,c)=>{
            return {...p,...c};
        },{});
    }
}

