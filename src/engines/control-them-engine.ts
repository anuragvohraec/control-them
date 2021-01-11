import { Router } from "express";
import { Condition, ConditionalStatement, ControlledRequest, ControlledRequestAuthenticator, ControlThemPermissions, HttpHeader, HTTPMethods } from "../interfaces";
import { Utils } from "../utils";
import { Compass, PathDirection } from "./compass";

 export class ControlThem {
    private compass:Compass;
    private  router:Router;

    /**
     * 
     * @param controlThemPermissions permissions for each url
     * @param routerControlledRequestAuthenticator authentication that needs to be done on each request
     * @param router_minimum_expected_headers minium expected headers for each request, gets overridden by url permission headers though.
     */
     constructor(private controlThemPermissions: ControlThemPermissions,private routerControlledRequestAuthenticator?:ControlledRequestAuthenticator, private router_minimum_expected_headers?:ConditionalStatement){
        this.compass=new Compass();
        for(let url of Object.keys(controlThemPermissions)){
            this.compass.define(url);
        }   
        this.router=Router();
     }

     control():Router{
        try{
            this.router.use(async(req,res,next)=>{
                const matchResult:PathDirection|undefined = this.compass.find(req.path);
                if(!matchResult){
                    return res.status(404).send({error:"control-them!: No such path configured"});
                }else{
                    const urlPermissions = this.controlThemPermissions[matchResult.matched_pattern];
                    const method: HTTPMethods=(req.method.toUpperCase() as HTTPMethods);
                    const methodPermissions= urlPermissions[method];
                    if(!methodPermissions){
                        return res.sendStatus(405).send({error:"control-them!: Method not allowed"});
                    }else{
                         //match number of query params supplied
                        const req_query_param_length=req.query?Object.keys(req.query).length:0;
                        const mp_query_param_length=methodPermissions.query_param?Object.keys(methodPermissions.query_param).length:0;
                        if(mp_query_param_length!==req_query_param_length){
                            return res.status(400).send({error:`This url expects ${mp_query_param_length} query parameters ${methodPermissions.query_param?Object.keys(methodPermissions.query_param):""} and request has ${req_query_param_length}`});
                        }
                        if(methodPermissions.query_param){
                            //this means both has same number of query params
                            for(let q of Object.keys(req.query)){
                                const condition = methodPermissions.query_param[q];
                                if(!condition){
                                    return res.status(400).send({error:`This url expects ${Object.keys(methodPermissions.query_param)} query parameters`}); 
                                }else{
                                    const passed_check = Utils.checkIfValuePassesConditions(req.query[q],condition);
                                    if(!passed_check){
                                        return res.status(400).send({error:`Query param ${q} value should be ${JSON.stringify(condition)}`}); 
                                    }
                                }
                                
                            }
                        }

                        //match headers requirement
                        const combined_headers: HttpHeader = Utils.combine_headers(this.router_minimum_expected_headers||{}, methodPermissions.minimum_expected_headers||{});
                        const h_keys = Object.keys(combined_headers);
                        for(let h of h_keys){
                            const condition:Condition = combined_headers[h];
                            const req_header_value=req.headers[h];
                            if(!req_header_value){
                                return res.status(400).send({error:`Not all request headers supplied: ${h_keys}`}); 
                            }else{
                                if(!Utils.checkIfValuePassesConditions(req_header_value,condition)){
                                    const op = Object.keys(condition)[0];
                                    let c = JSON.stringify(condition);
                                    if(op === "$regex"){
                                        //@ts-ignore
                                        c=`{$regex: ${condition[op].toString()}}`;
                                    }
                                    return res.status(400).send({error:`Header ${h} value should be ${c}`}); 
                                }
                            }
                        }

                        //@ts-ignore
                        const cont_req:ControlledRequest = (req as ControlledRequest);
                        cont_req.control_them_info={
                            method,
                            path_direction:matchResult,
                            headers:combined_headers,
                            query_params:req.query
                        }

                        //verify request verifier
                        if((this.routerControlledRequestAuthenticator && !await this.routerControlledRequestAuthenticator(cont_req))||(methodPermissions.request_authenticator&& !await methodPermissions.request_authenticator(cont_req))){
                            return res.status(401).send({error:"control-them!: Authentication failed!"});
                        }
                    }   
                }
                return next();
            })
            return this.router;
        }catch(e){
            console.error(e);
            this.router.use("/",(req,res)=>{
                res.status(500).send({error: "Server failed to configure control them!"});
            })
        }
        return this.router;
     }
 }