import { Router, json,Request , Response} from "express";
import * as svgCaptcha from 'svg-captcha';
import * as jwt from 'jsonwebtoken';
import { FlattenObject, Utils } from "../../dist";

interface CaptchaData{
    [key:string]:string;
}

export class Rando{
    constructor(private characters:string='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+:\"\''){

    }

    public random_string(length:number):string {
        let result = '';
        const charactersLength = this.characters.length;
        for ( var i = 0; i < length; i++ ) {
           result += this.characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    public random_number_between(min:number,max:number){
        const t = Math.random() * (max - min) + min;
        return Math.floor(t);
    }

}

const captcha_token_header="captcha_token"
const authorization_header="authorization";
const otp_verification_header="otp_token";

export interface SignMeUpConfig{
    /**
     * Provides random strings and numbers
     * default is an inbuilt Rando object
     */
    rando?: Rando;
    /**
     * Salts are added to captcha token.
     * {
     * "some_random_key1":"some_random_value1",
     * "captcha_text_key":"captcha value",
     * "some_random_key2":"some_random_value2"
     * }
     * this defines the length of these random keys.
     * default value is : {max:10,min:5}
     */
    captcha_salt_range_length?:{min:number,max:number};
    /**
     * Length of captcha which will be generated. Default: 5
     */
    captcha_text_length?:number;
    /**
     * Number of cutting random lines on captcha. Default: 4
     */
    captcha_noise?:number;
    /**
     * Captcha expiry is used to track until when this captcha be considered valid.
     * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count. If you use a string be sure you provide the time units (days, hours, etc), otherwise milliseconds unit is used by default ("120" is equal to "120ms").
     * default: 60 seconds
     */
    captcha_expiry?:string | number | undefined;
    /**
     * Captcha which are verified are kept in memory so that one cannot reuse them. 
     * this defines the size for that. After which it will clean up this memory and start from fresh.
     * default: 100000
     */
    max_captcha_session_size?:number;
    /**
     * Path to be used for signing up
     * default: /sign-me-up
     */
    sign_me_up_path?:string;
    /**
     * on submission of sign up data.
     * user need to post the sign up  form data in json format (with a mandatory field captcha), this restricts the maximum size of such a form.
     * default: 500
     */
    sign_up_form_data_limit?:number;
    /**
     * JWT expiry period.
     * Eg: 60, "2 days", "10h", "7d". A numeric value is interpreted as a seconds count. If you use a string be sure you provide the time units (days, hours, etc), otherwise milliseconds unit is used by default ("120" is equal to "120ms").
     * default: 120 days
     */
    jwt_expiry?:string | number | undefined;

    /**
     * Log in path
     * default: /verify-otp
     */
    otp_path?:string;
}

export interface SignUpFormData{
    captcha:string;
    [key:string]:any;
}


/**
 * If form data is correct, this function should save it in whatever medium they wanted to save it.
 * And generate a token object , info they wanted to be on Json web token.
 * If the form data provide is failed, then this function **must** use response object to send response to user and return undefined as output of this function.
 * However if form data is all good and has been saved, this fuction should not send response to user, instead simply return the authentication token.
 * returns a main authentication token if form data is submitted successfully. 
 */
export interface FormSubmitFunction<K extends FlattenObject>{
    (form_data:FlattenObject, req:Request, res:Response):Promise<K|undefined>
}

/**
 * Provides a router with following algo:
 * 1. if a request without **authorization** header is made, than it will respond with SVG captcha, and captcha_token header (to verify the captcha latter).
 * 2. if a valid **authorization** header is given than it will add auth_token_data to request and call next, so that next function in the call stack can use this.
 * 
 * For sign up.
 * O is OTP token object class
 * T is Final authentication token object class
 */
export class SignMeUpEngine<O extends FlattenObject, T extends FlattenObject>{
    private router!: Router;
    private signMeUpConfig:  SignMeUpConfig;

    private ALGORITHM:jwt.Algorithm="RS256";
    private captcha_session:FlattenObject={};
    private captcha_verified:number=0;


    /**
     * 
     * @param CAPTCHA_TOKEN_SECRET a random string (whose reference must be known to application) of 256 length
     * @param JWT_TOKEN_SECRET a random string (whose reference must be known to application) of 256 length
     * @param captcha_text_key a random string (whose value muts be known to application), ideal length will be 5-10.
     * @param signUpFormSubmitFunction this submits the form and gives a authentication token object, which is than converted to JWT by SignMeUpEngine. This function is also tasked with sending OTP to user, via which ever channel.
     * @param config : A default set of config is used if not provided.
     */
    constructor(private CAPTCHA_TOKEN_SECRET:string, private OTP_TOKEN_SECRET:string,private AUTH_TOKEN_SECRET:string, private captcha_text_key:string, private signUpFormSubmitFunction: FormSubmitFunction<O>, private verifyOTPSubmitFunction:FormSubmitFunction<T> , config?:SignMeUpConfig){
        if(CAPTCHA_TOKEN_SECRET.length!==256 || OTP_TOKEN_SECRET.length!==256 ||  AUTH_TOKEN_SECRET.length!==256){
            throw `Token secret must be of length 256`;
        }

        const defaultConfig: SignMeUpConfig={
            rando:new Rando(),
            captcha_expiry: 60,
            captcha_noise:4,
            captcha_salt_range_length:{max:10,min:5},
            captcha_text_length:5,
            max_captcha_session_size: 100000,
            sign_me_up_path:"/sign-me-up",
            sign_up_form_data_limit: 500,
            jwt_expiry: "120 days",
            otp_path:"/verify-otp"
        }

        this.signMeUpConfig={...defaultConfig, ...config};
    }

    handle():Router{
        this.router = Router();
        try{

            //this checks if valid captcha token is present or not , else will reject the request.
            this.router.post(this.signMeUpConfig.sign_me_up_path!,async(req,res,next)=>{
                //if a request do not contains captcha_token than send 401
                const cap_header = req.headers[captcha_token_header];

                const capHeaderType = Utils.toType(cap_header);
                if(capHeaderType==="array"){
                    return res.sendStatus(401);
                }

                if(!cap_header){
                    return res.sendStatus(401);
                }else{
                    if(typeof cap_header === "string"){
                        //verify the token and than we will parse the request for sign up form
                        const captcha_token_sent = await new Promise<CaptchaData>(res=>{
                            try{
                                jwt.verify(cap_header,this.CAPTCHA_TOKEN_SECRET,{
                                    algorithms: [this.ALGORITHM],
                                },(e,token)=>{
                                    if(e){
                                        res(undefined);
                                    }else{
                                        res(token as CaptchaData);
                                    }
                                })
                            }catch(e){
                                res(undefined);
                            }
                        });
                        
                        if(!captcha_token_sent){
                            return res.sendStatus(401);    
                        }else{
                            const captcha = captcha_token_sent[this.captcha_text_key];
                            
                            //refreshes captcha sessions if maximum size is reached
                            if(this.captcha_verified>this.signMeUpConfig.max_captcha_session_size!){
                                this.captcha_verified=0;
                                this.captcha_session={};
                            }
                            //if captcha session already contains this , then reject the captcha.
                            if(this.captcha_session[captcha]){
                                //too many request
                                return res.sendStatus(409);
                            }else{
                                this.captcha_session[captcha]=true;
                            }

                            (req as any).captcha_sent = captcha;
                            next();
                        }
                    }else{
                        return res.sendStatus(401);
                    }
                }
            });

            this.router.post(this.signMeUpConfig.sign_me_up_path!,json({
                limit: this.signMeUpConfig.sign_up_form_data_limit
            }));

            this.router.post(this.signMeUpConfig.sign_me_up_path!,async (req,res,next)=>{
                //here we will verify if the captcha text supplied is correct or not.
                const captcha_sent = (req as any).captcha_sent;
                const captcha_in_form = req.body["captcha"];
                if(captcha_in_form!==captcha_sent){
                    return res.sendStatus(401);
                }else{
                    //we will submit the form here
                    const otp_token = await this.signUpFormSubmitFunction(req.body, req ,res);
                    if(otp_token && Object.keys(otp_token).length>0){
                        const otp_token_str = await new Promise<string>(res=>{
                            try{
                                jwt.sign(otp_token,this.OTP_TOKEN_SECRET,{
                                    algorithm:this.ALGORITHM,
                                    expiresIn: this.signMeUpConfig.jwt_expiry
                                },(e,token)=>{
                                    if(e){
                                        res(undefined);
                                    }else{
                                        res(token);
                                    }
                                });
                            }catch(e){
                                res(undefined);
                            }
                        })
                        if(!otp_token_str){
                            return res.sendStatus(500);
                        }else{
                            res.setHeader(otp_verification_header,otp_token_str);
                            return res.sendStatus(201);
                        }
                    }
                    return;
                }
            });
            

            this.router.use("/",async (req,res,next)=>{
                //check if request has a authorization header, if not than simply return SVG
                //along with header : captcha_token
                //captcha_token will be jwt signed data:{salt captcha text, salt}
                const auth_header = req.headers[authorization_header];
                
                //this check ensure only one auth header can be sent
                const authHeaderType = Utils.toType(auth_header);
                if(authHeaderType==="array"){
                    return res.sendStatus(401);
                }

                if(!auth_header){
                    const svgData = svgCaptcha.create({
                        size: this.signMeUpConfig.captcha_text_length,
                        noise:this.signMeUpConfig.captcha_noise,
                        color:false
                    });
                    //@ts-ignore
                    const captcha_token_data:CaptchaData = {}
                    captcha_token_data[this.signMeUpConfig.rando!.random_string(this.signMeUpConfig.rando!.random_number_between(this.signMeUpConfig.captcha_salt_range_length!.min,this.signMeUpConfig.captcha_salt_range_length!.max))]=this.signMeUpConfig.rando!.random_string(this.signMeUpConfig.rando!.random_number_between(this.signMeUpConfig.captcha_salt_range_length!.min,this.signMeUpConfig.captcha_salt_range_length!.max));
                    captcha_token_data[this.captcha_text_key]=svgData.text;
                    captcha_token_data[this.signMeUpConfig.rando!.random_string(this.signMeUpConfig.rando!.random_number_between(this.signMeUpConfig.captcha_salt_range_length!.min,this.signMeUpConfig.captcha_salt_range_length!.max))]=this.signMeUpConfig.rando!.random_string(this.signMeUpConfig.rando!.random_number_between(this.signMeUpConfig.captcha_salt_range_length!.min,this.signMeUpConfig.captcha_salt_range_length!.max));

                    const captcha_token=await new Promise<string>((res)=>{
                        jwt.sign(captcha_token_data,this.CAPTCHA_TOKEN_SECRET,{algorithm:this.ALGORITHM,expiresIn: this.signMeUpConfig.captcha_expiry},(e,token)=>{
                            if(e){
                                res(undefined);
                            }else{
                                res(token);
                            }
                        })
                    });
                    if(!captcha_token){
                        console.error("No captcha token created");
                        return res.sendStatus(500);
                    }else{
                        res.contentType("image/svg+xml");
                        res.setHeader(captcha_token_header,captcha_token);
                        return res.send(svgData.data);
                    }
                }else{
                    const auth_token_data = await new Promise<T>(res=>{
                        try{
                            jwt.verify(auth_header,this.AUTH_TOKEN_SECRET,{
                                algorithms: [this.ALGORITHM],
                            },(e,token)=>{
                                if(e){
                                    res(undefined);
                                }else{
                                    res(token as unknown as T);
                                }
                            })
                        }catch(e){
                            res(undefined);
                        }
                    });
                    
                    if(!auth_token_data){
                        return res.sendStatus(401);
                    }else{
                        //@ts-ignore
                        req["auth_token_data"]=auth_token_data;
                        return next();
                    }
                }
            })
        }catch(e){
            console.error(e);
            this.router.use((req,res)=>{
                return res.sendStatus(500);
            })
        }
        return this.router;
    }
}