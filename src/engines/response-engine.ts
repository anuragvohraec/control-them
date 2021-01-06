import {Response,Request} from 'express';


export interface ResponseHeaders{
    [key: string]: any;
}

export class ResponseEngine{

    /**
     * 
     * @param req 
     * @param res 
     * @param error 
     */
    static send400(req: Request, res: Response, errorHeader?: string){
        res.status(400);
        if(errorHeader){
            res.header("error",errorHeader);
        }
        res.end();
    }

    static sendState(req:Request, res: Response, status_code: number,headers: ResponseHeaders,type?:string, body?: any){
        res.status(status_code);
        for(let key of Object.keys(headers)){
            res.setHeader(key,headers[key]);
        }
        if(body){
            res.type(type!);
            res.send(body);
            res.end();
        }else{
            res.end();
        }
    }
}