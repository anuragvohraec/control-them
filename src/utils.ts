import { Condition, HttpHeader } from "./interfaces";

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

    static combine_headers(...headers:HttpHeader[]):HttpHeader{
        return headers.reduce((p,c)=>{
            return {...p,...c};
        },{});
    }
}

