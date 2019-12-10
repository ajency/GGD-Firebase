import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import { routesConfig } from './routes-config';
import axios from 'axios';
import Utils from './controllers/utils';
let config = require('../credentials.json')
let serviceAccount = require('../serviceAccount.json');

if (process.env.X_GOOGLE_FUNCTION_IDENTITY) {
	admin.initializeApp(functions.config().firebase);
}
else {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: config.database_url
	});
}

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

routesConfig(app)
export const api = functions.region('asia-east2').https.onRequest(app);

exports.dataBaseTriggers = functions.region('asia-east2').firestore.document("user-details/{userDetailsId}/orders/{paymentId}").onUpdate(async (snap, context) => {
	try {
		let order_data = snap.after.data();
		let prev_order_data = snap.before.data();
		let firestore = admin.firestore();
		let sms_msg ='', email_subject ='', email_html = '';
		let email_content= {
			name:'',
			order_nos:'',
			msg:'',
			date:'',
			items:'',
			address:'',
			summary:'',
			url:'',
			label:"Order placed"
		};	
		let payment_ref = await firestore.collection('payments').where("order_id", "==", snap.after.id).get()
		let payment_data = payment_ref.docs[0].data()
		let pay_details = JSON.parse(payment_data.other_details)

		let cus_name = order_data.shipping_address.name.trim().split(" ")[0]
		cus_name = cus_name.charAt(0).toUpperCase() + cus_name.slice(1)
		let showItem,totalItem, secondItem
		if(order_data.items.length > 2) {
			let item_temp_arr = order_data.items.map((i) => {
				return i.quantity
			})
			let item_max = Math.max.apply( Math, item_temp_arr );
			showItem = order_data.items[item_temp_arr.indexOf(item_max)]
			totalItem = item_temp_arr.length - 2
			item_temp_arr.splice(item_temp_arr.indexOf(item_max))
			 item_max = Math.max.apply( Math, item_temp_arr );
			secondItem = order_data.items[item_temp_arr.indexOf(item_max)]
			
		}
		email_content.url = `https://greengrainbowl.com/#/order-details/${snap.after.id}`
		if(order_data.status.toLowerCase() == 'placed' && order_data.order_mode == "online") {

			if(order_data.items.length > 2) {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
					for ${showItem.product_name}  and ${secondItem.product_name} and ${totalItem} other bowl(s),
					 We are on it. Check your order at <link>`
			} else if(order_data.items.length == 2) {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
				for ${order_data.items[0].product_name} and ${order_data.items[1].product_name} bowl, We are on it. Check your order at <link>`

			} else {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} 
				for ${order_data.items[0].product_name}  bowl, We are on it. Check your order at <link>`
			}

			email_subject = `Thank you for your order at Green Grain Bowl`
			email_content.msg = ` <p style="margin: 0; margin-bottom: 25px;">Hi <strong>${cus_name},</strong></p>
			<p style="margin: 0; margin-bottom: 25px;">Thanks for placing an order with us.</p>
			<p style="margin: 0; margin-bottom: 25px;">We are on it. We'll notify you when your bowl(s) is ready for pick-up.</p>`


		} else if(order_data.status.toLowerCase() == 'placed' &&  order_data.order_mode =='kiosk' && order_data.food_status =='' && order_data.delivery_status == '') {

			if(order_data.items.length > 2) {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${showItem.product_name}  and ${secondItem.product_name} and ${totalItem} other bowl(s), We are on it			`
			} else if(order_data.items.length == 2) {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${order_data.items[0].product_name} and ${order_data.items[1].product_name} bowl, We are on it.`

			} else {
				sms_msg = `Thank you for your order ${snap.after.id} of Rs. ${order_data.summary.you_pay} for ${order_data.items[0].product_name}  bowl, We are on it.`
			}
			email_subject = `Thank you for your order at Green Grain Bowl`
			email_content.msg = ` <p>Hi <strong>${cus_name},</strong></p>
			<p>A lot of time and effort has gone into creating each bowl.</p>
			<p>What’s great is that it’s a beautifully balanced meal, cooked from scratch, using fresh, seasonal produce.
			Happy to have you join our tribe that eats well, and feels great!</p>`

		}  else if(order_data.status.toLowerCase() == 'failed') {
			return null
		} else if (prev_order_data.status.toLowerCase() == "placed" && order_data.status.toLowerCase() == 'accepted' && order_data.order_mode =='online') {
			return null
		} else if (prev_order_data.status.toLowerCase() == "placed" && order_data.status.toLowerCase() == 'rejected') {
			return null
		} else if (order_data.food_status.toLowerCase() == "food_is_ready" && order_data.order_mode == "kiosk") {
			email_content.label="ready for pickup"
			sms_msg = `Your bowl(s) is ready to be picked up. The token number is ^number^. Please show this SMS at the pick-up counter`
			email_subject = `Your bowl(s) is ready to be picked up`
			email_content.msg = ` <p>Hi <strong>${cus_name},</strong></p>
			<p>We are about to change the way you have tasted, perceived and experienced salads before.
			All dressed up, ready to be picked up - a well balanced meal, salad style, that promises to put a smile on your face.
			</p>
		`
		}

		if(order_data.order_mode == "kiosk") {
			email_content.url = `https://greengrainbowl.com/oyofourth/#/order-details/${snap.after.id}`
			email_content.address =`<div class=""><strong>Pick up from: </strong>GGB Counter</div> `
		} else {
			email_content.address =`<div class=""><strong>Delivery Address: </strong></div>
				${order_data.shipping_address.address}, ${order_data.shipping_address.landmark}, ${order_data.shipping_address.formatted_address}`
		}
		
		email_content.order_nos = payment_data.order_id;
		var dateTemp = payment_data.timestamp.toDate()
		let date = new Date(dateTemp)
		email_content.date = date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year: 'numeric' });
		for(let item of  order_data.items) {
			let prod_img ='http://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/products/cracked-wheat-n-chickpea-bowl-chicken.jpg'
			if(item.product_id !='') {
				let prod_ref = await firestore.collection('products').doc(item.product_id).get()	
				prod_img =  prod_ref.data().image_urls[0]
				email_content.items=email_content.items+`
				<div class="item-container flex-column">
					<div class="d-flex mb-4" style="margin-bottom: 1.5rem!important;display:flex;">
					<div class="product-cartimage d-inline-block" style="padding-right: 10px;width: 17%;display: inline-block!important;">
						<img class="" alt="" title="" height="50" width="50" src="${prod_img}" style="object-fit: cover;border-radius: 50%;">
					</div>
					<div class="product-details d-inline-block" style="width: 100%;display:inline-block!important;">
						<div class="product-title-c font-weight-light">
							${item.product_name}
						</div>
						<div class="">
							<div class="product-size-c text-capitalize" style="font-size: 14px; line-height: 14px; margin-top: 5px;text-transform;">
							${item.size} | Qty: ${item.quantity}
							</div>                     
						</div>            
					</div>
					<div class="d-flex align-items-center" style="display: flex;">                            
						<div class="product-price font-weight-light text-right pl-3" style="text-align: right;">
							₹${item.sale_price}
						</div>
					</div>
				</div>
			</div>		
			`
			}
		}

		email_content.summary = `
				<div class="summary-item pt-0" style="display: flex; justify-content: space-between; padding-top: 10px; padding-bottom: 10px;">
					<div class="w-50" style="width: 50%;float:left;">
						<label class="font-weight-light">Total Item Price</label>
					</div>
				<div class="font-weight-light w-50 text-right" style="width:50%;float:left;text-align:right;">₹${order_data.summary.sale_price_total} </div>
				</div>
				<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 10px; padding-bottom: 10px;">
					<div class="w-50" style="width: 50%;float:left;">
						<label class="font-weight-light">Delivery fee</label>
					</div>
					<div class="font-weight-light w-50 text-right" style="width:50%;float:left;text-align:right;">₹${order_data.summary.shipping_fee}</div>
				</div>
				<div class="summary-item" style="display: flex; justify-content: space-between; padding-top: 10px; padding-bottom: 10px;">
					<div class="w-50" style="width: 50%;float:left;">
						<label class="font-weight-medium mb-0"><strong>Total</strong></label>
					</div>
					<div class="font-weight-bold w-50 text-right" style="width:50%;float:left;text-align:right;"><strong>₹${order_data.summary.you_pay}</strong></div>
				</div>
			`

		email_html =  Utils.getEmailMarkup(email_content)
		if(order_data.shipping_address.email !='') {
	
			var transporter = nodemailer.createTransport({
				port: 587,
				host: config.aws_smtp_server,
				secure: false,
				auth: {
				user:config.aws_user ,
				pass: config.aws_pass
				},
				debug: true
			});
			const mailOptions = {
				from: 'Green Grain Bowl<no-reply@greengrainbowl.com>', // Something like: Jane Doe <janedoe@gmail.com>
				to: order_data.shipping_address.email,
				subject: email_subject, // email subject
				html: email_html
			};
			console.log("Email option",mailOptions)
			await transporter.sendMail(mailOptions).then((info) => {
				console.log("mail sent to ",order_data.shipping_address.email)
			}).catch((e) => {
				console.log("mail sent failed to ",e)
			})
	
		}
	
		if(order_data.shipping_address.phone != '') {
			let tempe ="viraj@ajency.in" 
			const mailOptions = {
				from: 'Green Grain Bowl<no-reply@greengrainbowl.com>', // Something like: Jane Doe <janedoe@gmail.com>
				to: tempe,
				subject: "GGB SMS", // email subject
				html: `<div>${sms_msg}<div>`
			};
			console.log("Email option",mailOptions)
			await transporter.sendMail(mailOptions).then((info) => {
				console.log("mail sent to ",order_data.shipping_address.email)
			}).catch((e) => {
				console.log("mail sent failed to ",e)
			})
			// let msgUrlParams = {
			// 	params: {
			// 		method:"SendMessage",
			// 		send_to: order_data.shipping_address.phone,
			// 		msg: sms_msg,
			// 		msg_type:"TEXT",
			// 		userid:"2000189884",
			// 		auth_scheme: "plain",
			// 		password:"UlpEzUe5L",
			// 		v:'1.1',
			// 		format:"text"
			// 	}
			// }	
			// axios.get('http://enterprise.smsgupshup.com/GatewayAPI/rest', msgUrlParams).then(ress => {
			// 	console.log(ress)
			// })
			// .catch(err => {
			// 	console.log(err)
			// })
		}
	
	}catch(e) {
		console.log(e)
		
	}
	return null 

})