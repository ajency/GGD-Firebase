import * as Razorpay from "razorpay";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import * as crypto from 'crypto';

const cred = require('../../credentials.json');
const config = require('../../config.json');
let instance = new Razorpay({
    key_id:cred.razorpay_api_key,
    key_secret:cred.razorpay_secret
});
let PaymentGateway = {
    /* Todo
        * create payment tables
        * function to update order in orders table
        *
    */
    createOrder: async (req: Request, res: Response) => {
        try {
                console.log("create order ")
                let amount = req.body.amount *100
                let firestore = admin.firestore();
                let cart_ref =  await firestore.collection('carts').doc(req.body.order_id).get()
                let user_ref = await firestore.collection('user-details').doc(req.body.order_id)
                let cart_data = cart_ref.data()
                cart_data.created_at = undefined
                cart_data.order_type = undefined
                cart_data = JSON.parse(JSON.stringify(cart_data))
                cart_data["status"] = "draft";
                let order_ref = await user_ref.collection('orders').add({
                    ...cart_data, ...{food_status: '', delivery_status:''}
                })
                
                let razorpay_receipt = order_ref.id;
                
                return await instance.orders.create({amount:amount,currency:'INR', receipt: razorpay_receipt, payment_capture:1,notes:{}})
                .then(async (data) => {
                   let payment_ref = await firestore.collection('payments').add({
                        pg_order_id: data.id,
                        order_id:order_ref.id,
                        user_id:req.body.order_id,
                        status:"draft"
                    })
                    console.log("Payment id ==> ", payment_ref.id)
                    firestore.collection("user-orders-map").add({
                        "user_id": req.body.order_id,
                        "order_id": order_ref.id
                    })
                    .then((r) => console.log("user order map created ===> "+ r.id))
                    .catch(e => console.log("user order mappinf error ===> "+ e ))
                    await firestore.collection('carts').doc(req.body.order_id).update({
                        status:"draft",
                        order_id:order_ref.id
                    })

                    return res.status(200).send({order_id:data.id})
                }).catch(err => {
                    console.log(JSON.stringify(err))
                    return res.status(500).send({message: err.error.description})
                })
        } catch(err) {
             return PaymentGateway.handleError(res,err)
        }
        
        
    },

    verifySignature: async (req: Request, res: Response) => {
        let {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body
        let append ='', rp_order;
        let redirect_url
        let site_mode = req.query.site_mode
        rp_order = await PaymentGateway.getRazorpayOrder( req.query.r_order_id)
        redirect_url = config.frontendUrl+"#/order-summary/"+ req.query.r_order_id;
        if(site_mode) {
            append = `${site_mode}/`
            redirect_url = config.frontendUrl+append+"#/order-details/"+rp_order.receipt
        } 
        console.log(redirect_url,site_mode)
        try {
            let r_order_id = req.query.r_order_id;
            let text = razorpay_order_id + "|" + razorpay_payment_id;
            let generated_signature = crypto.createHmac('sha256',cred.razorpay_secret).update(text).digest('hex');
            if (generated_signature == razorpay_signature) {
                res.redirect(redirect_url)
            } else {
                res.redirect(redirect_url)
            }
        } catch(e) {
            console.log(e);
            res.redirect(config.frontendUrl+append+"#/cart")
        }
    },

    async getRazorpayOrder(order_id) {
        return await instance.orders.fetch(order_id).then((res) => {
            return res
        })
    },

    

    handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
    },
    
    
}

export default PaymentGateway;