import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import Products from './ProductController';
import Locations from './LocationsController';
import { insidePolygon, headingDistanceTo } from 'geolocation-utils';
import PaymentGateway from '../controllers/PaymentController';
import * as Airtable from 'airtable';

import * as nodemailer from 'nodemailer';
import * as smtpTransport from 'nodemailer-smtp-transport';
import Utils from './utils';
const config = require('../../config.json');
const cred = require('../../credentials.json');
Airtable.configure({
	endpointUrl: 'https://api.airtable.com',
	apiKey: cred.airtableApiKey
})
const base = Airtable.base('apptpCcEN0UI8o1rm');
const statuses = [
					{id: "food_is_ready",	label: "food is ready"},
					{id: "being_prepared",	label: "being prepared"}, 
					{id: "accepted",	 	label: "accepted"}, 
					{id: "rejected" , 		label: "rejected"}, 
					{id: "cancelled", 		label: "cancelled"}, 
					{id: "delivered", 		label: "delivered"},
					{id: "picked_up",		label: "picked up"}, 
					{id: "failed", 			label: "failed"}
				]
let Order = {
	confirmOrder: async (req:Request, res:Response) => {
		let start:any = new Date;
        try {
			console.log("confirmation started")
			let {id, order_id, amount, status} = req.body.payload.payment.entity
			console.log(id, order_id)
            amount = amount /100;
			let firestore, data, payment_doc ; 
            firestore = admin.firestore();
			let payment_ref= await firestore.collection('payments').where("pg_order_id", "==", order_id).get()
			if(!payment_ref.docs.length) {
				console.log(id, order_id, "record empty")
				return res.sendStatus(200)
			}

			if(payment_ref.docs[0].data().status == "captured") {
				console.log("recalled")
				return res.sendStatus(200)
			}
			let razorpay_order = await PaymentGateway.getRazorpayOrder(order_id)

			//fetch user id
			let user_order_map_ref = await firestore.collection('user-orders-map').where("order_id","==",razorpay_order.receipt).get()
			let user_order_map_data = user_order_map_ref.docs[0].data()
			let ggb_order_id =razorpay_order.receipt;
			let user_id = user_order_map_data.user_id;
			let cart_id =user_id;

			let cart_ref = await firestore.collection('carts').doc(cart_id).get()
			let order_ref = await firestore.collection('user-details').doc(user_id).collection('orders').doc(ggb_order_id).get()
			
			let airtableRec = {
				contact:'',
				name:'',
				email:'',
				items:'',
				address:"",
				amount:amount,
				order_id:ggb_order_id,
				payment_id:id,
				razorpay_order_id:order_id,
				status:status == 'captured'? 'placed': status,
				order_no:'',
				datetime: new Date().toISOString()
			}

				
			
			payment_ref = payment_ref.docs[0].ref
			 payment_ref.update({
				order_id:razorpay_order.receipt,
				payment_gateway:'Razorpay',
				pg_payment_id:id,
				other_details:JSON.stringify(req.body.payload.payment.entity),
				status:status,
				timestamp : admin.firestore.FieldValue.serverTimestamp()
			})
			var t:any = new Date()
			console.log("Payment",t-start)
			let items_airtable =''
				
				if(order_ref.exists) {

					if(order_ref.data().items.length) {
						order_ref.data().items.forEach((item) => {
							items_airtable = items_airtable + item.product_name + '-' + item.size + '-' + item.quantity + '\n'
						})
					}
					airtableRec.items = items_airtable;

					if(order_ref.data().shipping_address.formatted_address)	{	
						airtableRec.address = order_ref.data().shipping_address.formatted_address;
					}
					if(user_id) {
						let user_ref = await firestore.collection('user-details').doc(user_id).get()
						if(user_ref.exists) {
							airtableRec.name = user_ref.data().name
							airtableRec.email = user_ref.data().email
							airtableRec.contact = user_ref.data().phone
						}
					}
				}

				let tokens = firestore.collection("tokens").doc(new Date().toDateString());

				let order_token = await firestore.runTransaction(function(transaction) {
					return transaction.get(tokens).then(function(sfDoc) {
						let new_count; 
						if (!sfDoc.exists) {
							new_count =  1; 
						} else {
							new_count = sfDoc.data().count + 1;
						}

						
						transaction.set(tokens, { count: new_count },{merge:true});
						return new_count;
					});
				})
				await Order.sleep(10);
				let temp = new Date().toDateString().split(" ")
				let sugar = temp[1].toUpperCase()+temp[2]
				let salt = razorpay_order.receipt.slice((razorpay_order.receipt.length - 3), (razorpay_order.receipt.length))
				let pepper = razorpay_order.receipt.slice(0, 3)
				let tempTk = order_token
				if(tempTk < 100) {
					var zeroes = new Array(3+1).join("0");
					tempTk= (zeroes + order_token).slice(-3);
				}
				let order_no =( sugar + salt + tempTk + pepper).toUpperCase()
				firestore.collection('user-details').doc(user_id).collection('orders').doc(razorpay_order.receipt).update({
					status: status == 'captured'? 'placed': status,
					token: order_token ,
					order_no: order_no,
					timestamp : admin.firestore.FieldValue.serverTimestamp()
				})
				t = new Date
			console.log("orders",t-start)

				airtableRec.order_no = order_no
				if(cart_ref.data().order_id == ggb_order_id && status !="failed") {
					let order_mode = cart_ref.data().order_mode
					cart_ref.ref.set({
					})
				}
			
				cart_ref.ref.de
				if(status != "failed") {
					console.log("air table entry", airtableRec)
					let airres =  await base('orders').create([
						{
							"fields": airtableRec
						}
					]).then(() => {
						console.log("Made entry in airtable")
					}).catch((e) => {
						console.log("Airtable entry failed ==>", e);
						
					})
					t = new Date
					console.log("airtable",t-start)

				}
			
				console.log("done")
            return res.sendStatus(200);
        } catch (error) {
			console.log(error)
            return res.sendStatus(500);
        }
       
       
	},

	updateOrderStatus: async (req:Request, res:Response) => {
		try {
			let { order_id, user_id, status, statusType } = req.body
			let firestore = admin.firestore();
			if(!order_id) {
				console.log("Airtable status updated failed: Order_id empty")
				return res.status(200).send("Order can not be empty")
			} 

			if(!user_id) {
				console.log("Airtable status updated failed: User_id empty")
				return res.status(200).send("User id can not be empty")
			}

			if(!status) {
				console.log("Airtable status updated failed: status empty")
				return res.status(200).send("Status can not be empty")
			}

			let statusObj = statuses.find((stat) => { return stat.label == status.trim().toLowerCase()})
			if(!statusObj) {
				return res.status(200).send("status is invalid")
			}
			let order_ref = await firestore.collection("user-details").doc(user_id).collection("orders").doc(order_id).get()
			let updateData = {};

			if(order_ref.exists) {
				let order_data = order_ref.data()
				if(statusType == 'delivery') {
					if(order_data.status == "accepted" && order_data.food_status == "food_is_ready") {
						updateData["delivery_status"]= statusObj.id
					}
				}  else if(statusType == 'order') {
					if(order_data.status == "placed") {
						updateData["status"]= statusObj.id
					}
				} else if(statusType == 'food')  {
						updateData["food_status"]= statusObj.id
					// return res.sendStatus(200)
				}
				let updateStatus = await order_ref.ref.update(updateData)
			}
			
			return res.sendStatus(200)
		} catch (error) {
			console.log(error)
			return res.status(200).send(error)
		}
		
	},
 	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

export default Order;