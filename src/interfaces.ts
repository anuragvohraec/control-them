
import { PathDirection } from "./engines/compass";
import {Request} from 'express';

//Have to add $in
export type ConditionalOperator = "$lt"|"$lte"|"$eq"|"$neq"|"$gte"|"$gt"|"$exists"|"$within"|"$nwithin"|"$regex"|"$in"|"$nin";
export type Condition = {$lt:number|string}|{$lte:number|string}|{$eq:any}|{$neq:any}|{$gte:number|string}|{$gt:number|string}|{$exists:boolean}|{$within:number[]|string[]}|{$nwithin:number[]|string[]}|{$regex:RegExp}|{$in:any[]}|{$nin:any[]};
export type ConditionalStatement = Record<string,Condition>
/**
 * minimum_expected_headers: this url expect at least this many expected headers
 */
export type MethodsPermission={query_param?:ConditionalStatement, minimum_expected_headers?:ConditionalStatement, request_authenticator?:ControlledRequestAuthenticator}

export type HTTPMethods = "HEAD" | "GET" | "PUT" | "POST" | "DELETE";
export type UrlPermission=Partial<Record<HTTPMethods,MethodsPermission>>
/**
*```js 
* {
*  "some/url/": {  //URL
*      "PUT": { //METHODs
*           query_param?:{ "limit":{"$within":[25,30]}, "start_key":{"$exists":true} },//if no query param defined, than it won't allow any query param
*           expected_headers?: { "some_header": {$eq: "some_value"}}
*           request_authenticator?: async(req:ControlledRequest)=>{
*                   return true;
*               }
*           }
*   }
* }
* ```
*/
export type ControlThemPermissions=Record<string,UrlPermission>

export interface JWTTokenInfoValidator{
    (token:FlattenObject):Promise<boolean>;
}

export type FlattenObject = {
    [key : string]: any;
};

export interface FlattenSelector{
    [key:string]:FlattenObject;
}

export interface HttpHeader{
    [key:string]:any
}

export interface ControlledRequest extends Request{
    control_them_info:{
        method: HTTPMethods;
        path_direction:PathDirection;
        query_params?:FlattenObject;
        headers?:FlattenObject;
    }
}

export interface ControlledRequestAuthenticator{
    (control_req:ControlledRequest):Promise<boolean>;
}