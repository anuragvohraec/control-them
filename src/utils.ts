import { Condition, HttpHeader } from "./interfaces";
import {Request} from 'express';
import crypto from 'crypto';

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
                if(value==opValue){
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
                    return opValue.test(value);
                }
                break;
            }
            case "$in":{
                if(opValueType==="array"){
                    for(let ov of opValue){
                        //yes ==
                        if(ov==value){
                            return true;
                        }
                    }
                }
                break;
            }
            case "$nin":{
                if(opValueType==="array"){
                    for(let ov of opValue){
                        //yes ==
                        if(ov==value){
                            return false;
                        }
                    }
                    return true;
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

    /**
     * if you have converted a request stream to JSON, use this method to convert it back to 
     * @param req 
     */
    static async convertBackToEvent(req:Request){
        if(req.body){
          //remove listeners set by bodyParser
          req.removeAllListeners('data');
          req.removeAllListeners('end');
      
          return new Promise((res,rej)=>{
            req.emit('data', JSON.stringify(req.body));
            req.emit('end');
            res(true);
          });
        }
    }
    
    static random_string(length:number) {
        let result           = '';
        const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        const charactersLength = characters.length;
        for ( var i = 0; i < length; i++ ) {
           result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
     }

    public static random_id({seed,hash}:{seed?:string,hash?:string}){
        let t = this.random_string(10)+`${Date.now}`;
        t = seed?t+seed:t;
        const sha1 = crypto.createHash(hash??'sha256');
        sha1.update(t);
        return sha1.digest('hex');
    }

    public static hashSomeString({input,hash="sha256"}:{input:string,hash?:string}):string{
        const sha1 = crypto.createHash(hash);
        sha1.update(input);
        return sha1.digest('hex');
    }
}

