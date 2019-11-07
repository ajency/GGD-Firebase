import * as Razorpay from "razorpay";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import * as crypto from 'crypto';
import * as _ from 'underscore';

const config = require('../../config.json');
let razorpay_secret = "7j4YD1RIqIrEn0yfw7IugMSz";
let instance = new Razorpay({
    key_id:'rzp_test_FSfmJofoQNnVG6',
    key_secret:razorpay_secret
});
let PaymentGateway = {
    /* Todo
        * create payment tables
        * function to update order in orders table
        *
    */
    createOrder: async (req: Request, res: Response) => {
        try {
                let amount = req.body.amount *100
               return await instance.orders.create({amount:amount,currency:'INR',receipt: req.body.order_id,payment_capture:1,notes:{}})
                .then((data) => {
                    console.log(JSON.stringify(data))
                    return res.status(200).send({order_id:data.id})
                }).catch(err => {
                    console.log(JSON.stringify(err))
                    return res.status(500).send({message: err.error.description})
                })  
        } catch(err) {
             return PaymentGateway.handleError(res,err)
        }
        
        
    },

    fetchOrder: async (orderId) => {
 
    },

    verifySignature: (req: Request, res: Response) => {
        try {
            let {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body
            let r_order_id = req.query.r_order_id;
            let text = razorpay_order_id + "|" + razorpay_payment_id;
            let generated_signature = crypto.createHmac('sha256',razorpay_secret).update(text).digest('hex');
            if (generated_signature == razorpay_signature) {
                console.log(generated_signature +"=="+ razorpay_signature)
                return res.redirect(config.frontendUrl+"#/order-summary/"+r_order_id)
            } else {
                console.log("verification failed", r_order_id)
                return res.redirect(config.frontendUrl+"#/order-summary/"+r_order_id)
            }
        } catch(e) {
            console.log(e);
            return res.redirect(config.frontendUrl+"#/cart")
                    
        }
    },

    async getRazorpayOrder(order_id) {
        return await instance.orders.fetch(order_id).then((res) => {
            console.log(res)
            return res
        })
    },

    

    handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
    },
    
    
}

export default PaymentGateway;