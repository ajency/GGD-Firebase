import * as Razorpay from "razorpay";
import * as admin from "firebase-admin";
import { Request, Response } from "express";
import * as crypto from 'crypto';
import * as _ from 'underscore';
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
            let text = razorpay_order_id + "|" + razorpay_payment_id;
            let generated_signature = crypto.createHmac('sha256',razorpay_secret).update(text).digest('hex');
            if (generated_signature == razorpay_signature) {
                console.log(generated_signature +"=="+ razorpay_signature)
                return res.redirect("http://localhost:3000/#/order-details/"+razorpay_payment_id)
            } else {
                console.log("verification failed")
                return res.redirect("http://localhost:3000/#/order-details/"+razorpay_payment_id)
            }
        } catch(e) {
            console.log(e);
            return res.redirect("http://localhost:3000/#/cart")
                    
        }
    },
    

    confirmPayment: async (req:Request, res:Response) => {
        try {
            let {id, order_id, amount, status} = req.body.payload.payment.entity
            amount = amount /100;
            let firestore, data, payment_ref, payment_doc ; 
            let razorpay_order = await PaymentGateway.getRazorpayOrder(order_id)
            firestore = admin.firestore();

            data = {
                order_id:razorpay_order.receipt,
                payment_gateway:'Razorpay',
                pg_payment_id:id,
                pg_order_id:order_id,
                other_details:JSON.stringify(req.body.payload.payment.entity),
                pg_status:status,
                status:status
            }
            payment_ref = firestore.collection('payments').doc();
            payment_doc =await payment_ref.set(data);
            return res.status(200);
        } catch (error) {
            return res.status(500);
        }
       
       
    },

    async getRazorpayOrder(order_id) {
        return await instance.orders.fetch(order_id).then((res) => {
            console.log(res)
            return res
        })
    },

    paymentOrderDetails: async (req:Request, res:Response) => {
        try {
            let firestore = admin.firestore();
            let paymentDoc = await firestore.collection('payments').where("pg_payment_id","==", req.body.payment_id).get()
            if(paymentDoc.docs.length == 0) {
                return res.status(200).send({success:true, pending:1});
            }
            let data = paymentDoc.docs[0].data();
            
            return res.status(200).send({success:true, details: data, pending:0});
        } catch (error) {
            return res.status(500).send({success:false})
        }
    },

    handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
    },
    
    
}

export default PaymentGateway;